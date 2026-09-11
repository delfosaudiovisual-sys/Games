import { CELL, COLS, FIELD_H, FIELD_W, METEOR_RADIUS, ROWS, TOWERS } from './content'
import type { Engine } from './engine'
import type { Enemy, Tower, TowerDef, TowerId, TowerStats } from './types'
import {
  BLOCKED_FILL,
  BLOCKED_HATCH,
  BUILD_NO,
  BUILD_OK,
  CARD_CORE,
  CARD_ENTRY,
  CELL_FREE,
  CELL_FREE_EDGE,
  CORE_LOW,
  CORE_SPECTRUM,
  ENEMY_INK,
  FX_POISON,
  FX_SHIELD,
  FX_SLOW,
  FX_STUN,
  HP_HIGH,
  HP_LOW,
  HP_MID,
  INK,
  INK_FAINT,
  INK_SOFT,
  PAPER_LIGHT,
  CORE_HALO,
  ROAD_FLOW,
  ROAD_RIM,
  TOWER_INK,
  toneOf,
} from './palette'
import { ellipsePts, hatch, noise, paperFibers, paperGrain, polyPts, rectPts, sketch, stroke, wobbled } from './sketch'
import type { Pt } from './sketch'

export interface RenderOptions {
  hover: [number, number] | null
  buildChoice: TowerId | null
  meteorAim: boolean
  pointer: { x: number; y: number } | null
  guide: boolean
}

const FONT = "700 17px 'Patrick Hand', 'Baloo 2', system-ui, sans-serif"
const FONT_SM = "400 12px 'Inter', system-ui, sans-serif"

/** Quanto tempo os rótulos de campo ficam na tela antes de sumir. */
const LABEL_HOLD = 6.5
const LABEL_FADE = 1.5

/* ------------------------------------------------------------------ */
/* rosto — exclusivo dos inimigos                                      */
/* ------------------------------------------------------------------ */

type Mood = 'dopey' | 'wide' | 'mean' | 'angry' | 'happy' | 'smug' | 'sleepy'
type MouthType = 'smile' | 'frown' | 'flat' | 'open' | 'smug' | 'fangs'

function drawFace(
  ctx: CanvasRenderingContext2D,
  y: number,
  r: number,
  pupil: string,
  mood: Mood,
  mouth: MouthType,
  blink: number,
  look: number,
  seed: number,
): void {
  const spread = r * 0.38
  const er = Math.max(3.4, r * 0.25)

  for (const s of [-1, 1] as const) {
    const ex = s * spread
    if (mood === 'sleepy') {
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(ex, y, er * 0.95, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
      continue
    }
    const h = mood === 'mean' ? er * 0.66 : er
    sketch(ctx, ellipsePts(ex, y, er, h * blink, 11), seed + s * 13, {
      fill: PAPER_LIGHT,
      width: 1.7,
      amp: 0.55,
      slip: 0.4,
    })
    if (blink > 0.4) {
      ctx.fillStyle = pupil
      ctx.beginPath()
      ctx.arc(ex + look, y + h * 0.1, Math.min(er, h) * 0.52, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.arc(ex + look, y + h * 0.1, Math.min(er, h) * 0.27, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (mood === 'angry' || mood === 'mean') {
    for (const s of [-1, 1] as const) {
      stroke(ctx, s * (spread + er * 1.15), y - er * 1.75, s * (spread - er * 0.75), y - er * 0.8, seed + s * 31, INK, 2.4, 0.7)
    }
  }

  const my = y + r * 0.56
  const mw = Math.max(8, r * 0.46)
  if (mouth === 'open' || mouth === 'fangs') {
    sketch(ctx, ellipsePts(0, my, mw * 0.42, mw * 0.36, 10), seed + 57, {
      fill: '#2f2028',
      width: 1.7,
      amp: 0.5,
    })
    if (mouth === 'fangs') {
      ctx.fillStyle = PAPER_LIGHT
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.moveTo(i * mw * 0.24 - mw * 0.08, my - mw * 0.33)
        ctx.lineTo(i * mw * 0.24 + mw * 0.08, my - mw * 0.33)
        ctx.lineTo(i * mw * 0.24, my - mw * 0.03)
        ctx.closePath()
        ctx.fill()
      }
    }
    return
  }
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (mouth === 'smile') ctx.arc(0, my - mw * 0.3, mw * 0.5, Math.PI * 0.18, Math.PI * 0.82)
  else if (mouth === 'frown') ctx.arc(0, my + mw * 0.5, mw * 0.5, Math.PI * 1.22, Math.PI * 1.78)
  else if (mouth === 'flat') {
    ctx.moveTo(-mw * 0.38, my)
    ctx.lineTo(mw * 0.38, my)
  } else {
    ctx.moveTo(-mw * 0.36, my - mw * 0.06)
    ctx.quadraticCurveTo(0, my + mw * 0.4, mw * 0.4, my - mw * 0.14)
  }
  ctx.stroke()
}

/** Lente das torres. Substitui o rosto: viva, mas claramente máquina. */
function lens(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, seed: number, glow = 1): void {
  sketch(ctx, ellipsePts(x, y, r, r, 12), seed, { fill: color, width: 2, amp: 0.6, slip: 0.5 })
  ctx.save()
  ctx.globalAlpha = 0.85 * glow
  ctx.fillStyle = PAPER_LIGHT
  ctx.beginPath()
  ctx.arc(x - r * 0.28, y - r * 0.3, r * 0.34, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* fundo em cache                                                      */
/* ------------------------------------------------------------------ */

export function buildBackground(engine: Engine): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = FIELD_W
  cv.height = FIELD_H
  const ctx = cv.getContext('2d')!
  const tone = toneOf(engine.map.id)

  /* ---- a folha ---- */
  ctx.fillStyle = tone.paper
  ctx.fillRect(0, 0, FIELD_W, FIELD_H)

  const vig = ctx.createRadialGradient(FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.35, FIELD_W / 2, FIELD_H / 2, FIELD_W * 0.72)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(90,70,40,0.20)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, FIELD_W, FIELD_H)

  paperGrain(ctx, FIELD_W, FIELD_H, 14)
  paperFibers(ctx, FIELD_W, FIELD_H, 70)

  /* ---- células ---- */
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (engine.isPath(c, r)) continue
      const x = c * CELL
      const y = r * CELL
      const seed = c * 71 + r * 137

      // Plataforma de torre: uma das ~16 posições preparadas do mapa. Só elas
      // são construíveis, então cada uma merece ser desenhada como um lugar,
      // não como mais um ladrilho de um tabuleiro inteiro ladrilhado.
      if (engine.padCells.has(`${c},${r}`)) {
        ctx.save()
        ctx.globalAlpha = 0.16
        ctx.fillStyle = INK
        ctx.beginPath()
        ctx.ellipse(x + CELL / 2, y + CELL - 12, 22, 6, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        sketch(ctx, rectPts(x + 7, y + 7, CELL - 14, CELL - 14), seed, {
          fill: CELL_FREE,
          stroke: INK_SOFT,
          width: 2.2,
          amp: 1.4,
          slip: 1,
          double: true,
        })
        // cantoneiras: marcam "preparado para receber alguma coisa"
        const k = 11
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
          const px = x + CELL / 2 + sx * (CELL / 2 - 11)
          const py = y + CELL / 2 + sy * (CELL / 2 - 11)
          stroke(ctx, px, py, px - sx * k, py, seed + sx + sy * 3, CELL_FREE_EDGE, 1.8, 0.6)
          stroke(ctx, px, py, px, py - sy * k, seed + sx * 5 + sy, CELL_FREE_EDGE, 1.8, 0.6)
        }
      } else if (engine.blocked.has(`${c},${r}`)) {
        // Pedra: mancha hachurada a lápis.
        const blob = ellipsePts(x + CELL / 2, y + CELL / 2, CELL * 0.38, CELL * 0.34, 12)
        sketch(ctx, blob, seed + 5, { fill: BLOCKED_FILL, stroke: INK_SOFT, width: 1.8, amp: 2.2 })
        hatch(ctx, blob, seed + 9, { color: BLOCKED_HATCH, angle: -Math.PI / 3.4, gap: 5.5, alpha: 0.55 })
      }
      // Terreno aberto não recebe nada: é papel. A ausência de marca é o que
      // diz "aqui não se constrói", sem precisar de mais um ícone.
    }
  }

  /* ---- estrada: aguada de nanquim derramada na folha ---- */
  const pts = engine.path
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const trace = (spread: number) => {
    ctx.beginPath()
    let k = 0
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const steps = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 26))
      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        ctx.lineTo(a.x + (b.x - a.x) * t + noise(4021, k++) * spread, a.y + (b.y - a.y) * t + noise(4021, k++) * spread)
      }
    }
  }

  // borda molhada, mais clara, escapando da faixa
  ctx.strokeStyle = tone.roadEdge
  ctx.lineWidth = CELL * 0.94
  trace(2.6)
  ctx.stroke()
  // corpo da tinta
  ctx.strokeStyle = tone.road
  ctx.lineWidth = CELL * 0.78
  trace(1.6)
  ctx.stroke()
  // acúmulo escuro no centro, onde a tinta encharcou
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = ROAD_RIM
  ctx.lineWidth = CELL * 0.34
  trace(2.2)
  ctx.stroke()
  ctx.restore()

  // respingos ao redor da aguada
  ctx.fillStyle = tone.road
  for (let d = 20; d < engine.totalLen; d += 34) {
    const p = engine.posAt(d, false)
    const q = engine.posAt(d + 8, false)
    const a = Math.atan2(q.y - p.y, q.x - p.x)
    const side = ((d / 34) % 2 === 0 ? 1 : -1) * (CELL * 0.42 + Math.abs(noise(77, d)) * 7)
    const sx = p.x + Math.cos(a + Math.PI / 2) * side
    const sy = p.y + Math.sin(a + Math.PI / 2) * side
    const rr = 1.4 + Math.abs(noise(91, d)) * 2.6
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(sx, sy, rr, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /* ---- praça do núcleo ---- */
  const [cc, cr] = engine.coreCell
  const cx = cc * CELL + CELL / 2
  const cy = cr * CELL + CELL / 2
  const dais = polyPts(cx, cy, 6, CELL * 1.32, Math.PI / 6)
  sketch(ctx, dais, 613, { fill: tone.paperShade, stroke: INK, width: 3, amp: 2, double: true })
  hatch(ctx, dais, 617, { color: INK_FAINT, angle: Math.PI / 3, gap: 7, alpha: 0.45 })
  sketch(ctx, polyPts(cx, cy, 6, CELL * 0.98, Math.PI / 6), 619, { stroke: INK_SOFT, width: 1.4, amp: 1.6 })
  sketch(ctx, polyPts(cx, cy, 6, CELL * 0.66, Math.PI / 6), 623, { stroke: INK_FAINT, width: 1.2, amp: 1.4 })

  /* ---- decoração: pedras grandes a lápis ---- */
  for (const [c, r] of engine.map.decor) {
    const x = c * CELL + CELL / 2
    const y = r * CELL + CELL / 2
    const seed = c * 313 + r * 179
    const rock: Pt[] = [
      { x, y: y - 24 },
      { x: x + 17, y: y - 5 },
      { x: x + 12, y: y + 19 },
      { x: x - 12, y: y + 19 },
      { x: x - 18, y: y - 6 },
    ]
    ctx.save()
    ctx.globalAlpha = 0.22
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.ellipse(x, y + 21, 20, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    sketch(ctx, rock, seed, { fill: tone.stone, width: 2.6, amp: 1.6 })
    hatch(ctx, rock, seed + 3, { color: BLOCKED_HATCH, angle: -Math.PI / 3, gap: 5, alpha: 0.5 })
  }

  /* ---- portão de entrada ---- */
  ctx.save()
  ctx.translate(engine.entrance.x, engine.entrance.y)
  ctx.rotate(engine.entranceAngle)
  for (const s of [-1, 1] as const) {
    const py = s * (CELL * 0.46)
    sketch(ctx, rectPts(-11, py - 15, 22, 30), 800 + s * 7, { fill: tone.stone, width: 2.4, amp: 1.5 })
    stroke(ctx, -7, py - 8, 7, py - 8, 810 + s, INK_SOFT, 1.8, 0.8)
    stroke(ctx, -7, py + 2, 7, py + 2, 812 + s, INK_SOFT, 1.8, 0.8)
  }
  ctx.restore()

  return cv
}

/* ------------------------------------------------------------------ */
/* torres — máquinas de lápis de cor, sem rosto                        */
/* ------------------------------------------------------------------ */

function plinth(ctx: CanvasRenderingContext2D, def: TowerDef, level: number, seed: number): void {
  const c = TOWER_INK[def.id]
  ctx.save()
  ctx.globalAlpha = 0.2
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.ellipse(0, 20, 23, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const base: Pt[] = [
    { x: -20, y: 8 },
    { x: 20, y: 8 },
    { x: 16, y: 21 },
    { x: -16, y: 21 },
  ]
  sketch(ctx, base, seed, { fill: c.body[1], width: 2.4, amp: 1.1 })
  hatch(ctx, base, seed + 2, { color: 'rgba(43,36,25,0.45)', angle: -Math.PI / 3, gap: 4.5, alpha: 0.4 })

  for (let i = 0; i < 5; i++) {
    const px = (i - 2) * 7
    ctx.fillStyle = i < level ? c.lens : 'rgba(43,36,25,0.25)'
    ctx.beginPath()
    ctx.arc(px, 15.5, 2.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawTower(
  ctx: CanvasRenderingContext2D,
  t: Tower,
  s: TowerStats,
  time: number,
  selected: boolean,
): void {
  const def = t.def
  const c = TOWER_INK[def.id]
  const [c1, c2] = c.body
  const seed = t.uid * 97 + 11
  const bob = Math.sin(t.bob) * 1.6
  const pulse = 0.72 + 0.28 * Math.abs(Math.sin(time * 1.6 + t.uid))

  ctx.save()
  ctx.translate(t.x, t.y + bob)

  if (selected) {
    ctx.save()
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.lineDashOffset = -time * 22
    ctx.beginPath()
    ctx.arc(0, 0, 31, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  plinth(ctx, def, t.level, seed)
  const recoil = t.recoil * 4

  switch (def.id) {
    /* caixa baixa + dois canos: metralha */
    case 'faisca': {
      ctx.save()
      ctx.rotate(t.angle + Math.PI / 2)
      ctx.translate(0, recoil)
      const barrels = Math.min(4, Math.max(2, Math.round(s.spread)))
      for (let i = 0; i < barrels; i++) {
        const off = (i - (barrels - 1) / 2) * (barrels > 2 ? 7 : 10)
        sketch(ctx, rectPts(off - 2.2, -42, 4.4, 30), seed + 20 + i, { fill: c2, width: 2, amp: 0.8 })
      }
      ctx.restore()
      sketch(ctx, rectPts(-18, -12, 36, 20), seed + 1, { fill: c1, width: 2.6, amp: 1.2 })
      hatch(ctx, rectPts(-18, -12, 36, 20), seed + 3, { color: 'rgba(43,36,25,0.4)', angle: -Math.PI / 3, gap: 5, alpha: 0.28 })
      lens(ctx, 0, -2, 6.5, c.lens, seed + 4, pulse)
      break
    }

    /* tambor + funil grosso: morteiro */
    case 'estilhaco': {
      sketch(ctx, ellipsePts(0, -4, 21, 15, 14), seed + 1, { fill: c1, width: 2.6, amp: 1.3 })
      ctx.save()
      ctx.rotate(t.angle + Math.PI / 2)
      ctx.translate(0, recoil)
      sketch(ctx, [{ x: -7, y: -6 }, { x: 7, y: -6 }, { x: 16, y: -38 }, { x: -16, y: -38 }], seed + 21, {
        fill: c1,
        width: 2.6,
        amp: 1.1,
      })
      sketch(ctx, ellipsePts(0, -38, 16, 5.5, 14), seed + 22, { fill: c2, width: 2.4, amp: 0.9 })
      sketch(ctx, ellipsePts(0, -37, 10, 3.2, 12), seed + 23, { fill: '#241a12', width: 1.6, amp: 0.7 })
      ctx.restore()
      hatch(ctx, ellipsePts(0, -4, 21, 15, 14), seed + 3, { color: 'rgba(43,36,25,0.4)', angle: Math.PI / 3, gap: 5, alpha: 0.26 })
      lens(ctx, 0, -3, 5.5, c.lens, seed + 4, pulse)
      break
    }

    /* espinho alto e estreito: cristal */
    case 'gelido': {
      const spire: Pt[] = [
        { x: 0, y: -46 },
        { x: 12, y: -16 },
        { x: 8, y: 10 },
        { x: -8, y: 10 },
        { x: -12, y: -16 },
      ]
      sketch(ctx, spire, seed + 1, { fill: c1, width: 2.6, amp: 1.2 })
      sketch(ctx, [{ x: 0, y: -42 }, { x: 7, y: -16 }, { x: 0, y: 6 }], seed + 2, {
        fill: PAPER_LIGHT,
        stroke: 'rgba(43,36,25,0.3)',
        width: 1.2,
        amp: 1,
        alpha: 0.5,
      })
      hatch(ctx, [{ x: 0, y: -46 }, { x: -12, y: -16 }, { x: -8, y: 10 }, { x: 0, y: 6 }], seed + 3, {
        color: 'rgba(43,36,25,0.45)',
        angle: Math.PI / 2.6,
        gap: 4.5,
        alpha: 0.35,
      })
      for (let i = 0; i < 3; i++) {
        const a = time * 1.1 + (i / 3) * Math.PI * 2
        const sx = Math.cos(a) * 24
        const sy = Math.sin(a) * 8 - 12
        sketch(ctx, [{ x: sx, y: sy - 5 }, { x: sx + 4, y: sy }, { x: sx, y: sy + 5 }, { x: sx - 4, y: sy }], seed + 30 + i, {
          fill: i % 2 ? c1 : PAPER_LIGHT,
          width: 1.6,
          amp: 0.6,
        })
      }
      lens(ctx, 0, -20, 5, c.lens, seed + 4, pulse)
      break
    }

    /* pirâmide de anéis + esfera: bobina */
    case 'voltaico': {
      for (let i = 0; i < 3; i++) {
        const y = 8 - i * 11
        const w = 22 - i * 5
        sketch(ctx, ellipsePts(0, y, w, 5.5, 14), seed + 10 + i, { fill: i % 2 ? c2 : c1, width: 2.2, amp: 0.9 })
      }
      ctx.save()
      ctx.globalAlpha = 0.9
      for (let i = 0; i < 3; i++) {
        const a = time * 4.5 + (i / 3) * Math.PI * 2
        stroke(ctx, 0, -30, Math.cos(a) * 18, -30 + Math.sin(a) * 18, seed + 40 + i, c.lens, 2, 1.6)
      }
      ctx.restore()
      sketch(ctx, ellipsePts(0, -30, 13, 13, 15), seed + 2, { fill: c1, width: 2.6, amp: 1.1 })
      lens(ctx, 0, -30, 6, c.lens, seed + 4, pulse)
      break
    }

    /* frasco de fundo redondo com gargalo torto: alquimia */
    case 'alquimico': {
      ctx.save()
      ctx.rotate(-0.28)
      sketch(ctx, rectPts(-5, -44, 10, 22), seed + 12, { fill: c2, width: 2.2, amp: 0.9 })
      sketch(ctx, rectPts(-7, -47, 14, 6), seed + 13, { fill: c2, width: 2, amp: 0.8 })
      ctx.restore()
      const flask = ellipsePts(0, -8, 18, 17, 16)
      sketch(ctx, flask, seed + 1, { fill: c1, width: 2.6, amp: 1.2 })
      ctx.save()
      {
        ctx.beginPath()
        const w = wobbled(flask, seed + 991, 1.4, true)
        ctx.moveTo(w[0].x, w[0].y)
        for (let i = 1; i < w.length; i++) ctx.lineTo(w[i].x, w[i].y)
        ctx.closePath()
        ctx.clip()
      }
      ctx.fillStyle = c2
      const lvl = -2 + Math.sin(time * 1.8) * 2
      ctx.fillRect(-22, lvl, 44, 30)
      ctx.restore()
      stroke(ctx, -14, -2 + Math.sin(time * 1.8) * 2, 14, -2 + Math.sin(time * 1.8 + 0.7) * 2, seed + 50, 'rgba(43,36,25,0.5)', 1.6, 1.2)
      for (let i = 0; i < 3; i++) {
        const p = (time * 1.2 + i * 0.33) % 1
        ctx.save()
        ctx.globalAlpha = (1 - p) * 0.8
        ctx.fillStyle = c.lens
        ctx.beginPath()
        ctx.arc(Math.sin(i * 2 + time) * 6, -30 - p * 14, 2.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      lens(ctx, -6, -14, 4.5, c.lens, seed + 4, pulse)
      break
    }

    /* luneta comprida sobre tripé: precisão */
    case 'lanca': {
      for (const a of [-0.75, 0, 0.75]) {
        stroke(ctx, 0, -4, Math.sin(a) * 17, 12 + Math.cos(a) * 3, seed + 60 + a * 10, c2, 3.4, 0.9)
      }
      ctx.save()
      ctx.rotate(t.angle + Math.PI / 2)
      ctx.translate(0, recoil)
      sketch(ctx, rectPts(-5.5, -44, 11, 40), seed + 11, { fill: c1, width: 2.6, amp: 1 })
      sketch(ctx, ellipsePts(0, -44, 8, 5, 12), seed + 12, { fill: c.lens, width: 2.2, amp: 0.8 })
      ctx.restore()
      sketch(ctx, ellipsePts(0, -4, 11, 9, 13), seed + 1, { fill: c2, width: 2.4, amp: 1 })
      lens(ctx, 0, -4, 4.5, c.lens, seed + 4, pulse)
      break
    }

    /* lanterna em poste alargado: suporte */
    case 'farol': {
      const sweep = time * 1.2
      ctx.save()
      ctx.translate(0, -30)
      ctx.rotate(sweep)
      ctx.globalAlpha = 0.42
      ctx.fillStyle = c.lens
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(58, -16)
      ctx.lineTo(58, 16)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      const post: Pt[] = [
        { x: -5, y: -18 },
        { x: 5, y: -18 },
        { x: 13, y: 12 },
        { x: -13, y: 12 },
      ]
      sketch(ctx, post, seed + 1, { fill: c1, width: 2.6, amp: 1.2 })
      hatch(ctx, post, seed + 3, { color: 'rgba(43,36,25,0.4)', angle: -Math.PI / 3, gap: 5, alpha: 0.3 })
      sketch(ctx, rectPts(-11, -40, 22, 22), seed + 2, { fill: c2, width: 2.6, amp: 1 })
      sketch(ctx, [{ x: -14, y: -40 }, { x: 14, y: -40 }, { x: 0, y: -52 }], seed + 5, {
        fill: c1,
        width: 2.4,
        amp: 0.9,
      })
      lens(ctx, 0, -29, 7, c.lens, seed + 4, pulse)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        stroke(ctx, Math.cos(a) * 9, -29 + Math.sin(a) * 9, Math.cos(a) * 13, -29 + Math.sin(a) * 13, seed + 70 + i, c.lens, 1.8, 0.5)
      }
      break
    }
  }
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* inimigos — borrões de nanquim, com rosto                            */
/* ------------------------------------------------------------------ */

const MOODS: Record<string, [Mood, MouthType]> = {
  rastejante: ['dopey', 'open'],
  corredor: ['wide', 'open'],
  couracado: ['mean', 'flat'],
  espectro: ['wide', 'open'],
  arcano: ['angry', 'flat'],
  curandeiro: ['happy', 'smile'],
  divisor: ['dopey', 'smug'],
  cria: ['wide', 'open'],
  lamina: ['mean', 'fangs'],
  devorador: ['angry', 'fangs'],
  tita: ['angry', 'fangs'],
}

/** Silhueta própria de cada inimigo. É o que precisa sobreviver a 13px. */
function enemyBody(id: string, r: number, boss: boolean): Pt[] {
  switch (id) {
    /* baixo e largo, espalhado no chão */
    case 'rastejante':
      return ellipsePts(0, r * 0.1, r * 1.16, r * 0.78, 15)
    /* gota inclinada para a frente */
    case 'corredor':
      return [
        { x: r * 1.45, y: r * 0.05 },
        { x: r * 0.55, y: -r * 0.72 },
        { x: -r * 0.35, y: -r * 0.9 },
        { x: -r * 0.95, y: -r * 0.25 },
        { x: -r * 0.8, y: r * 0.55 },
        { x: r * 0.1, y: r * 0.9 },
        { x: r * 0.85, y: r * 0.55 },
      ]
    /* casco chapado, trapézio de ombros largos */
    case 'couracado':
      return [
        { x: -r * 0.62, y: -r * 1.05 },
        { x: r * 0.62, y: -r * 1.05 },
        { x: r * 1.18, y: -r * 0.45 },
        { x: r * 1.05, y: r * 0.68 },
        { x: -r * 1.05, y: r * 0.68 },
        { x: -r * 1.18, y: -r * 0.45 },
      ]
    /* corpo vertical de fantasma, barra esfarrapada embaixo */
    case 'espectro':
      return [
        { x: 0, y: -r * 1.05 },
        { x: r * 0.72, y: -r * 0.5 },
        { x: r * 0.68, y: r * 0.5 },
        { x: r * 0.34, y: r * 0.95 },
        { x: 0, y: r * 0.55 },
        { x: -r * 0.34, y: r * 0.95 },
        { x: -r * 0.68, y: r * 0.5 },
        { x: -r * 0.72, y: -r * 0.5 },
      ]
    /* hexágono: o escudo É a silhueta */
    case 'arcano':
      return polyPts(0, 0, 6, r * 0.98, Math.PI / 6)
    /* corpo com entalhe real, em cima e embaixo: já vem rachado */
    case 'divisor':
    case 'cria': {
      const p: Pt[] = []
      const n = 16
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2
        const notch = Math.abs(Math.cos(a)) < 0.2 ? 0.62 : 1
        p.push({ x: Math.cos(a) * r * notch, y: Math.sin(a) * r * 0.95 * notch })
      }
      return p
    }
    /* ponta de flecha virada para a frente */
    case 'lamina':
      return [
        { x: r * 1.2, y: 0 },
        { x: r * 0.25, y: -r * 0.85 },
        { x: -r * 0.85, y: -r * 0.6 },
        { x: -r * 0.6, y: 0 },
        { x: -r * 0.85, y: r * 0.6 },
        { x: r * 0.25, y: r * 0.85 },
      ]
    default:
      return boss ? polyPts(0, 0, 9, r, 0) : ellipsePts(0, 0, r, r * 0.94, 15)
  }
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
  const def = e.def
  const r = def.radius
  const c = ENEMY_INK[def.id]
  const seed = e.uid * 131 + 7
  const slowed = time < e.fx.slowUntil
  const stunned = time < e.fx.stunUntil
  const poisoned = time < e.fx.dotUntil
  const [mood, mouth] = MOODS[def.id] ?? ['dopey', 'flat']
  const blink = Math.abs(Math.sin(time * 0.8 + e.uid)) > 0.97 ? 0.1 : 1
  const look = Math.max(-2.2, Math.min(2.2, Math.cos(e.angle) * 2.2))
  const lineW = Math.max(1.8, r * 0.1)

  ctx.save()
  ctx.translate(e.x, e.y)
  if (e.spawnFlash > 0) ctx.globalAlpha = Math.max(0.2, 1 - e.spawnFlash * 1.6)

  ctx.save()
  ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.24
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.ellipse(0, def.flying ? r + 16 : r * 0.85, r * 0.8, r * 0.26, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (def.flying) ctx.translate(0, -10 + Math.sin(e.phase) * 4)

  /* pernas */
  if (def.legs > 0 && !def.flying) {
    const long = def.id === 'corredor'
    for (let i = 0; i < def.legs; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const idx = Math.floor(i / 2)
      const bx = side * r * 0.5
      const by = r * 0.12 + idx * (r * 0.26)
      const swing = Math.sin(e.phase + i * 1.2) * r * (long ? 0.48 : 0.28)
      const kx = bx + side * r * (long ? 0.5 : 0.4)
      const ky = by + r * (long ? 0.62 : 0.5)
      const fx = bx + side * r * (long ? 0.62 : 0.58) + swing
      const fy = by + r * (long ? 1.15 : 0.95)
      stroke(ctx, bx, by, kx, ky, seed + i * 17, INK, lineW * 1.5, 0.6)
      stroke(ctx, kx, ky, fx, fy, seed + i * 17 + 5, INK, lineW * 1.5, 0.6)
      stroke(ctx, bx, by, kx, ky, seed + i * 17 + 9, c.body[1], lineW * 0.8, 0.6)
      stroke(ctx, kx, ky, fx, fy, seed + i * 17 + 13, c.body[1], lineW * 0.8, 0.6)
    }
  }

  /* asas */
  if (def.flying) {
    const flap = Math.sin(e.phase * 3) * 0.5
    for (const side of [-1, 1] as const) {
      ctx.save()
      ctx.scale(side, 1)
      ctx.rotate(flap * 0.3)
      sketch(ctx, [
        { x: r * 0.4, y: -r * 0.35 },
        { x: r * 1.5, y: -r * 1.0 - flap * 7 },
        { x: r * 2.0, y: -r * 0.1 },
        { x: r * 1.35, y: r * 0.05 },
        { x: r * 1.5, y: r * 0.5 },
        { x: r * 0.85, y: r * 0.15 },
        { x: r * 0.6, y: r * 0.45 },
      ], seed + 200 + side * 9, { fill: c.body[0], width: lineW, amp: 1.4, alpha: 0.92 })
      ctx.restore()
    }
  }

  /* corpo */
  const body = enemyBody(def.id, r, def.boss)
  const squash = 1 + Math.sin(e.phase * 2) * 0.04
  ctx.save()
  ctx.scale(1 / squash, squash)
  sketch(ctx, body, seed, { fill: c.body[0], width: lineW * (def.boss ? 1.5 : 1.2), amp: r * 0.07, double: def.boss })
  hatch(ctx, body, seed + 3, { color: c.body[1], angle: -Math.PI / 3.2, gap: Math.max(3.5, r * 0.2), alpha: 0.42 })
  ctx.restore()

  /* marcas de espécie */
  if (def.id === 'couracado') {
    for (let i = -1; i <= 1; i++) {
      stroke(ctx, i * r * 0.5, -r * 0.95, i * r * 0.5 + r * 0.1, r * 0.7, seed + 60 + i, INK, lineW * 0.9, 0.7)
    }
  }
  if (def.id === 'lamina') {
    for (const s of [-1, 1] as const) {
      sketch(ctx, [
        { x: s * r * 0.2, y: s * -r * 0.5 },
        { x: s * r * 1.0, y: -r * 1.35 },
        { x: s * r * 0.75, y: -r * 0.25 },
      ], seed + 70 + s * 4, { fill: c.lens, width: lineW * 0.9, amp: 0.8 })
    }
  }
  if (def.id === 'corredor') {
    for (let i = -1; i <= 1; i++) {
      const y = i * r * 0.45
      stroke(ctx, -r * (1.15 + Math.abs(i) * 0.1), y, -r * (1.7 + Math.abs(i) * 0.2), y, seed + 50 + i, c.body[1], 1.8, 0.9)
    }
  }
  if (def.id === 'divisor' || def.id === 'cria') {
    stroke(ctx, 0, -r * 0.9, 0, r * 0.9, seed + 80, INK, lineW * 1.1, 1.4)
  }
  if (def.id === 'arcano') {
    sketch(ctx, polyPts(0, 0, 6, r * 1.28, Math.PI / 6), seed + 90, {
      stroke: FX_SHIELD,
      width: e.shield > 0 ? 2.6 : 1.2,
      amp: 1.6,
      alpha: e.shield > 0 ? 0.9 : 0.35,
    })
  }
  if (def.heal) {
    sketch(ctx, ellipsePts(0, -r - 13, r * 0.55, r * 0.18, 12), seed + 95, {
      stroke: '#9ac9a4',
      width: 2.2,
      amp: 0.7,
    })
    stroke(ctx, 0, -r * 0.1, 0, r * 0.42, seed + 96, PAPER_LIGHT, lineW * 1.3, 0.5)
    stroke(ctx, -r * 0.26, r * 0.16, r * 0.26, r * 0.16, seed + 97, PAPER_LIGHT, lineW * 1.3, 0.5)
  }
  if (def.boss) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42
      ctx.save()
      ctx.rotate(a)
      sketch(ctx, [{ x: 0, y: -r - 15 }, { x: 7, y: -r + 3 }, { x: -7, y: -r + 3 }], seed + 100 + i, {
        fill: c.body[0],
        width: 2.2,
        amp: 1,
      })
      ctx.restore()
    }
  }

  drawFace(ctx, -r * 0.16, r, c.lens, stunned ? 'sleepy' : mood, mouth, blink, look, seed)

  /* estados */
  if (slowed) {
    sketch(ctx, ellipsePts(0, 0, r * 1.16, r * 1.16, 14), seed + 300, {
      fill: 'rgba(127,184,204,0.22)',
      stroke: FX_SLOW,
      width: 1.8,
      amp: 1.6,
    })
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + time
      stroke(ctx, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35, seed + 310 + i, FX_SLOW, 1.8, 0.8)
    }
  }
  if (poisoned) {
    for (let i = 0; i < 3; i++) {
      const p = (time * 1.3 + i * 0.33) % 1
      ctx.save()
      ctx.globalAlpha = 0.8 * (1 - p)
      ctx.fillStyle = FX_POISON
      ctx.beginPath()
      ctx.arc(Math.sin(i * 3 + time * 2) * r * 0.55, -r - p * 18, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
  if (stunned) {
    for (let i = 0; i < 3; i++) {
      const a = time * 4 + (i / 3) * Math.PI * 2
      const sx = Math.cos(a) * (r + 10)
      const sy = -r - 9 + Math.sin(a) * 5
      const star: Pt[] = []
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2 - Math.PI / 2
        const rad = k % 2 === 0 ? 5 : 2.1
        star.push({ x: sx + Math.cos(ang) * rad, y: sy + Math.sin(ang) * rad })
      }
      sketch(ctx, star, seed + 320 + i, { fill: FX_STUN, width: 1.4, amp: 0.5 })
    }
  }
  if (e.shield > 0 && def.id !== 'arcano') {
    sketch(ctx, ellipsePts(0, 0, r + 8, r + 8, 16), seed + 330, {
      stroke: FX_SHIELD,
      width: 2.2,
      amp: 1.4,
      alpha: 0.4 + 0.5 * (e.shield / Math.max(1, e.maxShield)),
    })
  }
  if (e.hitFlash > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.7, e.hitFlash * 4)
    ctx.fillStyle = PAPER_LIGHT
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()

  /* barra de vida, colada no bicho */
  const ratio = Math.max(0, e.hp / e.maxHp)
  if (ratio < 1 || e.shield > 0 || def.boss) {
    const w = Math.max(30, r * 1.9)
    const x = e.x - w / 2
    const y = e.y - r - (def.flying ? 32 : 18)
    sketch(ctx, rectPts(x - 1.5, y - 1.5, w + 3, 8), e.uid * 7 + 1, {
      fill: 'rgba(246,239,221,0.88)',
      width: 1.6,
      amp: 0.5,
    })
    ctx.fillStyle = ratio > 0.55 ? HP_HIGH : ratio > 0.25 ? HP_MID : HP_LOW
    ctx.fillRect(x, y, w * ratio, 5)
    if (e.maxShield > 0) {
      sketch(ctx, rectPts(x - 1.5, y - 9.5, w + 3, 7), e.uid * 7 + 2, {
        fill: 'rgba(246,239,221,0.88)',
        width: 1.6,
        amp: 0.5,
      })
      ctx.fillStyle = FX_SHIELD
      ctx.fillRect(x, y - 8, w * (e.shield / e.maxShield), 3.5)
    }
  }
}

/* ------------------------------------------------------------------ */
/* núcleo e rótulos                                                    */
/* ------------------------------------------------------------------ */

function drawCore(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, ratio: number): void {
  ctx.save()
  ctx.translate(x, y)
  const pulse = 1 + Math.sin(time * 2) * 0.06

  ctx.save()
  ctx.globalAlpha = 0.75
  const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 86 * pulse)
  glow.addColorStop(0, CORE_HALO)
  glow.addColorStop(1, 'rgba(255,246,214,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(0, 0, 86 * pulse, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.rotate(time * 0.35)
  const gem: Pt[] = [
    { x: 0, y: -42 },
    { x: 30, y: -13 },
    { x: 20, y: 33 },
    { x: -20, y: 33 },
    { x: -30, y: -13 },
  ]
  sketch(ctx, gem, 4242, { fill: CORE_SPECTRUM[1], width: 3.6, amp: 1.5, double: true })
  sketch(ctx, [{ x: 0, y: -38 }, { x: 17, y: -11 }, { x: 0, y: 29 }], 4243, {
    fill: CORE_SPECTRUM[0],
    stroke: 'rgba(43,36,25,0.4)',
    width: 1.6,
    amp: 1,
  })
  sketch(ctx, [{ x: 0, y: -38 }, { x: -17, y: -11 }, { x: 0, y: 29 }], 4244, {
    fill: CORE_SPECTRUM[2],
    stroke: 'rgba(43,36,25,0.4)',
    width: 1.6,
    amp: 1,
  })
  ctx.save()
  ctx.globalAlpha = 0.5 + Math.sin(time * 2) * 0.18
  ctx.fillStyle = PAPER_LIGHT
  ctx.beginPath()
  ctx.moveTo(0, -30)
  ctx.lineTo(9, -10)
  ctx.lineTo(0, 16)
  ctx.lineTo(-9, -10)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  ctx.restore()

  sketch(ctx, ellipsePts(0, 0, 50, 50, 26), 4245, { stroke: 'rgba(43,36,25,0.25)', width: 6, amp: 1.2 })
  ctx.strokeStyle = ratio > 0.4 ? CORE_SPECTRUM[0] : CORE_LOW
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, 0, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, ratio))
  ctx.stroke()
  ctx.restore()
}

/** Cartão de papel pregado no campo. */
function card(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fill: string,
  text2: string,
  alpha: number,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = Math.max(ctx.measureText(text).width, ctx.measureText(text2).width * 0.86) + 26
  const h = 44
  // trava nas DUAS bordas — antes só existia do lado direito e o balão
  // da ENTRADA saía cortado da tela.
  const cx = Math.max(w / 2 + 6, Math.min(FIELD_W - w / 2 - 6, x))
  const cy = Math.max(h / 2 + 6, y)

  ctx.save()
  ctx.globalAlpha = alpha * 0.2
  ctx.fillStyle = INK
  ctx.fillRect(cx - w / 2 + 3, cy - h / 2 + 4, w, h)
  ctx.restore()

  sketch(ctx, rectPts(cx - w / 2, cy - h / 2, w, h), 5150, { fill, width: 2.4, amp: 1.6 })
  ctx.fillStyle = INK
  ctx.font = FONT
  ctx.fillText(text, cx, cy - 8)
  ctx.font = FONT_SM
  ctx.fillStyle = 'rgba(43,36,25,0.8)'
  ctx.fillText(text2, cx, cy + 12)
  ctx.restore()
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, size: number, alpha: number): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(angle)
  sketch(ctx, [
    { x: size, y: 0 },
    { x: -size * 0.7, y: -size * 0.75 },
    { x: -size * 0.32, y: 0 },
    { x: -size * 0.7, y: size * 0.75 },
  ], 5200, { fill: color, width: 2.2, amp: 0.8 })
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* frame                                                               */
/* ------------------------------------------------------------------ */

export function render(
  ctx: CanvasRenderingContext2D,
  engine: Engine,
  bg: HTMLCanvasElement,
  opts: RenderOptions,
): void {
  const time = engine.time
  ctx.save()
  if (engine.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * engine.shake, (Math.random() - 0.5) * engine.shake)
  }
  ctx.clearRect(-30, -30, FIELD_W + 60, FIELD_H + 60)
  ctx.drawImage(bg, 0, 0)

  /* corrente escorrendo pela estrada: ensina a direção sem uma palavra */
  ctx.save()
  ctx.lineCap = 'round'
  const step = CELL * 0.85
  const offset = (time * 78) % step
  for (let d = offset; d < engine.totalLen - 6; d += step) {
    const p = engine.posAt(d, false)
    const q = engine.posAt(Math.min(engine.totalLen, d + 15), false)
    const fade = Math.min(1, d / 90)
    ctx.globalAlpha = 0.5 * fade
    ctx.strokeStyle = ROAD_FLOW
    ctx.lineWidth = 3.4
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }
  ctx.restore()

  /* ao escolher torre: escurecer o que NÃO dá, em vez de pintar 70 células */
  if (opts.buildChoice) {
    // Um único véu sobre a folha inteira, furado nas células livres. Um furo
    // só de verdade lê melhor que 70 retângulos escuros lado a lado, e o olho
    // vai direto para onde dá para construir.
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, FIELD_W, FIELD_H)
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!engine.isBuildable(c, r)) continue
        ctx.rect(c * CELL + 4, r * CELL + 4, CELL - 8, CELL - 8)
      }
    }
    ctx.fillStyle = 'rgba(28,22,14,0.46)'
    ctx.fill('evenodd')
    ctx.restore()
  } else if (opts.guide) {
    // primeiro contato: um pulso suave só nas células livres
    // São ~16 plataformas, não 70 células: dá para realçar cada uma de verdade.
    const pulse = 0.5 + Math.sin(time * 2.6) * 0.35
    ctx.save()
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!engine.isBuildable(c, r)) continue
        sketch(ctx, rectPts(c * CELL + 6, r * CELL + 6, CELL - 12, CELL - 12), c * 31 + r * 17, {
          fill: 'rgba(111,158,63,0.18)',
          stroke: BUILD_OK,
          width: 2.4,
          amp: 1.4,
          alpha: Math.max(0.15, pulse),
        })
      }
    }
    ctx.restore()
  }

  if (engine.synergyLinks.length) {
    ctx.save()
    ctx.lineWidth = 2.4
    ctx.setLineDash([4, 7])
    ctx.lineDashOffset = -time * 30
    for (const [x1, y1, x2, y2, color] of engine.synergyLinks) {
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.65
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
    ctx.restore()
  }

  if (opts.hover) {
    const [c, r] = opts.hover
    const x = c * CELL
    const y = r * CELL
    const ok = engine.isBuildable(c, r)
    const existing = engine.towerAt(c, r)
    if (opts.buildChoice && !existing) {
      const st = engine.rawStats(TOWERS[opts.buildChoice], 1, null)
      const range = st.range * engine.mods.rangeMul
      if (range > 0) {
        sketch(ctx, ellipsePts(x + CELL / 2, y + CELL / 2, range, range, 40), 6001, {
          fill: ok ? 'rgba(111,158,63,0.12)' : 'rgba(180,69,63,0.12)',
          stroke: ok ? BUILD_OK : BUILD_NO,
          width: 2.2,
          amp: 2.4,
        })
      }
      if (st.auraRange > 0) {
        sketch(ctx, ellipsePts(x + CELL / 2, y + CELL / 2, st.auraRange * engine.mods.rangeMul, st.auraRange * engine.mods.rangeMul, 34), 6002, {
          stroke: TOWER_INK.farol.body[0],
          width: 2,
          amp: 2.2,
        })
      }
    }
    sketch(ctx, rectPts(x + 4, y + 4, CELL - 8, CELL - 8), 6003, {
      stroke: ok ? BUILD_OK : BUILD_NO,
      width: 3.2,
      amp: 1.8,
    })
    if (!ok && !existing) {
      stroke(ctx, x + 20, y + 20, x + CELL - 20, y + CELL - 20, 6004, BUILD_NO, 3.4, 1.2)
      stroke(ctx, x + CELL - 20, y + 20, x + 20, y + CELL - 20, 6005, BUILD_NO, 3.4, 1.2)
    }
  }

  const sel = engine.selectedTowerUid !== null ? engine.towers.find((t) => t.uid === engine.selectedTowerUid) : null
  if (sel) {
    const s = engine.statsOf(sel)
    if (s.range > 0) {
      sketch(ctx, ellipsePts(sel.x, sel.y, s.range, s.range, 40), 6100, {
        fill: 'rgba(43,36,25,0.07)',
        stroke: 'rgba(43,36,25,0.5)',
        width: 2,
        amp: 2.4,
      })
    }
    if (s.auraRange > 0) {
      sketch(ctx, ellipsePts(sel.x, sel.y, s.auraRange, s.auraRange, 34), 6101, {
        stroke: TOWER_INK.farol.body[0],
        width: 2,
        amp: 2.2,
      })
    }
  }

  drawCore(ctx, engine.core.x, engine.core.y, time, engine.lives / Math.max(1, engine.maxLives))

  for (const t of engine.towers) drawTower(ctx, t, engine.statsOf(t), time, t.uid === engine.selectedTowerUid)

  const sorted = [...engine.enemies].sort((a, b) => (a.def.flying ? 1 : 0) - (b.def.flying ? 1 : 0))
  for (const e of sorted) drawEnemy(ctx, e, time)

  /* projéteis */
  for (const p of engine.projectiles) {
    if (p.trail.length > 1) {
      ctx.save()
      ctx.strokeStyle = p.color
      ctx.globalAlpha = 0.35
      ctx.lineWidth = p.kind === 'mortar' ? 4 : 2.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(p.trail[0][0], p.trail[0][1])
      for (const [tx, ty] of p.trail) ctx.lineTo(tx, ty)
      ctx.stroke()
      ctx.restore()
    }
    const size = p.kind === 'mortar' ? 7 : p.kind === 'orb' ? 6.5 : 4.5
    sketch(ctx, ellipsePts(p.x, p.y, size, size, 9), p.uid * 13, {
      fill: p.crit ? FX_STUN : p.color,
      width: 1.8,
      amp: 0.7,
    })
  }

  /* feixes */
  for (const b of engine.beams) {
    const a = b.life / b.max
    ctx.save()
    ctx.globalAlpha = a * 0.5
    ctx.strokeStyle = b.color
    ctx.lineWidth = b.width * a * 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(b.pts[0], b.pts[1])
    for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1])
    ctx.stroke()
    ctx.globalAlpha = a
    ctx.strokeStyle = PAPER_LIGHT
    ctx.lineWidth = b.width * a
    ctx.stroke()
    ctx.restore()
  }

  /* partículas */
  for (const p of engine.particles) {
    const a = Math.max(0, p.life / p.maxLife)
    ctx.save()
    ctx.globalAlpha = a
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.arc(p.x, p.y, (1 - a) * 32 + 4, 0, Math.PI * 2)
      ctx.stroke()
    } else if (p.kind === 'shard') {
      ctx.fillStyle = p.color
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle + (1 - a) * 6)
      ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8)
    } else {
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
  ctx.globalAlpha = 1

  /* ---- ensino: some sozinho ---- */
  const fresh = engine.towers.length === 0 && engine.wave === 0
  const labelAge = time - LABEL_HOLD
  const labelAlpha = fresh ? 1 : Math.max(0, 1 - labelAge / LABEL_FADE)

  if (labelAlpha > 0.01) {
    const bounce = Math.sin(time * 3) * 4
    arrow(ctx, engine.entrance.x + 26, engine.entrance.y - 40 + bounce, Math.PI / 2, CARD_ENTRY, 11, labelAlpha)
    card(ctx, engine.entrance.x + 48, engine.entrance.y - 78, 'ENTRADA', CARD_ENTRY, 'eles saem daqui', labelAlpha)

    // fora da praça do núcleo, para não sentar em cima dele
    arrow(ctx, engine.core.x, engine.core.y - 96 - bounce, Math.PI / 2, CARD_CORE, 12, labelAlpha)
    card(ctx, engine.core.x - 30, engine.core.y - 130, 'NÚCLEO', CARD_CORE, 'proteja com a vida', labelAlpha)
  }

  /* fantasma percorrendo o caminho: mostra o trajeto em vez de escrevê-lo */
  if (fresh) {
    const lap = 3.4
    const t01 = (time % lap) / lap
    const gp = engine.posAt(t01 * engine.totalLen, false)
    const fade = Math.sin(t01 * Math.PI)
    ctx.save()
    for (let k = 1; k <= 4; k++) {
      const back = engine.posAt(Math.max(0, (t01 * engine.totalLen) - k * 26), false)
      ctx.globalAlpha = 0.16 * fade * (1 - k / 5)
      ctx.fillStyle = ENEMY_INK.rastejante.body[1]
      ctx.beginPath()
      ctx.arc(back.x, back.y, 6 - k * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 0.82 * fade
    sketch(ctx, ellipsePts(gp.x, gp.y, 16, 14, 13), 7001, { fill: ENEMY_INK.rastejante.body[0], width: 2.2, amp: 1.4 })
    drawFaceGhost(ctx, gp.x, gp.y)
    ctx.restore()
  }

  /* textos flutuantes */
  ctx.textAlign = 'center'
  for (const t of engine.texts) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, t.life)
    ctx.font = `700 ${t.size}px 'Patrick Hand', 'Baloo 2', system-ui, sans-serif`
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.strokeStyle = INK
    ctx.strokeText(t.text, t.x, t.y)
    ctx.fillStyle = t.color
    ctx.fillText(t.text, t.x, t.y)
    ctx.restore()
  }

  if (opts.meteorAim && opts.pointer) {
    const { x, y } = opts.pointer
    sketch(ctx, ellipsePts(x, y, METEOR_RADIUS, METEOR_RADIUS, 36), 7100, {
      fill: 'rgba(224,140,62,0.16)',
      stroke: TOWER_INK.estilhaco.body[0],
      width: 2.6,
      amp: 2.6,
    })
    stroke(ctx, x - 20, y, x + 20, y, 7101, TOWER_INK.estilhaco.body[0], 2.4, 1)
    stroke(ctx, x, y - 20, x, y + 20, 7102, TOWER_INK.estilhaco.body[0], 2.4, 1)
  }

  ctx.restore()
}

function drawFaceGhost(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  drawFace(ctx, -2, 15, ENEMY_INK.rastejante.lens, 'dopey', 'open', 1, 0, 7002)
  ctx.restore()
}
