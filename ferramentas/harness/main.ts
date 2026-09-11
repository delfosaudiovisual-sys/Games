import { FIELD_H, FIELD_W } from '../build/game/content'
import { buildBackground, drawEnemy, drawTower, render } from '../build/game/render'
import { PAPER, INK } from '../build/game/palette'
import { MockEngine } from './mock'
import { ENEMY_DEFS, ENEMY_ORDER, MAPS, TOWER_ORDER } from './fixtures'
import type { Enemy, Tower, TowerStats } from '../build/game/types'

const TIME = 3.1
const cv = (id: string) => document.getElementById(id) as HTMLCanvasElement

function populated(mapId = 'jardim') {
  const e = new MockEngine(MAPS[mapId])
  e.time = TIME
  e.wave = 3
  e.addTower('faisca', 1, 3, 3, -0.6); e.addTower('gelido', 3, 2, 3)
  e.addTower('estilhaco', 6, 3, 3, 0.4); e.addTower('voltaico', 4, 3, 3)
  e.addTower('alquimico', 6, 5, 5); e.addTower('lanca', 9, 3, 3, -1.2); e.addTower('farol', 10, 4, 3)
  e.addEnemy(ENEMY_DEFS.rastejante, 120); e.addEnemy(ENEMY_DEFS.corredor, 260)
  e.addEnemy(ENEMY_DEFS.couracado, 420); e.addEnemy(ENEMY_DEFS.arcano, 560, { shield: 60, maxShield: 76 })
  e.addEnemy(ENEMY_DEFS.curandeiro, 700); e.addEnemy(ENEMY_DEFS.divisor, 880)
  e.addEnemy(ENEMY_DEFS.lamina, 1040); e.addEnemy(ENEMY_DEFS.espectro, 300)
  e.addEnemy(ENEMY_DEFS.devorador, 1200)
  return e
}

// A — partida real
{
  const e = populated()
  render(cv('play').getContext('2d')!, e as never, buildBackground(e as never),
    { hover: null, buildChoice: null, meteorAim: false, pointer: null, guide: false })
}
// B — primeiro contato
{
  const e = new MockEngine(MAPS.jardim); e.time = TIME
  render(cv('first').getContext('2d')!, e as never, buildBackground(e as never),
    { hover: null, buildChoice: null, meteorAim: false, pointer: null, guide: true })
}
// C — escolhendo torre
{
  const e = populated()
  render(cv('build').getContext('2d')!, e as never, buildBackground(e as never),
    { hover: [9, 5], buildChoice: 'faisca', meteorAim: false, pointer: null, guide: false })
}
// D — torres nv1/nv5
{
  const ctx = cv('towers').getContext('2d')!
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 1000, 300)
  TOWER_ORDER.forEach((id, i) => {
    const cx = 70 + i * 132
    ;[1, 5].forEach((lvl, row) => {
      const cy = 100 + row * 130
      ctx.save(); ctx.strokeStyle = 'rgba(43,36,25,0.3)'; ctx.lineWidth = 1
      ctx.strokeRect(cx - 32.5, cy - 32.5, 64, 64); ctx.restore()
      const t = { uid: i + row * 7 + 1, def: { id }, x: cx, y: cy, level: lvl, angle: -Math.PI / 2,
        recoil: 0, bob: 0.3, targetUid: 1 } as unknown as Tower
      drawTower(ctx, t, { spread: lvl >= 5 ? 4 : 1 } as TowerStats, TIME, false)
    })
    ctx.fillStyle = INK; ctx.font = "700 14px 'Patrick Hand', system-ui"; ctx.textAlign = 'center'
    ctx.fillText(id, cx, 288)
  })
}
// E — inimigos (fundo de estrada, que é onde eles andam)
function enemySheet(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#342d3a'; ctx.fillRect(0, 0, w, h)
  ENEMY_ORDER.forEach((id, i) => {
    const def = ENEMY_DEFS[id]
    const e = { uid: i + 1, def, hp: 1, maxHp: 1, shield: 0, maxShield: 0, x: 70 + i * 128, y: 120,
      angle: 0, phase: i * 0.7, fx: { slowUntil: 0, stunUntil: 0, dotUntil: 0 },
      spawnFlash: 0, hitFlash: 0 } as unknown as Enemy
    drawEnemy(ctx, e, TIME)
    ctx.fillStyle = '#e8ddc5'; ctx.font = "700 13px 'Patrick Hand', system-ui"; ctx.textAlign = 'center'
    ctx.fillText(id, 70 + i * 128, 212)
  })
}
enemySheet(cv("enemies").getContext("2d")!, 1500, 230)

// F — celular 390px
{
  const e = populated()
  const off = document.createElement('canvas'); off.width = FIELD_W; off.height = FIELD_H
  render(off.getContext('2d')!, e as never, buildBackground(e as never),
    { hover: null, buildChoice: null, meteorAim: false, pointer: null, guide: false })
  const m = cv('mobile').getContext('2d')!
  m.imageSmoothingQuality = 'high'; m.drawImage(off, 0, 0, 390, 270)
}
// G — silhuetas puras a 20px: o teste de aceite
{
  const ctx = cv('sil').getContext('2d')!
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 1200, 140)
  const off = document.createElement('canvas'); off.width = 170; off.height = 170
  const octx = off.getContext('2d')!
  ENEMY_ORDER.forEach((id, i) => {
    octx.clearRect(0, 0, 170, 170)
    const def = ENEMY_DEFS[id]
    const e = { uid: i + 1, def, hp: 1, maxHp: 1, shield: 0, maxShield: 0, x: 85, y: 85, angle: 0,
      phase: i * 0.7, fx: { slowUntil: 0, stunUntil: 0, dotUntil: 0 }, spawnFlash: 0, hitFlash: 0 } as unknown as Enemy
    drawEnemy(octx, e, TIME)
    const img = octx.getImageData(0, 0, 170, 170); const d = img.data
    for (let k = 0; k < d.length; k += 4) { if (d[k + 3] > 40) { d[k] = 20; d[k+1] = 16; d[k+2] = 12; d[k+3] = 255 } }
    octx.putImageData(img, 0, 0)
    ctx.drawImage(off, 30 + i * 105, 8, 62, 62)
  })
  TOWER_ORDER.forEach((id, i) => {
    octx.clearRect(0, 0, 170, 170)
    const t = { uid: i + 1, def: { id }, x: 85, y: 95, level: 3, angle: -Math.PI / 2, recoil: 0,
      bob: 0.3, targetUid: 1 } as unknown as Tower
    drawTower(octx, t, { spread: 1 } as TowerStats, TIME, false)
    const img = octx.getImageData(0, 0, 170, 170); const d = img.data
    for (let k = 0; k < d.length; k += 4) { if (d[k + 3] > 40) { d[k] = 20; d[k+1] = 16; d[k+2] = 12; d[k+3] = 255 } }
    octx.putImageData(img, 0, 0)
    ctx.drawImage(off, 30 + i * 105, 74, 62, 62)
  })
}
;(window as unknown as { __ready: boolean }).__ready = true
