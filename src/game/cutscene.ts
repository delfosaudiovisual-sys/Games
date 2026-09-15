import { CELL, FIELD_H, FIELD_W } from './content'
import {
  CORE_SPECTRUM,
  INK,
  INK_FAINT,
  INK_SOFT,
  PAPER_LIGHT,
  toneOf,
} from './palette'
import type { MapTone } from './palette'
import {
  ellipsePts,
  hatch,
  noise,
  paperFibers,
  paperGrain,
  polyPts,
  rectPts,
  sketch,
  stroke,
  wobbled,
} from './sketch'
import type { Pt } from './sketch'
import type { MapDef } from './types'

/**
 * Abertura animada de cada capítulo.
 *
 * Desenha no mesmo vocabulário do jogo — papel, nanquim, tremido determinístico
 * — porque uma cinemática em outra linguagem visual pareceria enxerto. E anima
 * a tinta escorrendo pelo caminho REAL do mapa, então a cena também ensina o
 * traçado antes da primeira onda.
 *
 * Um compasso (`Beat`) é sempre "o estado da cena no progresso t", nunca um
 * delta. O player chama os compassos anteriores com t=1 e o atual com o t dele,
 * o que dá acumulação sem guardar estado entre quadros — e deixa a cena
 * rebobinável de graça.
 */

const FONTE = "700 27px 'Patrick Hand', 'Baloo 2', system-ui, sans-serif"
const FONTE_MIN = "700 15px 'Patrick Hand', 'Baloo 2', system-ui, sans-serif"

/* ------------------------------------------------------------------ */
/* trilha do mapa                                                      */
/* ------------------------------------------------------------------ */

export interface Trilha {
  pts: Pt[]
  total: number
  /** Ponto a uma distância `d` do início, em pixels de campo. */
  at(d: number): Pt
  /** Sub-polilinha cobrindo a primeira fração `p` do percurso. */
  ate(p: number): Pt[]
}

function trilhaDe(map: MapDef): Trilha {
  const pts = map.waypoints.map(([c, r]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }))
  const cum = [0]
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    cum.push(total)
  }
  const at = (d: number): Pt => {
    if (d <= 0) return pts[0]
    if (d >= total) return pts[pts.length - 1]
    let i = 1
    while (i < cum.length && cum[i] < d) i++
    const a = pts[i - 1]
    const b = pts[i]
    const seg = cum[i] - cum[i - 1]
    const t = seg === 0 ? 0 : (d - cum[i - 1]) / seg
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }
  const ate = (p: number): Pt[] => {
    const alvo = Math.max(0, Math.min(1, p)) * total
    const out: Pt[] = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      if (cum[i] <= alvo) out.push(pts[i])
      else break
    }
    if (alvo > 0) out.push(at(alvo))
    return out
  }
  return { pts, total, at, ate }
}

/* ------------------------------------------------------------------ */
/* palco                                                               */
/* ------------------------------------------------------------------ */

export interface Palco {
  papel: HTMLCanvasElement
  trilha: Trilha
  tone: MapTone
  map: MapDef
}

/** Monta o papel de fundo uma vez. `paperGrain` varre cada pixel: não serve por quadro. */
export function montarPalco(map: MapDef): Palco {
  const tone = toneOf(map.id)
  const cv = document.createElement('canvas')
  cv.width = FIELD_W
  cv.height = FIELD_H
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = tone.paper
  ctx.fillRect(0, 0, FIELD_W, FIELD_H)
  const vig = ctx.createRadialGradient(FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.3, FIELD_W / 2, FIELD_H / 2, FIELD_W * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(90,70,40,0.24)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, FIELD_W, FIELD_H)
  paperGrain(ctx, FIELD_W, FIELD_H, 14)
  paperFibers(ctx, FIELD_W, FIELD_H, 70)
  return { papel: cv, trilha: trilhaDe(map), tone, map }
}

/* ------------------------------------------------------------------ */
/* primitivas de cena                                                  */
/* ------------------------------------------------------------------ */

const suave = (t: number): number => t * t * (3 - 2 * t)
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t))
/** Recorta uma janela [a,b] do progresso e devolve 0..1 dentro dela. */
const janela = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a))

/** A aguada de nanquim sobre uma polilinha, no mesmo empilhamento do tabuleiro. */
function tinta(ctx: CanvasRenderingContext2D, pts: Pt[], tone: MapTone, escala = 1): void {
  if (pts.length < 2) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const traco = (spread: number) => {
    ctx.beginPath()
    let k = 0
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const passos = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 26))
      for (let s = 1; s <= passos; s++) {
        const t = s / passos
        ctx.lineTo(
          a.x + (b.x - a.x) * t + noise(4021, k++) * spread,
          a.y + (b.y - a.y) * t + noise(4021, k++) * spread,
        )
      }
    }
  }
  ctx.strokeStyle = tone.roadEdge
  ctx.lineWidth = CELL * 0.94 * escala
  traco(2.6)
  ctx.stroke()
  ctx.strokeStyle = tone.road
  ctx.lineWidth = CELL * 0.78 * escala
  traco(1.6)
  ctx.stroke()
  ctx.restore()
}

/** Borrão de tinta: mancha tremida com alguns respingos em volta. */
function borrao(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, cor: string): void {
  if (r <= 0.5) return
  sketch(ctx, ellipsePts(cx, cy, r, r * 0.92, 16), seed, { fill: cor, stroke: null, amp: r * 0.16 })
  for (let i = 0; i < 5; i++) {
    const a = noise(seed, i * 3) * Math.PI
    const d = r * (1.15 + Math.abs(noise(seed, i * 3 + 1)) * 0.5)
    const rr = r * (0.06 + Math.abs(noise(seed, i * 3 + 2)) * 0.12)
    ctx.fillStyle = cor
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** O Prisma. `desenho` revela o contorno; `cor` preenche as facetas. */
function prisma(ctx: CanvasRenderingContext2D, x: number, y: number, esc: number, desenho: number, cor: number): void {
  const gema: Pt[] = [
    { x: 0, y: -42 },
    { x: 30, y: -13 },
    { x: 20, y: 33 },
    { x: -20, y: 33 },
    { x: -30, y: -13 },
  ].map((p) => ({ x: x + p.x * esc, y: y + p.y * esc }))

  if (cor > 0.01) {
    ctx.save()
    ctx.globalAlpha = cor
    sketch(ctx, gema, 4242, { fill: CORE_SPECTRUM[1], stroke: null, amp: 1.5 })
    const meia = (dir: number, c: string) =>
      sketch(ctx, [
        { x, y: y - 38 * esc },
        { x: x + dir * 17 * esc, y: y - 11 * esc },
        { x, y: y + 29 * esc },
      ], 4243 + dir, { fill: c, stroke: null, amp: 1 })
    meia(1, CORE_SPECTRUM[0])
    meia(-1, CORE_SPECTRUM[2])
    ctx.restore()
  }

  // Contorno revelado progressivamente: a caneta passando pela gema.
  if (desenho > 0.01) {
    const w = wobbled(gema, 4242, 1.5, true)
    const n = Math.max(2, Math.floor(w.length * clamp01(desenho)))
    ctx.save()
    ctx.strokeStyle = INK
    ctx.lineWidth = 3.4
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(w[0].x, w[0].y)
    for (let i = 1; i < n; i++) ctx.lineTo(w[i].x, w[i].y)
    ctx.stroke()
    ctx.restore()
  }
}

/** Quebra o texto em no máximo duas linhas que cabem em `maxW`. */
function quebrar(ctx: CanvasRenderingContext2D, texto: string, maxW: number): string[] {
  if (ctx.measureText(texto).width <= maxW) return [texto]
  const palavras = texto.split(' ')
  let corte = palavras.length - 1
  // procura o corte que deixa as duas linhas mais parecidas
  let melhor = Infinity
  for (let i = 1; i < palavras.length; i++) {
    const a = ctx.measureText(palavras.slice(0, i).join(' ')).width
    const b = ctx.measureText(palavras.slice(i).join(' ')).width
    if (Math.max(a, b) <= maxW && Math.abs(a - b) < melhor) {
      melhor = Math.abs(a - b)
      corte = i
    }
  }
  return [palavras.slice(0, corte).join(' '), palavras.slice(corte).join(' ')]
}

/** Legenda no pé da cena, num cartão de papel. */
function legenda(ctx: CanvasRenderingContext2D, texto: string, alpha: number): void {
  if (alpha <= 0.01 || !texto) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = FONTE
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const maxW = FIELD_W - 120
  const linhas = quebrar(ctx, texto, maxW)
  const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width))
  const w = Math.min(FIELD_W - 44, larg + 52)
  const h = linhas.length > 1 ? 82 : 56
  const cx = FIELD_W / 2
  const cy = FIELD_H - 20 - h / 2 + (1 - suave(alpha)) * 10

  ctx.save()
  ctx.globalAlpha = alpha * 0.2
  ctx.fillStyle = INK
  ctx.fillRect(cx - w / 2 + 3, cy - h / 2 + 4, w, h)
  ctx.restore()
  sketch(ctx, rectPts(cx - w / 2, cy - h / 2, w, h), 9100, { fill: PAPER_LIGHT, width: 2.6, amp: 1.7 })
  ctx.fillStyle = INK
  ctx.font = FONTE
  linhas.forEach((l, i) => {
    ctx.fillText(l, cx, cy + 1 + (i - (linhas.length - 1) / 2) * 32)
  })
  ctx.restore()
}

/** Marca d'água com o nome do ato, no alto. */
function cabecalho(ctx: CanvasRenderingContext2D, ato: string, nome: string, alpha: number): void {
  if (alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK_SOFT
  ctx.font = FONTE_MIN
  ctx.fillText(ato.toUpperCase(), FIELD_W / 2, 34)
  ctx.fillStyle = INK
  ctx.font = "700 40px 'Patrick Hand', 'Baloo 2', system-ui, sans-serif"
  ctx.fillText(nome, FIELD_W / 2, 70)
  const meia = Math.min(150, ctx.measureText(nome).width / 2 + 14)
  stroke(ctx, FIELD_W / 2 - meia, 92, FIELD_W / 2 + meia, 92, 9200, INK_FAINT, 2.6, 1.5)
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* contrato dos compassos                                              */
/* ------------------------------------------------------------------ */

export interface Beat {
  dur: number
  texto: string
  /** Estado da cena no progresso `t` (0..1). Nunca um delta. */
  draw: (ctx: CanvasRenderingContext2D, t: number, p: Palco, tempo: number) => void
}

export interface Cena {
  ato: string
  nome: string
  beats: Beat[]
}

/* ------------------------------------------------------------------ */
/* ato I — A Margem                                                    */
/* ------------------------------------------------------------------ */

/** Silhueta de bicho de tinta, usada nos fantasmas e no que a Mancha copia. */
function bicho(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, cor: string, espinhos: number, alpha = 1, olhos = 0): void {
  ctx.save()
  ctx.globalAlpha = alpha
  const corpo = ellipsePts(x, y, r, r * 0.9, 14)
  for (let i = 0; i < espinhos; i++) {
    const a = -Math.PI / 2 + (i - (espinhos - 1) / 2) * 0.45
    sketch(ctx, [
      { x: x + Math.cos(a) * (r + r * 0.5), y: y + Math.sin(a) * (r + r * 0.5) },
      { x: x + Math.cos(a - 0.14) * r * 0.95, y: y + Math.sin(a - 0.14) * r * 0.95 },
      { x: x + Math.cos(a + 0.14) * r * 0.95, y: y + Math.sin(a + 0.14) * r * 0.95 },
    ], seed + i * 7, { fill: cor, width: 2, amp: 0.8 })
  }
  sketch(ctx, corpo, seed, { fill: cor, width: 2.6, amp: r * 0.09 })
  for (const s of [-1, 1] as const) {
    stroke(ctx, x + s * r * 0.45, y + r * 0.6, x + s * r * 0.8, y + r * 1.25, seed + 40 + s, INK, 3.4, 0.7)
  }
  // Os olhos abrindo são o sinal de que aquilo deixou de ser borrão e virou bicho.
  if (olhos > 0.01) {
    const er = r * 0.26 * Math.min(1, olhos * 1.4)
    for (const s of [-1, 1] as const) {
      sketch(ctx, ellipsePts(x + s * r * 0.36, y - r * 0.1, er, er * olhos, 11), seed + 60 + s, {
        fill: PAPER_LIGHT,
        width: 1.8,
        amp: 0.5,
      })
      if (olhos > 0.5) {
        ctx.fillStyle = INK
        ctx.beginPath()
        ctx.arc(x + s * r * 0.36, y - r * 0.08, er * 0.42, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.restore()
}

const ATO_I: Cena = {
  ato: 'Ato I',
  nome: 'A Margem',
  beats: [
    {
      dur: 3.2,
      texto: 'Era só uma página limpa.',
      draw: (ctx, t, p) => {
        const nucleo = p.trilha.pts[p.trilha.pts.length - 1]
        prisma(ctx, nucleo.x, nucleo.y, 1.15, janela(t, 0.08, 0.72), janela(t, 0.62, 1) * 0.45)
      },
    },
    {
      dur: 3.2,
      texto: 'Até alguém derrubar o tinteiro.',
      draw: (ctx, t, p) => {
        const nucleo = p.trilha.pts[p.trilha.pts.length - 1]
        prisma(ctx, nucleo.x, nucleo.y, 1, 1, 0.4)

        const ent = p.trilha.at(CELL * 0.9)
        const queda = janela(t, 0.1, 0.62)
        if (queda < 1) {
          // a gota engorda pendurada na margem e depois cai
          const cresce = janela(t, 0, 0.35)
          const y = -34 + (ent.y + 34) * suave(queda)
          const r = 8 + cresce * 13
          ctx.fillStyle = p.tone.road
          ctx.beginPath()
          ctx.ellipse(ent.x, y, r * 0.85, r * (1 + queda * 0.5), 0, 0, Math.PI * 2)
          ctx.fill()
          if (queda > 0) {
            ctx.strokeStyle = p.tone.road
            ctx.lineWidth = 2.5
            ctx.globalAlpha = 0.5
            ctx.beginPath()
            ctx.moveTo(ent.x, Math.max(-30, y - 40))
            ctx.lineTo(ent.x, y)
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        } else {
          borrao(ctx, ent.x, ent.y, 10 + janela(t, 0.62, 1) * 22, 771, p.tone.road)
        }
      },
    },
    {
      dur: 4.6,
      texto: 'A Mancha não odeia ninguém. Ela apaga.',
      draw: (ctx, t, p) => {
        const ent = p.trilha.at(CELL * 0.9)
        const nucleo = p.trilha.pts[p.trilha.pts.length - 1]
        tinta(ctx, p.trilha.ate(suave(t)), p.tone)
        borrao(ctx, ent.x, ent.y, 32, 771, p.tone.road)
        // a frente da tinta avançando
        const frente = p.trilha.at(suave(t) * p.trilha.total)
        borrao(ctx, frente.x, frente.y, 22, 903, p.tone.road)
        prisma(ctx, nucleo.x, nucleo.y, 1, 1, 0.4)
      },
    },
    {
      dur: 3.8,
      texto: 'Você desenha as defesas. Só nas plataformas.',
      draw: (ctx, t, p) => {
        const nucleo = p.trilha.pts[p.trilha.pts.length - 1]
        tinta(ctx, p.trilha.pts, p.tone)
        const pads = p.map.pads
        pads.forEach(([c, r], i) => {
          const q = janela(t, (i / pads.length) * 0.55, (i / pads.length) * 0.55 + 0.4)
          if (q <= 0.01) return
          const x = c * CELL
          const y = r * CELL
          ctx.save()
          ctx.globalAlpha = q
          sketch(ctx, rectPts(x + 7, y + 7, CELL - 14, CELL - 14), c * 71 + r * 137, {
            fill: 'rgba(255,252,240,0.30)',
            stroke: INK_SOFT,
            width: 2.2,
            amp: 1.4,
          })
          ctx.restore()
        })
        prisma(ctx, nucleo.x, nucleo.y, 1, 1, 0.4 + janela(t, 0.5, 1) * 0.6)
      },
    },
  ],
}

/* ------------------------------------------------------------------ */
/* ato II — A Página Rasgada                                           */
/* ------------------------------------------------------------------ */

/** Onde ficam os desenhos mortos desta página. */
const FANTASMAS: Array<[number, number, number]> = [
  [200, 200, 30],
  [430, 330, 24],
  [610, 170, 27],
]

const ATO_II: Cena = {
  ato: 'Ato II',
  nome: 'A Página Rasgada',
  beats: [
    {
      dur: 2.9,
      texto: 'Você virou a folha.',
      draw: (ctx, t) => {
        // A folha velha desliza para fora, revelando a de baixo.
        const borda = suave(t) * (FIELD_W + 160) - 80
        if (borda < FIELD_W) {
          ctx.save()
          ctx.fillStyle = '#efe7d2'
          ctx.beginPath()
          ctx.moveTo(borda, 0)
          ctx.lineTo(FIELD_W, 0)
          ctx.lineTo(FIELD_W, FIELD_H)
          ctx.lineTo(borda - 60, FIELD_H)
          ctx.closePath()
          ctx.fill()
          // vinco da página levantando
          ctx.strokeStyle = 'rgba(43,36,25,0.45)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(borda, 0)
          ctx.lineTo(borda - 60, FIELD_H)
          ctx.stroke()
          ctx.restore()
        }
      },
    },
    {
      dur: 3.6,
      texto: 'Alguém já desenhou aqui. Não sobrou cor.',
      draw: (ctx, t) => {
        FANTASMAS.forEach(([x, y, r], i) => {
          const q = janela(t, i * 0.18, i * 0.18 + 0.5)
          if (q <= 0.01) return
          ctx.save()
          ctx.globalAlpha = q * 0.55
          bicho(ctx, x, y, r, 500 + i * 31, '#b2a68c', 3)
          hatch(ctx, ellipsePts(x, y, r, r * 0.9, 14), 560 + i, {
            color: 'rgba(43,36,25,0.35)',
            angle: -Math.PI / 3,
            gap: 5,
            alpha: 0.5,
          })
          ctx.restore()
        })
        // o prisma desta página já apagou
        const q = janela(t, 0.45, 1)
        if (q > 0.01) {
          ctx.save()
          ctx.globalAlpha = q * 0.45
          prisma(ctx, 740, 430, 0.85, 1, 0)
          // facetas em cinza: sem elas o contorno vira um pentágono qualquer
          stroke(ctx, 740, 430 - 34, 740, 430 + 25, 9401, 'rgba(43,36,25,0.5)', 2.2, 1.2)
          stroke(ctx, 740, 430 - 34, 740 - 24, 430 - 10, 9402, 'rgba(43,36,25,0.4)', 2, 1.2)
          stroke(ctx, 740, 430 - 34, 740 + 24, 430 - 10, 9403, 'rgba(43,36,25,0.4)', 2, 1.2)
          ctx.restore()
        }
      },
    },
    {
      dur: 4.6,
      texto: 'A Mancha copia o que engole.',
      draw: (ctx, t, p) => {
        const [gx, gy, gr] = FANTASMAS[1]
        const chega = janela(t, 0, 0.4)
        const engole = janela(t, 0.4, 0.68)
        const forma = janela(t, 0.68, 1)

        // o fantasma sendo comido
        if (engole < 1) {
          ctx.save()
          ctx.globalAlpha = 0.55 * (1 - engole)
          bicho(ctx, gx, gy, gr, 531, '#b2a68c', 3)
          ctx.restore()
        }
        // a mancha chegando
        const bx = 60 + (gx - 60) * suave(chega)
        borrao(ctx, bx, gy, 20 + engole * gr * 0.9, 640, p.tone.road)
        // e tomando a forma do que engoliu, abrindo os olhos no fim
        if (forma > 0.01) {
          ctx.save()
          ctx.globalAlpha = forma
          bicho(ctx, gx, gy, gr, 531, p.tone.road, 3, 1, janela(forma, 0.55, 1))
          ctx.restore()
        }
      },
    },
    {
      dur: 3.6,
      texto: 'Ela aprendeu. Agora ela tem forma.',
      draw: (ctx, t, p) => {
        const [gx, gy, gr] = FANTASMAS[1]
        tinta(ctx, p.trilha.ate(suave(t)), p.tone)
        bicho(ctx, gx, gy, gr, 531, p.tone.road, 3, 1, 1)
      },
    },
  ],
}

/* ------------------------------------------------------------------ */
/* ato III — O Tinteiro                                                */
/* ------------------------------------------------------------------ */

const ATO_III: Cena = {
  ato: 'Ato III',
  nome: 'O Tinteiro',
  beats: [
    {
      dur: 3.2,
      texto: 'No fim da pilha, a capa.',
      draw: (ctx, t) => {
        // vidro tombado, desenhado progressivamente
        const q = janela(t, 0.1, 0.95)
        const vidro: Pt[] = [
          { x: 70, y: 210 },
          { x: 150, y: 176 },
          { x: 196, y: 212 },
          { x: 208, y: 300 },
          { x: 150, y: 330 },
          { x: 78, y: 300 },
        ]
        const w = wobbled(vidro, 8801, 1.8, true)
        const n = Math.max(2, Math.floor(w.length * q))
        ctx.save()
        if (q >= 1) sketch(ctx, vidro, 8801, { fill: '#5b5163', width: 3, amp: 1.8 })
        ctx.strokeStyle = INK
        ctx.lineWidth = 3.4
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(w[0].x, w[0].y)
        for (let i = 1; i < n; i++) ctx.lineTo(w[i].x, w[i].y)
        ctx.stroke()
        if (q >= 1) {
          sketch(ctx, polyPts(196, 246, 7, 26, 0.4), 8810, { fill: '#3a3344', width: 2.6, amp: 1.4 })
        }
        ctx.restore()
      },
    },
    {
      dur: 3.6,
      texto: 'O vidro tombado. A primeira mancha.',
      draw: (ctx, t, p) => {
        const jorro = suave(janela(t, 0, 0.55))
        const poca = janela(t, 0.3, 1)
        if (jorro > 0.01) {
          ctx.save()
          ctx.strokeStyle = p.tone.road
          ctx.lineWidth = 16
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(206, 250)
          ctx.quadraticCurveTo(250, 250 + 60 * jorro, 262, 250 + 150 * jorro)
          ctx.stroke()
          ctx.restore()
        }
        borrao(ctx, 268, 404, poca * 62, 8830, p.tone.road)
      },
    },
    {
      dur: 4.2,
      texto: 'Tudo que ela é começou aqui.',
      draw: (ctx, t, p) => {
        const nucleo = p.trilha.pts[p.trilha.pts.length - 1]
        borrao(ctx, 268, 404, 62, 8830, p.tone.road)
        tinta(ctx, p.trilha.ate(suave(t)), p.tone)
        prisma(ctx, nucleo.x, nucleo.y, 0.9, 1, 0.35)
        // cercada
        for (let i = 0; i < 4; i++) {
          const q = janela(t, 0.45 + i * 0.12, 0.45 + i * 0.12 + 0.3)
          if (q <= 0.01) continue
          const a = Math.PI + i * 0.6
          bicho(ctx, nucleo.x + Math.cos(a) * 120, nucleo.y + Math.sin(a) * 96, 20, 900 + i * 13, p.tone.road, 3, q)
        }
      },
    },
    {
      dur: 4.6,
      texto: 'Não dá para apagar a Mancha. Dá para desenhar por cima.',
      draw: (ctx, t, p) => {
        const nucleo = p.trilha.pts[p.trilha.pts.length - 1]
        borrao(ctx, 268, 404, 62, 8830, p.tone.road)
        tinta(ctx, p.trilha.pts, p.tone)
        for (let i = 0; i < 4; i++) {
          const a = Math.PI + i * 0.6
          bicho(ctx, nucleo.x + Math.cos(a) * 120, nucleo.y + Math.sin(a) * 96, 20, 900 + i * 13, p.tone.road, 3)
        }
        prisma(ctx, nucleo.x, nucleo.y, 0.9, 1, 1)

        // A cor avança POR CIMA da tinta: em vez de clarear a tela (o que
        // estourava tudo para branco e apagava o desenho), redesenha a própria
        // estrada em cor dentro do círculo. É literalmente desenhar por cima.
        const raio = suave(janela(t, 0.15, 1)) * FIELD_W * 1.25
        if (raio > 1) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(nucleo.x, nucleo.y, raio, 0, Math.PI * 2)
          ctx.clip()
          tinta(ctx, p.trilha.pts, { ...p.tone, road: CORE_SPECTRUM[1], roadEdge: CORE_SPECTRUM[2] })
          ctx.globalAlpha = 0.16
          const g = ctx.createRadialGradient(nucleo.x, nucleo.y, 0, nucleo.x, nucleo.y, raio)
          g.addColorStop(0, CORE_SPECTRUM[0])
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, FIELD_W, FIELD_H)
          ctx.restore()
          // a crista da onda
          ctx.save()
          ctx.globalAlpha = 0.5 * (1 - janela(t, 0.8, 1))
          sketch(ctx, ellipsePts(nucleo.x, nucleo.y, raio, raio, 40), 9300, {
            stroke: CORE_SPECTRUM[0],
            width: 3.4,
            amp: 2.6,
          })
          ctx.restore()
          // O Prisma volta por cima: a estrada colorida passa em cima dele,
          // e ele é justamente a coisa que não pode desaparecer nesta cena.
          prisma(ctx, nucleo.x, nucleo.y, 0.9 + janela(t, 0.5, 1) * 0.25, 1, 1)
        }
      },
    },
  ],
}

/* ------------------------------------------------------------------ */
/* player                                                              */
/* ------------------------------------------------------------------ */

/** Cenas por id de mapa. Mapa sem cena simplesmente não abre capítulo. */
export const CENAS: Record<string, Cena> = {
  jardim: ATO_I,
  obsidiana: ATO_II,
  cume: ATO_III,
}

export function duracaoCena(c: Cena): number {
  return c.beats.reduce((a, b) => a + b.dur, 0)
}

/**
 * Desenha a cena inteira no tempo `tempo`.
 *
 * Compassos anteriores entram com t=1 e o atual com o t dele: a cena acumula
 * sem guardar estado, então arrastar o tempo para trás também funciona.
 */
export function desenharCena(ctx: CanvasRenderingContext2D, c: Cena, tempo: number, p: Palco): void {
  ctx.clearRect(0, 0, FIELD_W, FIELD_H)
  ctx.drawImage(p.papel, 0, 0)

  let acc = 0
  let atual = 0
  let tLocal = 1
  for (let i = 0; i < c.beats.length; i++) {
    const fim = acc + c.beats[i].dur
    if (tempo < fim) {
      atual = i
      tLocal = clamp01((tempo - acc) / c.beats[i].dur)
      break
    }
    acc = fim
    atual = i
    tLocal = 1
  }

  for (let i = 0; i < atual; i++) c.beats[i].draw(ctx, 1, p, tempo)
  c.beats[atual].draw(ctx, tLocal, p, tempo)

  // O cartão do capítulo é só apresentação: sai antes de a estrada chegar nele.
  const b0 = c.beats[0].dur
  cabecalho(ctx, c.ato, c.nome, janela(tempo, 0.15, 0.9) * (1 - janela(tempo, b0 * 0.72, b0 * 1.02)))
  // a legenda entra e sai dentro do compasso, para não piscar na troca
  const entra = janela(tLocal, 0, 0.12)
  const sai = 1 - janela(tLocal, 0.88, 1)
  legenda(ctx, c.beats[atual].texto, Math.min(entra, sai))
}
