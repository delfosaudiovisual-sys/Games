import { useCallback, useEffect, useRef, useState } from 'react'
import { FIELD_H, FIELD_W } from '@/game/content'
import { CENAS, desenharCena, duracaoCena, montarPalco } from '@/game/cutscene'
import type { Palco } from '@/game/cutscene'
import type { MapDef } from '@/game/types'

/** Mesma regra do game-screen: aplicar na montagem, e conferir por quadro. */
function fitCanvas(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.round(FIELD_W * dpr)
  const h = Math.round(FIELD_H * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

interface Props {
  map: MapDef
  /** Chamado quando a cena termina, é pulada, ou o mapa não tem cena. */
  onFinish: () => void
}

/** Abertura animada do capítulo. Sempre pulável — ninguém rejoga cinemática. */
export function CutscenePlayer({ map, onFinish }: Props) {
  const cena = CENAS[map.id]
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const palcoRef = useRef<Palco | null>(null)
  const tempoRef = useRef(0)
  const fimRef = useRef(onFinish)
  fimRef.current = onFinish
  const [prog, setProg] = useState(0)

  const attachCanvas = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node
    if (node) fitCanvas(node)
  }, [])

  useEffect(() => {
    if (!cena) {
      fimRef.current()
      return
    }
    palcoRef.current = montarPalco(map)
    const dur = duracaoCena(cena)
    let raf = 0
    let last = performance.now()
    let acc = 0
    let encerrado = false

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      tempoRef.current += dt

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx && palcoRef.current) {
        if (canvas.width !== Math.round(FIELD_W * Math.min(2, window.devicePixelRatio || 1))) {
          fitCanvas(canvas)
        }
        desenharCena(ctx, cena, Math.min(tempoRef.current, dur), palcoRef.current)
      }

      // A barra de progresso não precisa de 60 atualizações por segundo.
      acc += dt
      if (acc > 0.1) {
        acc = 0
        setProg(Math.min(1, tempoRef.current / dur))
      }
      if (!encerrado && tempoRef.current >= dur + 0.5) {
        encerrado = true
        cancelAnimationFrame(raf)
        fimRef.current()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [map, cena])

  /** Toque avança para o compasso seguinte; no último, encerra. */
  const avancar = useCallback(() => {
    if (!cena) return
    let acc = 0
    for (const b of cena.beats) {
      acc += b.dur
      if (tempoRef.current < acc - 0.05) {
        tempoRef.current = acc
        return
      }
    }
    fimRef.current()
  }, [cena])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') fimRef.current()
      if (ev.key === ' ' || ev.key === 'Enter') {
        avancar()
        ev.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [avancar])

  if (!cena) return null

  return (
    <div className="pr-stage fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 p-3">
      <div className="pr-panel w-full max-w-[980px] overflow-hidden p-2">
        <canvas
          ref={attachCanvas}
          className="pr-canvas"
          style={{ aspectRatio: `${FIELD_W} / ${FIELD_H}` }}
          onPointerDown={avancar}
        />
      </div>

      <div className="flex w-full max-w-[980px] items-center gap-3">
        <div className="pr-bar h-1.5 flex-1">
          <i style={{ width: `${prog * 100}%`, background: 'hsl(var(--prisma))' }} />
        </div>
        <span className="hidden text-[11px] text-ink-dim sm:block">toque para avançar</span>
        <button className="pr-btn px-4 py-2 text-xs" onClick={() => fimRef.current()}>
          Pular ›
        </button>
      </div>
    </div>
  )
}
