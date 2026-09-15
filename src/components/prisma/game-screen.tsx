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
import { Engine } from '@/game/engine'
import { buildBackground, render } from '@/game/render'
import { unlockAudio } from '@/game/audio'
import { TowerGlyph } from './glyphs'
import { ActionBar, BuildDock, TowerPanel, TowerTipCard, fmt } from './dock'
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
  /** Onda mais alta já alcançada em qualquer mapa: é o que libera as torres. */
  progress: number
  seenTips: string[]
  onSeeTip: (id: TowerId) => void
  onName: (name: string) => void
  onToggleMute: () => void
  onFinish: (s: RunSummary) => void
  onExit: () => void
}

/**
 * Dimensiona o bitmap do canvas e fixa a escala de DPI.
 *
 * Tem de rodar no instante em que o elemento entra no DOM. O componente tem um
 * `return` antecipado enquanto `hud` é null, então na primeira renderização o
 * canvas ainda não existe — um efeito lendo `canvasRef.current` pega null, pula
 * o dimensionamento e o canvas fica no padrão de 300x150 do HTML. O jogo então
 * desenha só o canto superior esquerdo do campo, esticado para preencher a
 * caixa. Por isso o tamanho é aplicado por ref de callback, e o laço confere a
 * cada quadro.
 */
function fitCanvas(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.round(FIELD_W * dpr)
  const h = Math.round(FIELD_H * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  // Mexer em width/height zera o estado do contexto, então a escala vem depois.
  canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
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

  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [paused, setPaused] = useState(false)
  const [intro, setIntro] = useState(showIntro)
  const [build, setBuild] = useState<TowerId | null>(null)
  const [tip, setTip] = useState<TowerId | null>(null)
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)

  // Ref de callback: dispara exatamente quando o canvas entra ou sai do DOM.
  const attachCanvas = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node
    if (node) fitCanvas(node)
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

    // O dimensionamento do canvas saiu daqui: ver `fitCanvas` e `attachCanvas`.

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
        // Autocorreção: girar a tela pode mudar o devicePixelRatio, e mexer em
        // width/height zera a transformação. Conferir é uma comparação por quadro.
        if (canvas.width !== Math.round(FIELD_W * Math.min(2, window.devicePixelRatio || 1))) {
          fitCanvas(canvas)
        }
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

  /* --- arsenal: o que está liberado agora, e a estreia de cada torre --- */

  // O progresso salvo é permanente; a onda desta partida pode passar dele.
  const reach = Math.max(progress, hud?.wave ?? 0)
  const arsenal = useMemo(() => unlockedTowers(reach), [reach])
  const locked = useMemo(() => nextUnlock(reach), [reach])

  // A estreia só interrompe no preparo. As duas torres iniciais são ensinadas
  // pela abertura, não por modal — dois avisos em sequência na onda 1 seriam
  // ruído em cima do ruído.
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

  /* --- ações --- */

  const toField = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scale = FIELD_W / rect.width
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale }
  }, [])

  const onPointerMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toField(ev.clientX, ev.clientY)
    if (!p) return
    pointerRef.current = p
    hoverRef.current = [Math.floor(p.x / CELL), Math.floor(p.y / CELL)]
  }

  const onPointerLeave = () => {
    hoverRef.current = null
    pointerRef.current = null
  }

  const onCanvasClick = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    const eng = engineRef.current
    const p = toField(ev.clientX, ev.clientY)
    if (!eng || !p) return
    pointerRef.current = p
    hoverRef.current = [Math.floor(p.x / CELL), Math.floor(p.y / CELL)]
    if (eng.pendingMeteor) {
      eng.useAbility('meteoro', p)
      sync()
      return
    }
    eng.selectSlot(Math.floor(p.x / CELL), Math.floor(p.y / CELL))
    sync()
  }

  const chooseBuild = useCallback(
    (id: TowerId | null) => {
      const eng = engineRef.current
      if (!eng) return
      eng.buildChoice = eng.buildChoice === id ? null : id
      eng.pendingMeteor = false
      setBuild(eng.buildChoice)
      if (eng.buildChoice) eng.clearSelection()
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
      if (k === 'escape') {
        eng.buildChoice = null
        eng.pendingMeteor = false
        eng.clearSelection()
        setBuild(null)
        sync()
      }
      if (k === 'u') doUpgrade()
      if (k === 'x') doSell()
      if (k === 'q') doAbility('meteoro')
      if (k === 'w') doAbility('estase')
      if (k === 'e') doAbility('reparo')
      if (k === 'a') cycleSpeed()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [arsenal, callWave, chooseBuild, cycleSpeed, doAbility, doSell, doUpgrade, sync])

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
    if (towerCount === 0 && !build) return 'Escolha uma torre na doca abaixo'
    if (build) return 'Agora toque numa plataforma'
    if (towerCount > 0 && hud.wave === 0) return 'Construa mais ou chame a primeira onda'
    return null
  })()

  if (!hud) {
    return <div className="pr-stage grid min-h-screen place-items-center text-ink-soft">Abrindo o caderno…</div>
  }

  return (
    <div className="pr-shell pr-stage">
      <header className="pr-rail pr-topbar">
        <button
          className="pr-btn shrink-0 px-2.5 py-1.5 text-xs font-bold"
          onClick={() => {
            award()
            onExit()
          }}
        >
          ←<span className="pr-topbar-label"> Sair</span>
        </button>

        <span className="pr-chip shrink-0 px-2.5 py-1.5 font-display text-xs font-bold text-ink">
          💛 {hud.lives}
          <span className="pr-of text-ink-dim">/{hud.maxLives}</span>
        </span>

        <span className="pr-chip shrink-0 px-2.5 py-1.5 font-display text-xs font-bold text-amber">
          🪙 {fmt(hud.gold)}
        </span>

        <span className="pr-chip shrink-0 px-2.5 py-1.5 font-display text-xs font-bold text-ink">
          🌊 {hud.wave}
          {hud.endless ? (
            <span className="text-magenta">∞</span>
          ) : (
            <span className="pr-of text-ink-dim">/{hud.maxWaves}</span>
          )}
        </span>

        {hud.combo > 3 && (
          <span className="pr-chip hidden shrink-0 animate-pulse px-2.5 py-1.5 font-display text-xs font-bold text-magenta sm:inline">
            ×{hud.combo}
          </span>
        )}

        <span className="pr-spacer flex shrink-0 items-center gap-1">
          {/* Uma casa no retrato, três no desktop: ver `.pr-speed-one`. */}
          <button className="pr-btn pr-speed-one px-2.5 py-1.5 text-xs font-bold" onClick={cycleSpeed}>
            {hud.speed}×
          </button>
          <span className="pr-chip pr-speed-all items-center gap-1 p-1">
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => {
                  eng?.setSpeed(s)
                  sync()
                }}
                className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                  hud.speed === s ? 'bg-prisma text-void' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {s}×
              </button>
            ))}
          </span>
          <button className="pr-btn px-2.5 py-1.5 text-xs" onClick={() => setPaused((v) => !v)}>
            {paused ? '▶' : '❚❚'}
          </button>
          <button className="pr-btn hidden px-2.5 py-1.5 text-xs sm:block" onClick={onToggleMute} title="Som">
            {muted ? '🔇' : '🔊'}
          </button>
        </span>
      </header>

      <div className="pr-body">
        <div className="pr-field-box">
          <canvas
            ref={attachCanvas}
            className="pr-canvas"
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerDown={onCanvasClick}
            onContextMenu={(e) => {
              e.preventDefault()
              chooseBuild(null)
              engineRef.current?.clearSelection()
              sync()
            }}
          />
          {hint && (
            <div className="pr-hint pr-hint-float pr-bob px-3 py-2 font-display text-[13px] font-bold text-ink">
              {hint}
            </div>
          )}
        </div>

        <div className="pr-dock pr-scroll">
          <ActionBar hud={hud} nextWave={nextWaveInfo} onCallWave={callWave} onAbility={doAbility} />

          {selected ? (
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
          ) : (
            <BuildDock
              towers={arsenal}
              locked={locked}
              build={build}
              gold={hud.gold}
              costOf={(id) => eng?.buildCost(id) ?? TOWERS[id].levels[0].cost}
              onChoose={chooseBuild}
            />
          )}

          {hud.synergies.length > 0 && (
            <div className="pr-panel p-2">
              <h3 className="mb-1.5 font-display text-[13px] font-bold text-ink">Sinergias ativas</h3>
              <div className="space-y-1.5">
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
            </div>
          )}

          {hud.blessings.length > 0 && (
            <div className="pr-panel p-2">
              <h3 className="mb-1.5 font-display text-[13px] font-bold text-ink">Bênçãos</h3>
              <div className="flex flex-wrap gap-1.5">
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
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          key={toast.key}
          className="pr-rise pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border-2 border-edge bg-glass-strong px-5 py-2.5 text-sm font-bold text-ink backdrop-blur"
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
                text="É o cristal no fim da página. Toda a cor do caderno sai dele. Se a tinta encostar, ele apaga um pouco."
              />
              <Step
                icon="🖋️"
                title="A Mancha escorre pela margem"
                text="A tinta entra pela borda da folha e escorre sempre pelo mesmo caminho, até o Prisma."
              />
              <Step
                icon="🟩"
                title="Você constrói nas plataformas"
                text="Só nos quadrados com cantoneiras dá para construir. Pedra é bloqueio, e a faixa escura é por onde a tinta passa."
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
                As outras cinco entram sozinhas, conforme você avança nas ondas — cada uma com a sua dica.
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
