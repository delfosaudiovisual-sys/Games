import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BLESSING_BY_ID,
  CELL,
  ENEMIES,
  FIELD_H,
  FIELD_W,
  MAX_CAMPAIGN_WAVES,
  SYNERGIES,
  TOWERS,
  getWave,
} from '@/game/content'
import { nextUnlock, towerTip, unlockedTowers } from '@/game/unlock'
import {
  applyView,
  clampView,
  comfortZoom,
  defaultView,
  fitView,
  fitZoom,
  isFitted,
  panView,
  toFieldPt,
  zoomAt,
  type View,
} from '@/game/view'
import { Engine } from '@/game/engine'
import { buildBackground, render } from '@/game/render'
import { unlockAudio } from '@/game/audio'
import { TowerGlyph } from './glyphs'
import { BuildDock, SkillSheet, TowerPanel, TowerTipCard, fmt } from './dock'
import { SubmitRun } from './leaderboard'
import type { AbilityId, Branch, HudSnapshot, MapDef, Modifiers, TowerId } from '@/game/types'

export interface RunSummary {
  mapId: string
  wave: number
  kills: number
  prismas: number
  won: boolean
  perfect: boolean
  maxedTower: boolean
  killedTitan: boolean
  towerTypes: number
  maxSynergies: number
  peakGold: number
}

interface Props {
  map: MapDef
  mods: Modifiers
  endless: boolean
  muted: boolean
  showIntro: boolean
  playerName: string
  progress: number
  seenTips: string[]
  onSeeTip: (id: TowerId) => void
  onName: (name: string) => void
  onToggleMute: () => void
  onFinish: (s: RunSummary) => void
  onExit: () => void
}

/** Painel aberto na gaveta. Um por vez: o mapa nunca fica coberto duas vezes. */
type Painel = 'build' | 'skills' | null

/** Movimento a partir do qual o toque é arrasto, e não clique. */
const LIMIAR_ARRASTO = 12

/**
 * Dimensiona o bitmap para a caixa do canvas × DPR.
 *
 * Antes o bitmap era do tamanho do CAMPO, porque o campo era o canvas. Agora o
 * canvas é a tela inteira e a visão é que decide que parte do campo aparece —
 * então o bitmap tem de seguir a tela, não o campo. Devolve o tamanho em px de
 * CSS, que é a unidade em que a visão trabalha.
 */
function fitCanvas(canvas: HTMLCanvasElement): { w: number; h: number; mudou: boolean } {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = canvas.clientWidth || FIELD_W
  const h = canvas.clientHeight || FIELD_H
  const bw = Math.max(1, Math.round(w * dpr))
  const bh = Math.max(1, Math.round(h * dpr))
  const mudou = canvas.width !== bw || canvas.height !== bh
  if (mudou) {
    canvas.width = bw
    canvas.height = bh
  }
  return { w, h, mudou }
}

export function GameScreen({
  map,
  mods,
  endless,
  muted,
  showIntro,
  playerName,
  progress,
  seenTips,
  onSeeTip,
  onName,
  onToggleMute,
  onFinish,
  onExit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const bgRef = useRef<HTMLCanvasElement | null>(null)
  const pausedRef = useRef(false)
  const hoverRef = useRef<[number, number] | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const awardedRef = useRef(0)
  const endedRef = useRef(false)

  // Visão do campo. Fica em ref porque muda a cada quadro de arrasto: passar
  // por estado do React faria o rAF competir com a renderização.
  const viewRef = useRef<View>({ zoom: 1, x: 0, y: 0 })
  const sizeRef = useRef({ w: 0, h: 0 })
  const iniciouRef = useRef(false)
  const [zoomLabel, setZoomLabel] = useState(1)

  const gestoRef = useRef({
    dedos: new Map<number, { x: number; y: number }>(),
    arrastou: false,
    dist: 0,
  })

  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [paused, setPaused] = useState(false)
  const [intro, setIntro] = useState(showIntro)
  const [build, setBuild] = useState<TowerId | null>(null)
  const [painel, setPainel] = useState<Painel>(null)
  const [tip, setTip] = useState<TowerId | null>(null)
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)

  const attachCanvas = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node
    if (node) {
      const { w, h } = fitCanvas(node)
      sizeRef.current = { w, h }
      viewRef.current = defaultView(w, h)
      iniciouRef.current = true
      setZoomLabel(viewRef.current.zoom)
    }
  }, [])

  const sync = useCallback(() => {
    const eng = engineRef.current
    if (eng) setHud(eng.hud())
  }, [])

  const summary = useCallback((prismas: number): RunSummary => {
    const eng = engineRef.current!
    return {
      mapId: map.id,
      wave: eng.wave,
      kills: eng.kills,
      prismas,
      won: eng.status === 'victory' || eng.wave > MAX_CAMPAIGN_WAVES,
      perfect: eng.perfectRun,
      maxedTower: eng.maxedTower,
      killedTitan: eng.killedTitan,
      towerTypes: new Set(eng.towers.map((t) => t.def.id)).size,
      maxSynergies: eng.maxSynergies,
      peakGold: eng.peakGold,
    }
  }, [map.id])

  const award = useCallback(() => {
    const eng = engineRef.current
    if (!eng) return
    const earned = eng.earnedPrismas()
    const delta = Math.max(0, earned - awardedRef.current)
    awardedRef.current = earned
    onFinish(summary(delta))
  }, [onFinish, summary])

  useEffect(() => {
    const eng = new Engine(map, mods, endless)
    eng.recomputeMods()
    engineRef.current = eng
    bgRef.current = buildBackground(eng)
    setHud(eng.hud())

    let raf = 0
    let last = performance.now()
    let hudAcc = 0
    let lastStatus = eng.status

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!pausedRef.current) eng.update(dt)

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx && bgRef.current) {
        const { w, h, mudou } = fitCanvas(canvas)
        if (mudou || w !== sizeRef.current.w || h !== sizeRef.current.h) {
          sizeRef.current = { w, h }
          // Girar a tela ou a barra do navegador entrando muda a caixa: manter
          // o zoom do jogador e só reencaixar a origem.
          viewRef.current = iniciouRef.current ? clampView(viewRef.current, w, h) : defaultView(w, h)
          iniciouRef.current = true
        }
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        // Limpar a tela inteira: fora do campo o canvas é transparente e a
        // mesa aparece por baixo. Sem isso, arrastar deixa rastro nas faixas.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        applyView(ctx, viewRef.current, dpr)
        render(ctx, eng, bgRef.current, {
          hover: hoverRef.current,
          buildChoice: eng.buildChoice,
          meteorAim: eng.pendingMeteor,
          pointer: pointerRef.current,
          guide: eng.towers.length === 0,
        })
      }

      hudAcc += dt
      if (hudAcc > 0.09) {
        hudAcc = 0
        setHud(eng.hud())
      }
      if (eng.status !== lastStatus) {
        lastStatus = eng.status
        setHud(eng.hud())
        if ((eng.status === 'victory' || eng.status === 'defeat') && !endedRef.current) {
          endedRef.current = eng.status === 'defeat'
          const earned = eng.earnedPrismas()
          const delta = Math.max(0, earned - awardedRef.current)
          awardedRef.current = earned
          onFinish(summary(delta))
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id])

  useEffect(() => {
    pausedRef.current = paused || intro || tip !== null
  }, [paused, intro, tip])

  useEffect(() => {
    if (!hud?.lastMessage) return
    setToast({ text: hud.lastMessage, key: hud.messageKey })
  }, [hud?.messageKey, hud?.lastMessage])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  /* --- arsenal --- */

  const reach = Math.max(progress, hud?.wave ?? 0)
  const arsenal = useMemo(() => unlockedTowers(reach), [reach])
  const locked = useMemo(() => nextUnlock(reach), [reach])
  const prep = hud?.status === 'prep'

  useEffect(() => {
    if (!prep || tip || intro) return
    const estreia = arsenal.find((id) => towerTip(id) && !seenTips.includes(id))
    if (!estreia) return
    if (reach === 0) {
      onSeeTip(estreia)
      return
    }
    setTip(estreia)
  }, [prep, tip, intro, arsenal, seenTips, reach, onSeeTip])

  const fecharTip = useCallback(() => {
    if (tip) onSeeTip(tip)
    setTip(null)
  }, [tip, onSeeTip])

  /* --- visão: zoom, arrasto, pinça --- */

  const aplicaVisao = useCallback((v: View) => {
    viewRef.current = v
    setZoomLabel(v.zoom)
  }, [])

  const zoomBotao = useCallback(
    (factor: number) => {
      const { w, h } = sizeRef.current
      aplicaVisao(zoomAt(viewRef.current, w / 2, h / 2, factor, w, h))
    },
    [aplicaVisao],
  )

  const alternaEnquadre = useCallback(() => {
    const { w, h } = sizeRef.current
    const v = viewRef.current
    if (isFitted(v, w, h)) {
      aplicaVisao(zoomAt(v, w / 2, h / 2, comfortZoom(w, h) / v.zoom, w, h))
    } else {
      aplicaVisao(fitView(w, h))
    }
  }, [aplicaVisao])

  const daTela = useCallback((ev: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const r = canvas.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }, [])

  const tocaCampo = useCallback(
    (cssX: number, cssY: number) => {
      const eng = engineRef.current
      if (!eng) return
      const p = toFieldPt(viewRef.current, cssX, cssY)
      if (p.x < 0 || p.y < 0 || p.x > FIELD_W || p.y > FIELD_H) return
      pointerRef.current = p
      hoverRef.current = [Math.floor(p.x / CELL), Math.floor(p.y / CELL)]
      if (eng.pendingMeteor) {
        eng.useAbility('meteoro', p)
        sync()
        return
      }
      eng.selectSlot(Math.floor(p.x / CELL), Math.floor(p.y / CELL))
      sync()
    },
    [sync],
  )

  const onPointerDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    const t = daTela(ev)
    if (!t) return
    ev.currentTarget.setPointerCapture(ev.pointerId)
    const g = gestoRef.current
    g.dedos.set(ev.pointerId, t)
    if (g.dedos.size === 1) g.arrastou = false
    if (g.dedos.size === 2) {
      const [a, b] = [...g.dedos.values()]
      g.dist = Math.hypot(a.x - b.x, a.y - b.y)
      g.arrastou = true // pinça nunca é clique
    }
  }

  const onPointerMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const t = daTela(ev)
    if (!t) return
    const g = gestoRef.current
    const { w, h } = sizeRef.current
    const antes = g.dedos.get(ev.pointerId)

    if (!antes) {
      // mouse passeando sem apertar: só realce
      const p = toFieldPt(viewRef.current, t.x, t.y)
      pointerRef.current = p
      hoverRef.current = [Math.floor(p.x / CELL), Math.floor(p.y / CELL)]
      return
    }

    if (g.dedos.size >= 2) {
      g.dedos.set(ev.pointerId, t)
      const [a, b] = [...g.dedos.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (g.dist > 0 && d > 0) {
        const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        aplicaVisao(zoomAt(viewRef.current, meio.x, meio.y, d / g.dist, w, h))
      }
      g.dist = d
      return
    }

    const dx = t.x - antes.x
    const dy = t.y - antes.y
    if (!g.arrastou && Math.hypot(dx, dy) > LIMIAR_ARRASTO) g.arrastou = true
    if (g.arrastou) {
      aplicaVisao(panView(viewRef.current, dx, dy, w, h))
      g.dedos.set(ev.pointerId, t)
    }
  }

  const onPointerUp = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gestoRef.current
    const era = g.dedos.size
    const t = daTela(ev)
    g.dedos.delete(ev.pointerId)
    if (era === 1 && !g.arrastou && t) {
      setPainel(null)
      tocaCampo(t.x, t.y)
    }
    if (g.dedos.size < 2) g.dist = 0
  }

  const onWheel = (ev: React.WheelEvent<HTMLCanvasElement>) => {
    const t = daTela(ev)
    if (!t) return
    ev.preventDefault()
    const { w, h } = sizeRef.current
    aplicaVisao(zoomAt(viewRef.current, t.x, t.y, ev.deltaY < 0 ? 1.12 : 1 / 1.12, w, h))
  }

  /* --- ações --- */

  const chooseBuild = useCallback(
    (id: TowerId | null) => {
      const eng = engineRef.current
      if (!eng) return
      eng.buildChoice = eng.buildChoice === id ? null : id
      eng.pendingMeteor = false
      setBuild(eng.buildChoice)
      if (eng.buildChoice) {
        eng.clearSelection()
        // Fecha a gaveta: para colocar a torre é preciso ver o mapa.
        setPainel(null)
      }
      sync()
    },
    [sync],
  )

  const doUpgrade = useCallback(
    (branch?: Branch) => {
      const eng = engineRef.current
      if (!eng || eng.selectedTowerUid === null) return
      eng.tryUpgrade(eng.selectedTowerUid, branch)
      sync()
    },
    [sync],
  )

  const doSell = useCallback(() => {
    const eng = engineRef.current
    if (!eng || eng.selectedTowerUid === null) return
    eng.sell(eng.selectedTowerUid)
    sync()
  }, [sync])

  const doAbility = useCallback(
    (id: AbilityId) => {
      const eng = engineRef.current
      if (!eng) return
      unlockAudio()
      eng.useAbility(id)
      setBuild(null)
      eng.buildChoice = null
      setPainel(null)
      sync()
    },
    [sync],
  )

  const callWave = useCallback(() => {
    const eng = engineRef.current
    if (!eng) return
    unlockAudio()
    eng.callWave()
    sync()
  }, [sync])

  const cycleSpeed = useCallback(() => {
    const eng = engineRef.current
    if (!eng) return
    eng.setSpeed(eng.speed === 1 ? 2 : eng.speed === 2 ? 3 : 1)
    sync()
  }, [sync])

  const telaCheia = useCallback(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element }
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      void document.exitFullscreen?.()
      return
    }
    const pedido = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.()
    void Promise.resolve(pedido)
      .then(() => {
        // Trava na horizontal onde der (Android). No iOS isso rejeita, e está
        // tudo bem: o retrato agora funciona sozinho.
        const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
        return orient?.lock?.('landscape')
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const eng = engineRef.current
      if (!eng) return
      const target = ev.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const k = ev.key.toLowerCase()
      const n = Number(k)
      if (n >= 1 && n <= arsenal.length) {
        chooseBuild(arsenal[n - 1])
        ev.preventDefault()
        return
      }
      if (k === ' ') {
        if (eng.status === 'prep') callWave()
        ev.preventDefault()
        return
      }
      if (k === 'p') setPaused((v) => !v)
      if (k === 'b') setPainel((v) => (v === 'build' ? null : 'build'))
      if (k === 'escape') {
        eng.buildChoice = null
        eng.pendingMeteor = false
        eng.clearSelection()
        setBuild(null)
        setPainel(null)
        sync()
      }
      if (k === 'u') doUpgrade()
      if (k === 'x') doSell()
      if (k === 'q') doAbility('meteoro')
      if (k === 'w') doAbility('estase')
      if (k === 'e') doAbility('reparo')
      if (k === 'a') cycleSpeed()
      if (k === 'f') alternaEnquadre()
      if (k === '+' || k === '=') zoomBotao(1.2)
      if (k === '-') zoomBotao(1 / 1.2)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [alternaEnquadre, arsenal, callWave, chooseBuild, cycleSpeed, doAbility, doSell, doUpgrade, sync, zoomBotao])

  const eng = engineRef.current
  const selected = hud?.selectedTower ?? null
  const towerCount = eng?.towers.length ?? 0

  const nextWaveInfo = useMemo(() => {
    if (!hud) return null
    const def = getWave(hud.status === 'prep' ? hud.wave + 1 : hud.wave)
    const kinds = Array.from(new Set(def.groups.map((g) => g.enemy))).map((k) => ENEMIES[k].name)
    return { label: def.label, kinds, boss: def.boss ?? false }
  }, [hud?.wave, hud?.status])

  const hint = (() => {
    if (!hud || hud.status === 'draft' || hud.status === 'victory' || hud.status === 'defeat') return null
    if (build) return 'Agora toque numa plataforma'
    if (painel) return null
    if (towerCount === 0) return 'Toque em 🔨 para escolher uma torre'
    if (towerCount > 0 && hud.wave === 0) return 'Construa mais ou chame a primeira onda'
    return null
  })()

  if (!hud) {
    return <div className="pr-stage grid min-h-screen place-items-center text-ink-soft">Abrindo o caderno…</div>
  }

  const aberto = selected ? 'tower' : painel

  return (
    <div className="pr-shell pr-stage">
      <canvas
        ref={attachCanvas}
        className="pr-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => {
          e.preventDefault()
          chooseBuild(null)
          engineRef.current?.clearSelection()
          setPainel(null)
          sync()
        }}
      />

      <div className="pr-hud">
        <div className="pr-topo">
          <div className="pr-ilha">
            <button
              className="pr-btn px-2.5 py-1.5 text-xs font-bold"
              onClick={() => {
                award()
                onExit()
              }}
            >
              ←<span className="pr-rotulo"> Sair</span>
            </button>
            <span className="pr-num text-ink">
              💛 {hud.lives}
              <span className="pr-of text-ink-dim">/{hud.maxLives}</span>
            </span>
            <span className="pr-num text-amber">🪙 {fmt(hud.gold)}</span>
            <span className="pr-num text-ink">
              🌊 {hud.wave}
              {hud.endless ? (
                <span className="text-magenta">∞</span>
              ) : (
                <span className="pr-of text-ink-dim">/{hud.maxWaves}</span>
              )}
            </span>
          </div>

          <div className="pr-vao" />

          <div className="pr-ilha">
            <button className="pr-btn px-2.5 py-1.5 text-xs font-bold" onClick={cycleSpeed} title="Velocidade">
              {hud.speed}×
            </button>
            <button className="pr-btn px-2.5 py-1.5 text-xs" onClick={() => setPaused((v) => !v)} title="Pausar">
              {paused ? '▶' : '❚❚'}
            </button>
          </div>
        </div>

        <div className="pr-zoom">
          <button className="pr-btn pr-ilha pr-redondo" onClick={() => zoomBotao(1.25)} title="Aproximar">
            ＋
          </button>
          <button className="pr-btn pr-ilha pr-redondo" onClick={alternaEnquadre} title="Ver tudo / aproximar">
            {/* lê o estado, não a ref: é o que faz o ícone acompanhar o zoom */}
            {zoomLabel <= fitZoom(sizeRef.current.w, sizeRef.current.h) + 1e-6 ? '🔍' : '⛶'}
          </button>
          <button className="pr-btn pr-ilha pr-redondo" onClick={() => zoomBotao(1 / 1.25)} title="Afastar">
            －
          </button>
        </div>

        {hint && (
          <div className="pr-dica pr-bob px-3 py-2 font-display text-[13px] font-bold text-ink">{hint}</div>
        )}

        <div className="flex min-w-0 flex-col gap-2">
          {aberto === 'tower' && selected && (
            <div className="pr-folha">
              <TowerPanel
                engine={eng}
                tower={selected}
                gold={hud.gold}
                onUpgrade={doUpgrade}
                onSell={doSell}
                onClose={() => {
                  eng?.clearSelection()
                  sync()
                }}
                onPriority={() => {
                  if (eng && selected) {
                    eng.cyclePriority(selected.uid)
                    sync()
                  }
                }}
              />
            </div>
          )}

          {aberto === 'build' && (
            <div className="pr-folha">
              <div className="pr-folha-cab">
                <b className="font-display text-[13px] text-ink">Construir</b>
                <span className="pr-rotulo text-[11px] text-ink-dim">toque numa torre, depois numa plataforma</span>
                <button className="pr-btn ml-auto px-2.5 py-1 text-xs" onClick={() => setPainel(null)}>
                  ✕
                </button>
              </div>
              <BuildDock
                towers={arsenal}
                locked={locked}
                build={build}
                gold={hud.gold}
                costOf={(id) => eng?.buildCost(id) ?? TOWERS[id].levels[0].cost}
                onChoose={chooseBuild}
              />
            </div>
          )}

          {aberto === 'skills' && (
            <div className="pr-folha">
              <div className="pr-folha-cab">
                <b className="font-display text-[13px] text-ink">Poderes</b>
                <button className="pr-btn ml-auto px-2.5 py-1 text-xs" onClick={() => setPainel(null)}>
                  ✕
                </button>
              </div>
              <SkillSheet hud={hud} onAbility={doAbility} />
              {hud.synergies.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {hud.synergies.map((sid) => {
                    const s = SYNERGIES.find((x) => x.id === sid)
                    if (!s) return null
                    return (
                      <div key={sid} className="rounded-xl border border-edge bg-ink/5 px-2.5 py-1.5">
                        <div className="font-display text-xs font-bold text-prisma">{s.name}</div>
                        <div className="text-[11px] text-ink-soft">{s.desc}</div>
                      </div>
                    )
                  })}
                </div>
              )}
              {hud.blessings.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hud.blessings.map(({ id, count }) => {
                    const b = BLESSING_BY_ID[id]
                    if (!b) return null
                    return (
                      <span key={id} className="pr-chip px-2 py-1 text-[11px] text-ink-soft" title={b.desc}>
                        {b.icon} {b.name}
                        {count > 1 && <b className="ml-1 text-prisma">×{count}</b>}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="pr-base">
            <button
              className={`pr-btn pr-ilha pr-redondo ${towerCount === 0 && !painel ? 'pr-ping' : ''}`}
              onClick={() => setPainel((v) => (v === 'build' ? null : 'build'))}
              title="Construir [B]"
            >
              🔨
            </button>

            <div className="pr-vao" />

            {prep ? (
              <button className="pr-btn pr-btn-hot rounded-full px-4 py-3 text-[13px] font-bold" onClick={callWave}>
                Chamar onda {hud.wave + 1}
                <span className="ml-1 text-[11px]">+{Math.floor(hud.prepTimer * 4)} 🪙</span>
              </button>
            ) : (
              <div className="pr-ilha px-3 py-2 text-[12px] font-bold text-ink-soft">
                Onda {hud.wave} · {hud.enemiesLeft}
              </div>
            )}

            <div className="pr-vao" />

            <button
              className="pr-btn pr-ilha pr-redondo"
              onClick={() => setPainel((v) => (v === 'skills' ? null : 'skills'))}
              title="Poderes"
            >
              ⚡
              <b className="pr-act-cost text-amber">{Math.round(hud.energy)}</b>
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          key={toast.key}
          className="pr-rise pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border-2 border-edge bg-glass-strong px-5 py-2.5 text-sm font-bold text-ink backdrop-blur"
        >
          {toast.text}
        </div>
      )}

      {tip && !intro && (
        <Overlay>
          <TowerTipCard id={tip} onClose={fecharTip} />
        </Overlay>
      )}

      {intro && (
        <Overlay>
          <div className="pr-panel pr-rise w-[min(560px,94vw)] p-5 sm:p-6">
            <h2 className="pr-title text-center font-display text-2xl sm:text-3xl">Alguém derrubou o tinteiro</h2>
            <div className="mt-4 space-y-2.5">
              <Step
                icon="💎"
                title="O Prisma é a última cor"
                text="É o cristal no fim da página. Se a tinta encostar, ele apaga um pouco."
              />
              <Step
                icon="🟩"
                title="Você constrói nas plataformas"
                text="Só nos quadrados com cantoneiras dá para construir. Pedra bloqueia, e a faixa escura é por onde a tinta passa."
              />
              <Step
                icon="🔍"
                title="O mapa é a tela toda"
                text="Arraste para andar pela página, pince para aproximar, e toque em ⛶ para ver tudo de uma vez."
              />
            </div>

            <div className="mt-4 rounded-2xl border-2 border-edge bg-ink/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-ink-dim">Seu arsenal começa com duas</div>
              <div className="mt-2 space-y-2">
                {unlockedTowers(0).map((id) => (
                  <div key={id} className="flex items-start gap-2.5">
                    <TowerGlyph id={id} size={40} />
                    <span className="min-w-0">
                      <b className="font-display text-sm text-ink">{TOWERS[id].name}</b>
                      <span className="block text-[11px] leading-snug text-ink-soft">{towerTip(id)}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-ink-dim">
                As outras cinco entram sozinhas conforme você avança nas ondas — cada uma com a sua dica.
              </p>
            </div>

            <button className="pr-btn pr-btn-hot mt-5 w-full py-3" onClick={() => setIntro(false)}>
              Entendi, bora
            </button>
          </div>
        </Overlay>
      )}

      {paused && !intro && !tip && (
        <Overlay>
          <div className="pr-panel pr-rise w-[min(420px,92vw)] p-6 text-center">
            <h2 className="pr-title font-display text-3xl">Pausado</h2>
            <p className="mt-2 text-sm text-ink-soft">Respire. A tinta espera.</p>
            <div className="mt-6 flex flex-col gap-2">
              <button className="pr-btn pr-btn-hot py-3" onClick={() => setPaused(false)}>
                Continuar
              </button>
              <button className="pr-btn py-2.5 text-sm" onClick={telaCheia}>
                Tela cheia do navegador
              </button>
              <button className="pr-btn py-2.5 text-sm" onClick={onToggleMute}>
                Som: {muted ? 'desligado' : 'ligado'}
              </button>
              <button
                className="pr-btn py-2.5 text-sm"
                onClick={() => {
                  award()
                  onExit()
                }}
              >
                Voltar ao menu
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {hud.draft && (
        <Overlay>
          <div className="pr-rise w-[min(900px,94vw)]">
            <h2 className="pr-title mb-1 text-center font-display text-2xl sm:text-3xl">Bênção do Prisma</h2>
            <p className="mb-5 text-center text-sm text-ink-soft">Escolha um poder para o resto desta partida.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {hud.draft.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    eng?.pickDraft(b)
                    sync()
                  }}
                  className="pr-panel pr-card-pick p-4 text-left"
                >
                  <div className="text-3xl">{b.icon}</div>
                  <div className="mt-2 font-display text-base font-bold text-ink">{b.name}</div>
                  <div
                    className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      background:
                        b.rarity === 'lendaria'
                          ? 'linear-gradient(135deg,#fbbf24,#f43f5e)'
                          : b.rarity === 'rara'
                            ? 'linear-gradient(135deg,#67e8f9,#0891b2)'
                            : 'rgba(255,255,255,0.12)',
                      color: b.rarity === 'comum' ? 'hsl(var(--ink-soft))' : '#08131c',
                    }}
                  >
                    {b.rarity}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{b.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </Overlay>
      )}

      {(hud.status === 'victory' || hud.status === 'defeat') && (
        <Overlay>
          <div className="pr-panel pr-rise w-[min(520px,94vw)] p-5 text-center sm:p-7">
            <div className="text-5xl">{hud.status === 'victory' ? '🏆' : '💥'}</div>
            <h2 className="pr-title mt-2 font-display text-3xl sm:text-4xl">
              {hud.status === 'victory' ? 'A Página Resistiu' : 'A Mancha Venceu'}
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Onda" value={hud.wave.toString()} />
              <Stat label="Abates" value={hud.kills.toString()} />
              <Stat label="Pontos" value={fmt(hud.score)} />
            </div>
            <div className="mt-3 rounded-2xl border-2 border-edge bg-ink/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-ink-dim">Prismas conquistados</div>
              <div className="pr-title font-display text-4xl">💎 {hud.earnedPrismas}</div>
            </div>

            <div className="mt-3 text-left">
              <SubmitRun
                mapId={map.id}
                wave={hud.wave}
                kills={hud.kills}
                score={hud.score}
                endless={hud.endless}
                defaultName={playerName}
                onName={onName}
              />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {hud.status === 'victory' && (
                <button
                  className="pr-btn pr-btn-hot py-3"
                  onClick={() => {
                    eng?.continueEndless()
                    sync()
                  }}
                >
                  Continuar no modo infinito
                </button>
              )}
              <button
                className="pr-btn pr-btn-warm py-3"
                onClick={() => {
                  award()
                  onExit()
                }}
              >
                Voltar ao menu
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-void/85 p-3 backdrop-blur-md sm:p-4">
      {children}
    </div>
  )
}

function Step({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border-2 border-edge bg-ink/5 p-2.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-prisma/40 to-violet/25 text-lg">
        {icon}
      </span>
      <span>
        <span className="block font-display text-sm font-bold text-ink">{title}</span>
        <span className="block text-[12px] leading-snug text-ink-soft">{text}</span>
      </span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-edge bg-ink/5 p-2.5">
      <div className="text-[10px] uppercase tracking-widest text-ink-dim">{label}</div>
      <div className="font-display text-xl font-bold text-ink">{value}</div>
    </div>
  )
}
