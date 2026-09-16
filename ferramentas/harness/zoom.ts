import { CELL, FIELD_H, FIELD_W } from '../build/game/content'
import { buildBackground, render } from '../build/game/render'
import { applyView, defaultView, fitView, zoomAt, type View } from '../build/game/view'
import { MockEngine } from './mock'
import { ENEMY_DEFS, MAPS } from './fixtures'

/**
 * Prova visual do zoom: o mesmo campo, o mesmo render.ts, três visões.
 * Se a conta da visão estiver errada, aqui aparece esticado, cortado ou torto.
 */

function cena() {
  const e = new MockEngine(MAPS.jardim)
  e.time = 3.1
  e.wave = 3
  e.addTower('faisca', 1, 3, 3, -0.6)
  e.addTower('gelido', 3, 2, 3)
  e.addTower('estilhaco', 6, 3, 3, 0.4)
  e.addTower('lanca', 9, 3, 3, -1.2)
  e.addEnemy(ENEMY_DEFS.rastejante, 120)
  e.addEnemy(ENEMY_DEFS.corredor, 260)
  e.addEnemy(ENEMY_DEFS.couracado, 420)
  e.addEnemy(ENEMY_DEFS.espectro, 300)
  return e
}

const eng = cena()
const bg = buildBackground(eng as never)
const dpr = 2

function pinta(id: string, w: number, h: number, faz: (v: View) => View): void {
  const cv = document.getElementById(id) as HTMLCanvasElement
  cv.style.width = `${w}px`
  cv.style.height = `${h}px`
  cv.width = Math.round(w * dpr)
  cv.height = Math.round(h * dpr)
  const ctx = cv.getContext('2d')!
  const v = faz(defaultView(w, h))

  // fundo da mesa aparece nas faixas vazias, como no jogo
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#231d14'
  ctx.fillRect(0, 0, w, h)

  applyView(ctx, v, dpr)
  render(ctx, eng as never, bg, {
    hover: null,
    buildChoice: null,
    meteorAim: false,
    pointer: null,
    guide: false,
  })

  const rot = document.getElementById(`${id}-t`)!
  rot.textContent = `zoom ${v.zoom.toFixed(3)} · célula ${(v.zoom * CELL).toFixed(1)}px · origem ${v.x.toFixed(0)},${v.y.toFixed(0)}`
}

pinta('p-fit', 390, 844, (v) => v)
pinta('p-max', 390, 844, () => fitView(390, 844))
pinta('l-fit', 844, 390, (v) => v)
pinta('d-fit', 1440, 900, (v) => v)

;(window as unknown as { __ready: boolean }).__ready = true
