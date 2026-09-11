import { FIELD_H, FIELD_W } from '../build/game/content'
import { buildBackground, render } from '../build/game/render'
import { MockEngine } from './mock'
import { MAPS } from './fixtures'

/** Copia exata do helper novo do game-screen.tsx. */
function fitCanvas(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.round(FIELD_W * dpr)
  const h = Math.round(FIELD_H * dpr)
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
  canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function cena(alvo: string, corrigido: boolean) {
  // 1) primeira renderizacao: hud === null, canvas ausente do DOM
  let canvas: HTMLCanvasElement | null = null
  // 2) efeito roda e tenta dimensionar via canvasRef.current
  if (!corrigido && canvas) fitCanvas(canvas)
  // 3) setHud monta o canvas
  canvas = document.createElement('canvas')
  canvas.className = 'pr-canvas'
  canvas.style.aspectRatio = `${FIELD_W} / ${FIELD_H}`
  document.getElementById(alvo)!.appendChild(canvas)
  // 3b) CORRIGIDO: a ref de callback dispara aqui, no momento da montagem
  if (corrigido) fitCanvas(canvas)
  // 4) laco rAF
  const ctx = canvas.getContext('2d')!
  const e = new MockEngine(MAPS.jardim)
  e.time = 3.1
  render(ctx, e as never, buildBackground(e as never),
    { hover: null, buildChoice: null, meteorAim: false, pointer: null, guide: true })
  return `${canvas.width}x${canvas.height}`
}

document.getElementById('ta')!.textContent = `ANTES — bitmap ${cena('p', false)} (padrão do HTML)`
document.getElementById('tb')!.textContent = `DEPOIS — bitmap ${cena('q', true)}`
;(window as unknown as { __ready: boolean }).__ready = true
