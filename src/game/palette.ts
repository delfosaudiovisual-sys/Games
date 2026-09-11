/**
 * Direção de arte: "papel e nanquim".
 *
 * Regra autoral única, da qual todo o resto decorre:
 *   VOCÊ DESENHA EM COR. A CORRUPÇÃO É NANQUIM.
 *
 * O terreno é papel tonalizado com grão. Você constrói com lápis de cor
 * saturado. A estrada é uma aguada de tinta escura derramada na página, e os
 * inimigos são borrões dessa mesma tinta — dessaturados, sujos, sem cor própria.
 * Fundo claro contra estrada escura inverte a relação antiga (estrada clara
 * sobre terreno escuro), em que a coisa mais brilhante do tabuleiro era
 * justamente a única onde não se pode agir.
 *
 * Este arquivo é a fonte única das cores do canvas. Antes elas estavam
 * espalhadas em ~49 hexadecimais e ~46 rgba() dentro de `render.ts`, o que
 * tornava impossível ajustar direção de arte sem uma caçada. `content.ts` segue
 * intocado: as cores de identidade de cada unidade são sobrepostas aqui.
 */

import type { EnemyId, TowerId } from './types'

/* ------------------------------------------------------------------ */
/* papel e tinta                                                       */
/* ------------------------------------------------------------------ */

export const PAPER = '#e8ddc5'
export const PAPER_LIGHT = '#f4ecda'
export const PAPER_SHADE = '#cdbc98'
export const PAPER_DEEP = '#b9a67f'

/** Contorno. Nunca preto puro — nanquim envelhecido. */
export const INK = '#2b2419'
export const INK_SOFT = '#6d6150'
export const INK_FAINT = 'rgba(43, 36, 25, 0.20)'
export const INK_WASH = 'rgba(43, 36, 25, 0.10)'

/* ------------------------------------------------------------------ */
/* estrada — a aguada de corrupção                                     */
/* ------------------------------------------------------------------ */

export const ROAD_CORE = '#332c39'
export const ROAD_EDGE = '#4b4256'
export const ROAD_RIM = '#221d27'
/** Corrente que escorre da entrada até o núcleo. Ensina a direção sem texto. */
export const ROAD_FLOW = '#cbb6e8'

/* ------------------------------------------------------------------ */
/* células                                                             */
/* ------------------------------------------------------------------ */

export const CELL_FREE = 'rgba(255, 252, 240, 0.30)'
export const CELL_FREE_EDGE = 'rgba(43, 36, 25, 0.30)'
export const BLOCKED_FILL = '#c0b191'
export const BLOCKED_HATCH = 'rgba(43, 36, 25, 0.38)'

/** Verde de "pode construir aqui". Lápis de cor, não neon. */
export const BUILD_OK = '#6f9e3f'
export const BUILD_NO = '#b4453f'

/* ------------------------------------------------------------------ */
/* núcleo — o prisma                                                   */
/* ------------------------------------------------------------------ */

export const CORE_SPECTRUM: [string, string, string] = ['#8fd7e8', '#7f8fd8', '#c46fb4']
export const CORE_HALO = 'rgba(255, 246, 214, 0.55)'
export const CORE_LOW = '#b4453f'

/* ------------------------------------------------------------------ */
/* torres — lápis de cor                                               */
/* ------------------------------------------------------------------ */

export interface UnitInk {
  body: [string, string]
  lens: string
}

export const TOWER_INK: Record<TowerId, UnitInk> = {
  faisca: { body: ['#4a93c9', '#22557f'], lens: '#eaf7ff' },
  gelido: { body: ['#74c3d4', '#2d6d83'], lens: '#e6fbff' },
  estilhaco: { body: ['#e08c3e', '#96471a'], lens: '#ffe6c2' },
  voltaico: { body: ['#9271d2', '#4e3682'], lens: '#f0e6ff' },
  alquimico: { body: ['#82ae45', '#3f6423'], lens: '#eefbd4' },
  lanca: { body: ['#c661a6', '#7a2c61'], lens: '#ffe2f6' },
  farol: { body: ['#dd6f6a', '#96342f'], lens: '#fff0cf' },
}

/* ------------------------------------------------------------------ */
/* inimigos — nanquim sujo                                             */
/* ------------------------------------------------------------------ */

export const ENEMY_INK: Record<EnemyId, UnitInk> = {
  rastejante: { body: ['#8e8b7b', '#4b4842'], lens: '#e8b7cd' },
  corredor: { body: ['#caa44d', '#7c5c20'], lens: '#fff6e2' },
  couracado: { body: ['#9ca5aa', '#464d51'], lens: '#a8d8ea' },
  espectro: { body: ['#a892c6', '#5b4a82'], lens: '#b6ecf2' },
  arcano: { body: ['#828ec6', '#3e467a'], lens: '#f0d78a' },
  curandeiro: { body: ['#83b08d', '#3c6348'], lens: '#f4e6b0' },
  divisor: { body: ['#c3829e', '#753c57'], lens: '#cfe9d2' },
  cria: { body: ['#d3a3b8', '#8c516c'], lens: '#e8f2d6' },
  lamina: { body: ['#c46d6d', '#763232'], lens: '#f7ea9e' },
  devorador: { body: ['#c47c43', '#703819'], lens: '#a8e2ea' },
  tita: { body: ['#8d6eb7', '#3f2c60'], lens: '#e0757f' },
}

/* ------------------------------------------------------------------ */
/* identidade por mapa                                                 */
/* ------------------------------------------------------------------ */

export interface MapTone {
  /** Tom do papel. */
  paper: string
  paperShade: string
  /** Cor do nanquim da estrada. */
  road: string
  roadEdge: string
  /** Cor do lápis das pedras e da decoração. */
  stone: string
}

const MAP_TONES: Record<string, MapTone> = {
  /* Caderno novo, papel claro e limpo. */
  jardim: { paper: '#ebe1ca', paperShade: '#cfbe9b', road: '#342d3a', roadEdge: '#4c4357', stone: '#b3a482' },
  /* Papel encardido, tinta mais fria e ácida. */
  obsidiana: { paper: '#ded4c0', paperShade: '#bcab8d', road: '#2b2b3b', roadEdge: '#434359', stone: '#a99a7c' },
  /* Papel queimado de sol, tinta avermelhada. */
  cume: { paper: '#eddcb8', paperShade: '#d0b787', road: '#3a2b2c', roadEdge: '#564042', stone: '#bda173' },
}

export function toneOf(mapId: string): MapTone {
  return MAP_TONES[mapId] ?? MAP_TONES.jardim
}

/* ------------------------------------------------------------------ */
/* estado e efeitos                                                    */
/* ------------------------------------------------------------------ */

export const FX_SLOW = '#7fb8cc'
export const FX_POISON = '#8fae3e'
export const FX_STUN = '#e0b544'
export const FX_SHIELD = '#7f8ac2'

export const HP_HIGH = '#6f9e3f'
export const HP_MID = '#d99a33'
export const HP_LOW = '#b4453f'

/** Balão de rótulo no campo. Cartão de papel, não vidro. */
export const CARD_FACE = '#f6efdd'
export const CARD_ENTRY = '#e3b9b4'
export const CARD_CORE = '#b9d4dc'
