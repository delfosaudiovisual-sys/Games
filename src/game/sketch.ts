/**
 * Primitivas de desenho à mão para canvas.
 *
 * Regra que não pode ser quebrada: TODO tremido é determinístico, semeado por
 * um número estável (o `uid` da unidade, a célula da grade). Tremido sorteado a
 * cada quadro faz a tela inteira ferver a 60fps e passa mal de olhar. Semeando,
 * a linha parece desenhada à mão e fica parada enquanto o bicho anda.
 *
 * O visual sai de quatro truques baratos:
 *   1. a linha treme e passa do ponto de fechamento (a caneta escapa);
 *   2. o preenchimento usa OUTRA semente, então a cor não bate com o contorno
 *      — é o "pintou fora da linha" que denuncia mão humana;
 *   3. sombra é hachura, nunca degradê;
 *   4. o papel tem grão.
 */

import { INK } from './palette'

export interface Pt {
  x: number
  y: number
}

/* ------------------------------------------------------------------ */
/* ruído determinístico                                                */
/* ------------------------------------------------------------------ */

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Ruído estável em [-1, 1]. */
export function noise(seed: number, i: number): number {
  return hash(seed * 37.13 + i * 17.71) * 2 - 1
}

/* ------------------------------------------------------------------ */
/* geradores de contorno                                               */
/* ------------------------------------------------------------------ */

export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 18, rot = 0): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry })
  }
  return pts
}

export function polyPts(cx: number, cy: number, n: number, r: number, rot = 0): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return pts
}

export function rectPts(x: number, y: number, w: number, h: number): Pt[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
}

/* ------------------------------------------------------------------ */
/* tremido                                                             */
/* ------------------------------------------------------------------ */

/**
 * Reconstrói o contorno com tremor de caneta: cada vértice desloca um pouco e
 * cada segmento ganha um arqueamento perpendicular no meio.
 */
export function wobbled(pts: Pt[], seed: number, amp = 1.15, closed = true): Pt[] {
  const n = pts.length
  if (n < 2) return pts
  const out: Pt[] = []
  const segs = closed ? n : n - 1
  let k = 0
  for (let i = 0; i < segs; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const ax = a.x + noise(seed, k++) * amp
    const ay = a.y + noise(seed, k++) * amp
    out.push({ x: ax, y: ay })

    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 6) continue
    const nx = -dy / len
    const ny = dx / len
    const cuts = Math.min(3, Math.max(1, Math.round(len / 22)))
    for (let s = 1; s <= cuts; s++) {
      const t = s / (cuts + 1)
      const bow = noise(seed, k++) * amp * 0.9
      out.push({ x: a.x + dx * t + nx * bow, y: a.y + dy * t + ny * bow })
    }
  }
  if (!closed) {
    const last = pts[n - 1]
    out.push({ x: last.x + noise(seed, k++) * amp, y: last.y + noise(seed, k++) * amp })
  }
  return out
}

function trace(ctx: CanvasRenderingContext2D, pts: Pt[], closed: boolean, overshoot = 0): void {
  if (!pts.length) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  if (closed) {
    ctx.lineTo(pts[0].x, pts[0].y)
    // a caneta passa do ponto ao fechar
    if (overshoot > 0 && pts.length > 1) {
      const a = pts[0]
      const b = pts[1]
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1
      ctx.lineTo(a.x + ((b.x - a.x) / d) * overshoot, a.y + ((b.y - a.y) / d) * overshoot)
    }
  }
}

export interface SketchOpts {
  fill?: string
  stroke?: string | null
  width?: number
  closed?: boolean
  amp?: number
  /** Passa a caneta duas vezes por cima, como num desenho a lápis. */
  double?: boolean
  /** Deslocamento do preenchimento em relação ao contorno. */
  slip?: number
  /** `null` desenha só o preenchimento, sem contorno. */
  alpha?: number
}

/**
 * Desenha uma forma à mão. O preenchimento usa uma semente diferente do
 * contorno de propósito: é o desencontro que faz parecer pintado à mão.
 */
export function sketch(ctx: CanvasRenderingContext2D, pts: Pt[], seed: number, o: SketchOpts = {}): void {
  const closed = o.closed ?? true
  const amp = o.amp ?? 1.15
  const slip = o.slip ?? 0.9

  if (o.alpha !== undefined) {
    ctx.save()
    ctx.globalAlpha = o.alpha
  }

  if (o.fill) {
    const fillPts = wobbled(pts, seed + 991, amp * 1.25, closed)
    ctx.save()
    ctx.translate(noise(seed, 77) * slip, noise(seed, 78) * slip)
    trace(ctx, fillPts, closed)
    ctx.closePath()
    ctx.fillStyle = o.fill
    ctx.fill()
    ctx.restore()
  }

  if (o.stroke !== null) {
    ctx.strokeStyle = o.stroke ?? INK
    ctx.lineWidth = o.width ?? 2.2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    trace(ctx, wobbled(pts, seed, amp, closed), closed, closed ? 1.6 : 0)
    ctx.stroke()
    if (o.double) {
      ctx.save()
      ctx.globalAlpha = (o.alpha ?? 1) * 0.45
      ctx.lineWidth = (o.width ?? 2.2) * 0.7
      trace(ctx, wobbled(pts, seed + 3557, amp * 1.1, closed), closed, 0)
      ctx.stroke()
      ctx.restore()
    }
  }

  if (o.alpha !== undefined) ctx.restore()
}

/** Traço solto de caneta entre dois pontos. */
export function stroke(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  color = INK,
  width = 2.2,
  amp = 1,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  trace(ctx, wobbled([{ x: x1, y: y1 }, { x: x2, y: y2 }], seed, amp, false), false)
  ctx.stroke()
}

/* ------------------------------------------------------------------ */
/* hachura — a sombra deste jogo                                       */
/* ------------------------------------------------------------------ */

export function hatch(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  seed: number,
  o: { color?: string; angle?: number; gap?: number; width?: number; alpha?: number } = {},
): void {
  const angle = o.angle ?? -Math.PI / 4
  const gap = o.gap ?? 5
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const span = Math.hypot(maxX - minX, maxY - minY) / 2 + 4

  ctx.save()
  ctx.globalAlpha = o.alpha ?? 0.5
  trace(ctx, wobbled(pts, seed, 1, true), true)
  ctx.closePath()
  ctx.clip()
  ctx.strokeStyle = o.color ?? INK
  ctx.lineWidth = o.width ?? 1.1
  ctx.lineCap = 'round'
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let k = 0
  for (let d = -span; d <= span; d += gap) {
    const ox = cx + -dy * d
    const oy = cy + dx * d
    const jitter = noise(seed, k++) * 1.2
    ctx.beginPath()
    ctx.moveTo(ox - dx * span + jitter, oy - dy * span)
    ctx.lineTo(ox + dx * span + jitter, oy + dy * span)
    ctx.stroke()
  }
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* papel                                                               */
/* ------------------------------------------------------------------ */

/** Grão de papel. Roda uma vez, no canvas de fundo em cache. */
export function paperGrain(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 13): void {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const p = i >> 2
    const n = (hash(p * 0.7211) - 0.5) * strength
    d[i] = Math.max(0, Math.min(255, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)
}

/** Fibras longas do papel, bem discretas. */
export function paperFibers(ctx: CanvasRenderingContext2D, w: number, h: number, n = 60): void {
  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  for (let i = 0; i < n; i++) {
    const x = hash(i * 3.11) * w
    const y = hash(i * 7.53) * h
    const a = hash(i * 13.7) * Math.PI * 2
    const len = 12 + hash(i * 19.3) * 46
    stroke(ctx, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, i * 5, INK, 1, 1.6)
  }
  ctx.restore()
}
