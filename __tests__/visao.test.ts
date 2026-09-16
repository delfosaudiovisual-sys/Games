import { describe, expect, it } from 'vitest'
import { CELL, FIELD_H, FIELD_W } from '../src/game/content'
import type { View } from '../src/game/view'
import {
  MAX_ZOOM,
  MIN_COLS,
  defaultView,
  clampView,
  comfortZoom,
  fitView,
  fitZoom,
  isFitted,
  panView,
  toCanvasPt,
  toFieldPt,
  zoomAt,
} from '../src/game/view'

/**
 * A visão é a peça que eu não consigo testar no navegador desta sessão, e é a
 * que quebra o jogo se errar: um sinal invertido e o toque constrói na casa
 * errada. Então ela é testada pelas propriedades, não por exemplos.
 */

const RETRATO = [390, 844] as const
const PAISAGEM = [844, 390] as const

/**
 * O contrato do clamp, por eixo e independente do outro:
 *   - campo MAIOR que a viewport nesse eixo: ele cobre a viewport inteira,
 *     sem deixar faixa vazia (dá para arrastar);
 *   - campo MENOR: fica centralizado e inteiro visível (não dá para arrastar).
 * No retrato o eixo vertical cai no segundo caso em QUALQUER zoom — 576 px de
 * campo a 1.25 dão 720, e a tela tem 844. É por isso que a âncora do zoom só
 * pode ficar presa ao dedo no eixo que tem para onde andar.
 */
function confere(v: View, w: number, h: number): void {
  const a = toCanvasPt(v, 0, 0)
  const b = toCanvasPt(v, FIELD_W, FIELD_H)
  for (const [ini, fim, tela] of [
    [a.x, b.x, w],
    [a.y, b.y, h],
  ] as const) {
    if (fim - ini > tela + 1e-6) {
      expect(ini).toBeLessThanOrEqual(0.01)
      expect(fim).toBeGreaterThanOrEqual(tela - 0.01)
    } else {
      expect(ini).toBeGreaterThanOrEqual(-0.01)
      expect(fim).toBeLessThanOrEqual(tela + 0.01)
      expect(ini).toBeCloseTo(tela - fim, 4)
    }
  }
}

/** Esse eixo tem para onde andar nesta visão? */
function arrastavel(v: View, tela: number, total: number): boolean {
  return total * v.zoom > tela + 1e-6
}

describe('visão do campo', () => {
  it('o encaixe mostra o campo inteiro e centraliza a sobra', () => {
    for (const [w, h] of [RETRATO, PAISAGEM]) {
      const v = fitView(w, h)
      const a = toCanvasPt(v, 0, 0)
      const b = toCanvasPt(v, FIELD_W, FIELD_H)
      // nada do campo fica fora da tela
      expect(a.x).toBeGreaterThanOrEqual(-0.01)
      expect(a.y).toBeGreaterThanOrEqual(-0.01)
      expect(b.x).toBeLessThanOrEqual(w + 0.01)
      expect(b.y).toBeLessThanOrEqual(h + 0.01)
      // e a sobra é igual dos dois lados
      expect(a.x).toBeCloseTo(w - b.x, 4)
      expect(a.y).toBeCloseTo(h - b.y, 4)
    }
  })

  it('a paisagem em tela cheia dá célula bem maior que o retrato', () => {
    const celula = ([w, h]: readonly [number, number]) => fitZoom(w, h) * CELL
    expect(celula(PAISAGEM)).toBeGreaterThan(celula(RETRATO) * 1.4)
    expect(celula(PAISAGEM)).toBeGreaterThan(42)
  })

  it('ida e volta de coordenada fecha em qualquer visão', () => {
    const vistas = [fitView(...RETRATO), zoomAt(fitView(...RETRATO), 200, 400, 2.5, ...RETRATO)]
    for (const v of vistas) {
      for (const [cx, cy] of [[0, 0], [37, 611], [389, 843]]) {
        const f = toFieldPt(v, cx, cy)
        const volta = toCanvasPt(v, f.x, f.y)
        expect(volta.x).toBeCloseTo(cx, 6)
        expect(volta.y).toBeCloseTo(cy, 6)
      }
    }
  })

  it('o zoom fica preso ao dedo no eixo que tem para onde andar', () => {
    let v = fitView(...RETRATO)
    const [ax, ay] = [140, 500]
    const antes = toFieldPt(v, ax, ay)
    for (const f of [1.3, 1.3, 1.3, 0.7]) {
      v = zoomAt(v, ax, ay, f, ...RETRATO)
      confere(v, ...RETRATO)
      // horizontal: o campo é maior que a tela, então a âncora fica parada
      expect(arrastavel(v, RETRATO[0], FIELD_W)).toBe(true)
      expect(toFieldPt(v, ax, ay).x).toBeCloseTo(antes.x, 4)
      // vertical: sempre cabe inteiro, então o eixo fica centralizado
      expect(arrastavel(v, RETRATO[1], FIELD_H)).toBe(false)
    }
  })

  it('na paisagem a âncora fica parada nos dois eixos quando há zoom', () => {
    let v = zoomAt(fitView(...PAISAGEM), 422, 195, 1.5, ...PAISAGEM)
    const [ax, ay] = [300, 120]
    const antes = toFieldPt(v, ax, ay)
    v = zoomAt(v, ax, ay, 1.2, ...PAISAGEM)
    confere(v, ...PAISAGEM)
    expect(toFieldPt(v, ax, ay).x).toBeCloseTo(antes.x, 4)
    expect(toFieldPt(v, ax, ay).y).toBeCloseTo(antes.y, 4)
  })

  it('não afasta além do campo inteiro nem aproxima além do teto', () => {
    const v = fitView(...RETRATO)
    expect(zoomAt(v, 0, 0, 0.1, ...RETRATO).zoom).toBeCloseTo(fitZoom(...RETRATO), 6)
    expect(zoomAt(v, 0, 0, 99, ...RETRATO).zoom).toBeCloseTo(MAX_ZOOM, 6)
  })

  it('arrastar nunca abre faixa vazia nem perde o campo', () => {
    let v = zoomAt(fitView(...RETRATO), 195, 422, 2.5, ...RETRATO)
    for (const [dx, dy] of [[9999, 9999], [-9999, -9999], [400, -700], [0, 0]]) {
      v = panView(v, dx, dy, ...RETRATO)
      confere(v, ...RETRATO)
    }
    expect(arrastavel(v, RETRATO[0], FIELD_W)).toBe(true)
  })

  it('a visão de abertura enche a altura e mantém as nove fileiras', () => {
    // É o contrato que responde ao "está muito pequeno": a célula mais que
    // dobra em relação ao "cabe tudo", sem esconder nenhuma fileira.
    for (const [w, h] of [RETRATO, [360, 640], PAISAGEM, [1440, 900]] as const) {
      const v = defaultView(w, h)
      confere(v, w, h)
      expect(FIELD_H * v.zoom, `${w}x${h}: fileira cortada`).toBeLessThanOrEqual(h + 0.01)
      expect(v.zoom * CELL, `${w}x${h}: célula pequena`).toBeGreaterThanOrEqual(42)
      const colunas = Math.min(FIELD_W, w / v.zoom) / CELL
      expect(colunas, `${w}x${h}: colunas de menos`).toBeGreaterThanOrEqual(MIN_COLS - 0.01)
    }
  })

  it('a abertura no retrato é bem maior que o "cabe tudo"', () => {
    const abre = defaultView(...RETRATO).zoom * CELL
    const tudo = fitZoom(...RETRATO) * CELL
    expect(abre).toBeGreaterThan(tudo * 2)
    expect(abre).toBeGreaterThan(60)
  })

  it('em tela deitada e no monitor a abertura já mostra o campo inteiro', () => {
    for (const [w, h] of [PAISAGEM, [1440, 900]] as const) {
      const v = defaultView(w, h)
      expect(v.zoom).toBeCloseTo(fitZoom(w, h), 6)
    }
  })

  it('o teto de zoom continua respeitando o clamp', () => {
    const v = zoomAt(defaultView(...RETRATO), 195, 422, 99, ...RETRATO)
    expect(v.zoom).toBeCloseTo(MAX_ZOOM, 6)
    confere(v, ...RETRATO)
  })

  it('arrastar sem zoom não mexe nada: não há para onde ir', () => {
    const v = fitView(...RETRATO)
    const depois = panView(v, 120, -80, ...RETRATO)
    expect(depois).toEqual(v)
  })

  it('o eixo com sobra continua centralizado depois de arrastar', () => {
    confere(panView(fitView(...RETRATO), 0, 300, ...RETRATO), ...RETRATO)
    confere(panView(fitView(...PAISAGEM), 300, 0, ...PAISAGEM), ...PAISAGEM)
  })

  it('isFitted distingue encaixado de aproximado, e o toque duplo aproxima', () => {
    const v = fitView(...RETRATO)
    expect(isFitted(v, ...RETRATO)).toBe(true)
    const perto = zoomAt(v, 100, 100, comfortZoom(...RETRATO) / v.zoom, ...RETRATO)
    expect(isFitted(perto, ...RETRATO)).toBe(false)
    expect(comfortZoom(...RETRATO) * CELL).toBeGreaterThan(50)
  })

  it('clampView tolera viewport degenerada sem gerar NaN', () => {
    const v = clampView({ zoom: 1, x: 0, y: 0 }, 0, 0)
    expect(Number.isFinite(v.zoom)).toBe(true)
    expect(Number.isFinite(v.x)).toBe(true)
    expect(Number.isFinite(v.y)).toBe(true)
  })
})
