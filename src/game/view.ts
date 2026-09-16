import { CELL, FIELD_H, FIELD_W } from './content'

/**
 * A janela de visão sobre o campo.
 *
 * O campo tem proporção fixa de 13×9 (1.444), e uma tela de celular em pé tem
 * 0.46. Encaixar um no outro pela largura dá célula de 30px — o dedo não
 * acerta. Não existe layout que resolva isso: a proporção é a restrição, não a
 * doca. A saída é deixar de mostrar o campo inteiro quando o jogador quiser
 * mirar, e para isso a visão precisa de zoom e deslocamento.
 *
 * `zoom` é px de tela por px de campo. `x`/`y` é o ponto DO CAMPO que aparece
 * no canto superior esquerdo do canvas — guardar a origem em coordenadas de
 * campo é o que faz o arrasto e a pinça serem contas de uma linha, e o que
 * mantém o ponto sob o dedo parado quando o zoom muda.
 */
export interface View {
  zoom: number
  x: number
  y: number
}

/** Teto de zoom: célula de ~102px. Acima disso o mapa deixa de ser mapa. */
export const MAX_ZOOM = 1.6

/** Nunca mostrar menos de 6 das 13 colunas: abaixo disso perde-se o caminho. */
export const MIN_COLS = 6

/** Zoom em que o campo inteiro cabe. Também é o piso: não se afasta mais. */
export function fitZoom(cssW: number, cssH: number): number {
  if (cssW <= 0 || cssH <= 0) return 1
  return Math.min(cssW / FIELD_W, cssH / FIELD_H)
}

/**
 * Mantém o campo na tela.
 *
 * No eixo em que o campo é menor que a viewport ele fica centralizado (a origem
 * vira negativa, e é isso que produz as faixas vazias); no eixo em que é maior,
 * a origem é presa entre 0 e a sobra. Sem isso, arrastar joga o mapa para fora.
 */
export function clampView(v: View, cssW: number, cssH: number): View {
  const min = fitZoom(cssW, cssH)
  const zoom = Math.min(MAX_ZOOM, Math.max(min, v.zoom))
  const visW = cssW / zoom
  const visH = cssH / zoom
  const eixo = (o: number, vis: number, total: number) =>
    vis >= total ? -(vis - total) / 2 : Math.min(Math.max(o, 0), total - vis)
  return { zoom, x: eixo(v.x, visW, FIELD_W), y: eixo(v.y, visH, FIELD_H) }
}

/** Visão do "ver tudo": campo inteiro, centralizado. */
export function fitView(cssW: number, cssH: number): View {
  return clampView({ zoom: fitZoom(cssW, cssH), x: 0, y: 0 }, cssW, cssH)
}

/**
 * Visão de abertura: enche a ALTURA da tela, sem nunca mostrar menos de seis
 * colunas.
 *
 * Abrir no "cabe tudo" era o erro: num celular em pé o campo 13:9 vira uma
 * tira de 270px no meio de 844, e o jogo parece pequeno porque ELE ESTÁ
 * pequeno. Encher a altura resolve isso e mantém as nove fileiras sempre
 * visíveis — o que se perde é largura, e largura se recupera arrastando de
 * lado, ao longo do caminho.
 *
 * Numa tela deitada ou num monitor a regra não muda nada: lá encher a altura
 * já mostra o campo inteiro, e é o maior tamanho possível.
 */
export function defaultView(cssW: number, cssH: number): View {
  if (cssW <= 0 || cssH <= 0) return { zoom: 1, x: 0, y: 0 }
  const encheAltura = cssH / FIELD_H
  const seisColunas = cssW / (MIN_COLS * CELL)
  const zoom = Math.max(fitZoom(cssW, cssH), Math.min(MAX_ZOOM, encheAltura, seisColunas))
  return clampView({ zoom, x: FIELD_W / 2 - cssW / zoom / 2, y: 0 }, cssW, cssH)
}

/** Ponto do canvas (px de CSS, relativo ao canto) para coordenada de campo. */
export function toFieldPt(v: View, cssX: number, cssY: number): { x: number; y: number } {
  return { x: v.x + cssX / v.zoom, y: v.y + cssY / v.zoom }
}

/** Coordenada de campo para ponto do canvas. Inversa exata de `toFieldPt`. */
export function toCanvasPt(v: View, fx: number, fy: number): { x: number; y: number } {
  return { x: (fx - v.x) * v.zoom, y: (fy - v.y) * v.zoom }
}

/** Arrasta a visão por um delta em px de tela. */
export function panView(v: View, dxCss: number, dyCss: number, cssW: number, cssH: number): View {
  return clampView({ zoom: v.zoom, x: v.x - dxCss / v.zoom, y: v.y - dyCss / v.zoom }, cssW, cssH)
}

/**
 * Zoom ancorado: o ponto do campo sob (cssX, cssY) continua sob (cssX, cssY).
 * É o que faz a pinça e o toque duplo parecerem presos ao dedo.
 */
export function zoomAt(
  v: View,
  cssX: number,
  cssY: number,
  factor: number,
  cssW: number,
  cssH: number,
): View {
  const alvo = toFieldPt(v, cssX, cssY)
  const min = fitZoom(cssW, cssH)
  const zoom = Math.min(MAX_ZOOM, Math.max(min, v.zoom * factor))
  return clampView({ zoom, x: alvo.x - cssX / zoom, y: alvo.y - cssY / zoom }, cssW, cssH)
}

/** Zoom do toque duplo quando já se está no "ver tudo": volta para a abertura. */
export function comfortZoom(cssW: number, cssH: number): number {
  return defaultView(cssW, cssH).zoom
}

/** Já está mostrando o campo inteiro? Decide o que o toque duplo faz. */
export function isFitted(v: View, cssW: number, cssH: number): boolean {
  return v.zoom <= fitZoom(cssW, cssH) + 1e-6
}

/** Aplica a visão ao contexto. Tudo depois disso desenha em coords de campo. */
export function applyView(ctx: CanvasRenderingContext2D, v: View, dpr: number): void {
  const k = v.zoom * dpr
  ctx.setTransform(k, 0, 0, k, -v.x * k, -v.y * k)
}
