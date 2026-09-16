import type {
  Achievement,
  Blessing,
  EnemyDef,
  EnemyId,
  MapDef,
  Modifiers,
  SkillNode,
  TowerDef,
  TowerId,
  TowerStats,
  WaveDef,
} from './types'

/* Grade curta e células grandes: cada personagem ocupa ~55px, legível até no celular. */
export const CELL = 64
export const COLS = 13
export const ROWS = 9
export const FIELD_W = COLS * CELL
export const FIELD_H = ROWS * CELL

export const CHAIN_JUMP = CELL * 3
export const METEOR_RADIUS = CELL * 2.4
export const PLAGUE_RADIUS = CELL * 2.5

const BASE: TowerStats = {
  damage: 0,
  range: 175,
  rate: 1,
  splash: 0,
  slowFactor: 1,
  slowDur: 0,
  chainCount: 0,
  chainFalloff: 0.8,
  dotDps: 0,
  dotDur: 0,
  pierce: 0,
  critChance: 0,
  critMult: 2,
  stunChance: 0,
  stunDur: 0,
  shred: 0,
  auraDamage: 0,
  auraRange: 0,
  auraGold: 0,
  spread: 1,
  projectileSpeed: 700,
  hitsAir: true,
  kind: 'bolt',
}

function stats(over: Partial<TowerStats>): TowerStats {
  return { ...BASE, ...over }
}

/* ------------------------------------------------------------------ */
/* TORRES                                                              */
/* ------------------------------------------------------------------ */

export const TOWERS: Record<TowerId, TowerDef> = {
  faisca: {
    id: 'faisca',
    name: 'Lápis',
    role: 'Tiro rápido',
    tagline: 'Barata e constante. Boa para começar qualquer defesa.',
    gradient: ['#6ee7ff', '#1d64d8'],
    accent: '#bae6fd',
    base: stats({ damage: 9, range: 177, rate: 2.2, kind: 'bolt', projectileSpeed: 810 }),
    levels: [
      { cost: 60, label: 'Lápis', desc: 'Dispara projéteis rápidos em alvo único.', stats: {} },
      { cost: 55, label: 'Lápis 2B', desc: 'Mais dano e alcance.', stats: { damage: 14, rate: 2.5, range: 191 } },
      { cost: 95, label: 'Lápis 6B', desc: 'Cadência elevada.', stats: { damage: 20, rate: 2.9, range: 206 } },
    ],
    branches: {
      a: {
        name: 'Rajada',
        tag: 'Volume',
        desc: 'Dispara três projéteis por salva. Devasta hordas fracas.',
        levels: [
          { cost: 175, label: 'Rajada', desc: '3 projéteis por disparo.', stats: { damage: 17, rate: 2.7, spread: 3, range: 215 } },
          { cost: 310, label: 'Chuvisco', desc: '4 projéteis e cadência absurda.', stats: { damage: 25, rate: 3.2, spread: 4, range: 226 } },
        ],
      },
      b: {
        name: 'Perfurante',
        tag: 'Anti-blindado',
        desc: 'Ignora completamente a armadura inimiga.',
        levels: [
          { cost: 185, label: 'Perfurante', desc: 'Ignora armadura, dano alto por tiro.', stats: { damage: 44, rate: 1.7, range: 244, pierce: 999 } },
          { cost: 325, label: 'Estilete', desc: 'Crítico e dano brutal.', stats: { damage: 74, rate: 1.9, range: 258, pierce: 999, critChance: 0.22, critMult: 2.4 } },
        ],
      },
    },
  },

  estilhaco: {
    id: 'estilhaco',
    name: 'Guache',
    role: 'Morteiro',
    tagline: 'Explosões pesadas em área. Não alcança voadores.',
    gradient: ['#ffc23d', '#e0621a'],
    accent: '#fed7aa',
    base: stats({ damage: 28, range: 258, rate: 0.7, splash: 78, kind: 'mortar', projectileSpeed: 435, hitsAir: false }),
    levels: [
      { cost: 130, label: 'Guache', desc: 'Projétil em arco com dano em área.', stats: {} },
      { cost: 115, label: 'Guache Pesado', desc: 'Explosão maior.', stats: { damage: 42, splash: 87 } },
      { cost: 195, label: 'Bombardeiro', desc: 'Mais dano e cadência.', stats: { damage: 60, splash: 96, rate: 0.82, range: 276 } },
    ],
    branches: {
      a: {
        name: 'Cratera',
        tag: 'Incêndio',
        desc: 'Explosões gigantes que deixam o chão em chamas.',
        levels: [
          { cost: 350, label: 'Cratera', desc: 'Explosão enorme mais queimadura.', stats: { damage: 98, splash: 128, dotDps: 14, dotDur: 3 } },
          { cost: 610, label: 'Chuva de Meteoros', desc: 'Devastação em área.', stats: { damage: 158, splash: 151, dotDps: 26, dotDur: 4, rate: 0.9 } },
        ],
      },
      b: {
        name: 'Fragmentação',
        tag: 'Saturação',
        desc: 'Lança várias granadas menores por salva.',
        levels: [
          { cost: 330, label: 'Fragmentação', desc: '4 granadas por disparo.', stats: { damage: 44, splash: 75, spread: 4, rate: 0.75 } },
          { cost: 580, label: 'Salva Contínua', desc: '5 granadas, cadência maior.', stats: { damage: 66, splash: 84, spread: 5, rate: 0.95 } },
        ],
      },
    },
  },

  gelido: {
    id: 'gelido',
    name: 'Giz',
    role: 'Controle',
    tagline: 'Pouco dano, muita lentidão. Base de qualquer defesa longa.',
    gradient: ['#a8f7ff', '#0891b2'],
    accent: '#cffafe',
    base: stats({ damage: 7, range: 194, rate: 1.05, splash: 87, slowFactor: 0.58, slowDur: 1.9, kind: 'orb', projectileSpeed: 550 }),
    levels: [
      { cost: 90, label: 'Giz', desc: 'Orbe congelante que reduz a velocidade em área.', stats: {} },
      { cost: 85, label: 'Giz Grosso', desc: 'Lentidão mais forte.', stats: { damage: 11, slowFactor: 0.5, splash: 99 } },
      { cost: 155, label: 'Pó de Giz', desc: 'Lentidão profunda e duradoura.', stats: { damage: 17, slowFactor: 0.44, slowDur: 2.3, range: 215, splash: 107 } },
    ],
    branches: {
      a: {
        name: 'Congelante',
        tag: 'Trava',
        desc: 'Chance de congelar inimigos no lugar.',
        levels: [
          { cost: 285, label: 'Congelante', desc: 'Chance de congelar por 0,9s.', stats: { damage: 26, stunChance: 0.26, stunDur: 0.9, slowFactor: 0.42 } },
          { cost: 495, label: 'Zero Absoluto', desc: 'Congela quase sempre.', stats: { damage: 40, stunChance: 0.42, stunDur: 1.3, slowFactor: 0.36, rate: 1.2 } },
        ],
      },
      b: {
        name: 'Permafrost',
        tag: 'Amplo',
        desc: 'Área imensa e quebra de armadura pelo frio.',
        levels: [
          { cost: 265, label: 'Permafrost', desc: 'Alcance e área enormes, corrói armadura.', stats: { damage: 20, range: 284, splash: 145, slowFactor: 0.36, shred: 4 } },
          { cost: 470, label: 'Inverno Eterno', desc: 'Domina metade do mapa.', stats: { damage: 32, range: 328, splash: 171, slowFactor: 0.28, shred: 9, slowDur: 3 } },
        ],
      },
    },
  },

  voltaico: {
    id: 'voltaico',
    name: 'Clipe',
    role: 'Cadeia',
    tagline: 'Raios que saltam entre inimigos. Adora aglomeração.',
    gradient: ['#cbb2ff', '#7c3aed'],
    accent: '#ddd6fe',
    base: stats({ damage: 19, range: 200, rate: 1.3, chainCount: 3, chainFalloff: 0.75, kind: 'chain' }),
    levels: [
      { cost: 150, label: 'Clipe', desc: 'Raio que salta para 3 alvos.', stats: {} },
      { cost: 135, label: 'Clipe Duplo', desc: 'Mais saltos e dano.', stats: { damage: 28, chainCount: 4 } },
      { cost: 225, label: 'Descarga', desc: 'Cadeia longa.', stats: { damage: 38, chainCount: 5, rate: 1.5, range: 218 } },
    ],
    branches: {
      a: {
        name: 'Sobrecarga',
        tag: 'Cadeia longa',
        desc: 'O raio atravessa a horda inteira.',
        levels: [
          { cost: 405, label: 'Sobrecarga', desc: '8 saltos com pouca perda.', stats: { damage: 54, chainCount: 8, chainFalloff: 0.86 } },
          { cost: 710, label: 'Tempestade Elétrica', desc: '12 saltos sem dó.', stats: { damage: 82, chainCount: 12, chainFalloff: 0.92, rate: 1.7 } },
        ],
      },
      b: {
        name: 'Ressonância',
        tag: 'Atordoamento',
        desc: 'Cada raio pode travar o inimigo e rachar sua armadura.',
        levels: [
          { cost: 385, label: 'Ressonância', desc: 'Chance de atordoar e corroer armadura.', stats: { damage: 62, chainCount: 5, stunChance: 0.3, stunDur: 0.5, shred: 3 } },
          { cost: 690, label: 'Ruptura', desc: 'Atordoamento constante.', stats: { damage: 96, chainCount: 6, stunChance: 0.46, stunDur: 0.7, shred: 7 } },
        ],
      },
    },
  },

  lanca: {
    id: 'lanca',
    name: 'Lupa',
    role: 'Precisão',
    tagline: 'Alcance imenso e dano cirúrgico. Cara, mas decisiva.',
    gradient: ['#f7b0ff', '#a21caf'],
    accent: '#f5d0fe',
    base: stats({ damage: 74, range: 380, rate: 0.55, pierce: 8, critChance: 0.15, critMult: 2, kind: 'beam', projectileSpeed: 2000 }),
    levels: [
      { cost: 200, label: 'Lupa', desc: 'Feixe de longo alcance com crítico.', stats: {} },
      { cost: 180, label: 'Lente Dupla', desc: 'Mais dano e crítico.', stats: { damage: 112, critChance: 0.2 } },
      { cost: 305, label: 'Lupa Maior', desc: 'Alcance quase total.', stats: { damage: 164, rate: 0.62, range: 430 } },
    ],
    branches: {
      a: {
        name: 'Precisão',
        tag: 'Crítico',
        desc: 'Críticos gigantes e frequentes.',
        levels: [
          { cost: 530, label: 'Precisão', desc: '45% de crítico causando 3x.', stats: { damage: 220, critChance: 0.45, critMult: 3 } },
          { cost: 920, label: 'Olho do Prisma', desc: 'Crítico quase garantido.', stats: { damage: 330, critChance: 0.62, critMult: 3.6, rate: 0.72 } },
        ],
      },
      b: {
        name: 'Raio Solar',
        tag: 'Perfuração',
        desc: 'Feixe contínuo que ignora armadura e queima em linha.',
        levels: [
          { cost: 505, label: 'Raio Solar', desc: 'Ignora armadura, queima o alvo.', stats: { damage: 250, pierce: 999, splash: 61, dotDps: 32, dotDur: 2 } },
          { cost: 890, label: 'Solstício', desc: 'Um feixe que apaga fileiras.', stats: { damage: 390, pierce: 999, splash: 84, dotDps: 58, dotDur: 3, rate: 0.62 } },
        ],
      },
    },
  },

  alquimico: {
    id: 'alquimico',
    name: 'Solvente',
    role: 'Veneno',
    tagline: 'Dano ao longo do tempo. Ótimo contra vida alta.',
    gradient: ['#c5f74f', '#15803d'],
    accent: '#d9f99d',
    base: stats({ damage: 6, range: 206, rate: 0.9, splash: 70, dotDps: 17, dotDur: 4, kind: 'orb', projectileSpeed: 495 }),
    levels: [
      { cost: 110, label: 'Solvente', desc: 'Frascos que envenenam em área.', stats: {} },
      { cost: 105, label: 'Diluente', desc: 'Veneno mais forte.', stats: { dotDps: 27, splash: 78 } },
      { cost: 180, label: 'Removedor', desc: 'Veneno duradouro.', stats: { dotDps: 41, dotDur: 5, damage: 13, range: 223 } },
    ],
    branches: {
      a: {
        name: 'Praga',
        tag: 'Contágio',
        desc: 'Inimigos envenenados contaminam vizinhos ao morrer.',
        levels: [
          { cost: 325, label: 'Praga', desc: 'O veneno se espalha na morte.', stats: { dotDps: 70, dotDur: 5, splash: 99 } },
          { cost: 570, label: 'Pandemia', desc: 'A horda inteira apodrece junto.', stats: { dotDps: 110, dotDur: 6, splash: 119, rate: 1.05 } },
        ],
      },
      b: {
        name: 'Ácido',
        tag: 'Corrosão',
        desc: 'Dissolve armadura e potencializa todas as outras torres.',
        levels: [
          { cost: 305, label: 'Ácido', desc: 'Reduz muito a armadura do alvo.', stats: { dotDps: 56, shred: 7, splash: 87 } },
          { cost: 545, label: 'Solvente Real', desc: 'Praticamente zera armaduras.', stats: { dotDps: 88, shred: 14, splash: 104, dotDur: 5 } },
        ],
      },
    },
  },

  farol: {
    id: 'farol',
    name: 'Luminária',
    role: 'Suporte',
    tagline: 'Não atira: fortalece e financia as torres vizinhas.',
    gradient: ['#ffb0bf', '#e11d48'],
    accent: '#fecdd3',
    // Para o Luminária, `rate` representa o bônus de cadência concedido em aura.
    base: stats({ damage: 0, range: 0, rate: 0, kind: 'none', auraDamage: 0.16, auraRange: 177, auraGold: 0 }),
    levels: [
      { cost: 140, label: 'Luminária', desc: '+16% de dano às torres em volta.', stats: {} },
      { cost: 125, label: 'Luminária Forte', desc: 'Aura maior e mais forte.', stats: { auraDamage: 0.26, auraRange: 200 } },
      { cost: 205, label: 'Luminária Prismática', desc: 'Também gera ouro passivo.', stats: { auraDamage: 0.36, auraRange: 224, auraGold: 2 } },
    ],
    branches: {
      a: {
        name: 'Tesouro',
        tag: 'Economia',
        desc: 'Transforma a defesa em uma mina de ouro.',
        levels: [
          { cost: 335, label: 'Tesouro', desc: 'Ouro passivo generoso.', stats: { auraDamage: 0.36, auraGold: 7, auraRange: 235 } },
          { cost: 585, label: 'Cofre Vivo', desc: 'Financia a partida inteira.', stats: { auraDamage: 0.46, auraGold: 14, auraRange: 255 } },
        ],
      },
      b: {
        name: 'Fúria',
        tag: 'Ofensivo',
        desc: 'Dobra a potência das torres ao redor.',
        levels: [
          { cost: 355, label: 'Fúria', desc: '+62% de dano e +22% de cadência em aura.', stats: { auraDamage: 0.62, auraRange: 218, rate: 0.22 } },
          { cost: 620, label: 'Fervor', desc: 'Aura devastadora.', stats: { auraDamage: 0.95, auraRange: 244, rate: 0.38 } },
        ],
      },
    },
  },
}

export const TOWER_ORDER: TowerId[] = [
  'faisca',
  'gelido',
  'estilhaco',
  'voltaico',
  'alquimico',
  'lanca',
  'farol',
]

/* ------------------------------------------------------------------ */
/* SINERGIAS                                                           */
/* ------------------------------------------------------------------ */

export interface SynergyEffect {
  damageMul?: number
  rangeMul?: number
  rateMul?: number
  splashMul?: number
  dotMul?: number
  slowBonus?: number
}

export interface SynergyDef {
  id: string
  a: TowerId
  b: TowerId
  name: string
  desc: string
  effA: SynergyEffect
  effB: SynergyEffect
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'tempestade',
    a: 'gelido',
    b: 'voltaico',
    name: 'Pó Condutor',
    desc: 'Giz +20% alcance · Clipe +45% dano',
    effA: { rangeMul: 1.2 },
    effB: { damageMul: 1.45 },
  },
  {
    id: 'cadeia',
    a: 'alquimico',
    b: 'estilhaco',
    name: 'Reação em Cadeia',
    desc: 'Solvente +35% veneno · Guache +40% área',
    effA: { dotMul: 1.35 },
    effB: { splashMul: 1.4 },
  },
  {
    id: 'fuzilaria',
    a: 'faisca',
    b: 'farol',
    name: 'Fuzilaria',
    desc: 'Lápis +32% cadência',
    effA: { rateMul: 1.32 },
    effB: {},
  },
  {
    id: 'mira',
    a: 'lanca',
    b: 'gelido',
    name: 'Mira Firme',
    desc: 'Lupa +32% dano',
    effA: { damageMul: 1.32 },
    effB: {},
  },
  {
    id: 'corrosao',
    a: 'alquimico',
    b: 'lanca',
    name: 'Corrosão Focada',
    desc: 'Lupa +25% dano · Solvente +18% alcance',
    effA: { rangeMul: 1.18 },
    effB: { damageMul: 1.25 },
  },
  {
    id: 'detonacao',
    a: 'voltaico',
    b: 'estilhaco',
    name: 'Detonação',
    desc: 'Guache +28% cadência · Clipe +15% dano',
    effA: { damageMul: 1.15 },
    effB: { rateMul: 1.28 },
  },
]

/* ------------------------------------------------------------------ */
/* INIMIGOS                                                            */
/* ------------------------------------------------------------------ */

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  rastejante: {
    id: 'rastejante',
    name: 'Rabisco',
    blurb: 'Massa básica da Mancha. Lento e bobo.',
    hp: 44, speed: 61, armor: 0, shield: 0, bounty: 8, radius: 22, damage: 1,
    flying: false, boss: false, legs: 4, body: ['#9fb3c8', '#33465c'], eye: '#ff7ab8',
  },
  corredor: {
    id: 'corredor',
    name: 'Risco',
    blurb: 'Rápido e frágil. Passa por defesas lentas.',
    hp: 32, speed: 133, armor: 0, shield: 0, bounty: 9, radius: 19, damage: 1,
    flying: false, boss: false, legs: 2, body: ['#ffd75e', '#b45309'], eye: '#fff7ed',
  },
  couracado: {
    id: 'couracado',
    name: 'Borrão Seco',
    blurb: 'Armadura pesada. Precisa de perfuração ou ácido.',
    hp: 140, speed: 46, armor: 9, shield: 0, bounty: 17, radius: 26, damage: 2,
    flying: false, boss: false, legs: 6, body: ['#d3dfe9', '#22303f'], eye: '#38bdf8',
  },
  espectro: {
    id: 'espectro',
    name: 'Rasura',
    blurb: 'Voa reto até o núcleo. Só torres aéreas acertam.',
    hp: 64, speed: 87, armor: 2, shield: 0, bounty: 15, radius: 22, damage: 1,
    flying: true, boss: false, legs: 0, body: ['#eddaff', '#7e22ce'], eye: '#22d3ee',
  },
  arcano: {
    id: 'arcano',
    name: 'Selo',
    blurb: 'Escudo que absorve dano e se regenera fora de combate.',
    hp: 96, speed: 58, armor: 2, shield: 76, shieldRegen: 14, bounty: 21, radius: 24, damage: 2,
    flying: false, boss: false, legs: 4, body: ['#aebcff', '#3730a3'], eye: '#facc15',
  },
  curandeiro: {
    id: 'curandeiro',
    name: 'Mata-Borrão',
    blurb: 'Cura aliados próximos. Elimine primeiro.',
    hp: 118, speed: 52, armor: 3, shield: 0, bounty: 24, radius: 23, damage: 2,
    flying: false, boss: false, legs: 4, body: ['#8ff0a4', '#166534'], eye: '#fde68a',
    heal: { amount: 20, radius: 140, interval: 1.5 },
  },
  divisor: {
    id: 'divisor',
    name: 'Pingo',
    blurb: 'Ao morrer se parte em três crias velozes.',
    hp: 165, speed: 55, armor: 4, shield: 0, bounty: 26, radius: 29, damage: 2,
    flying: false, boss: false, legs: 6, body: ['#ffa8d8', '#9d174d'], eye: '#bbf7d0',
    split: { into: 'cria', count: 3 },
  },
  cria: {
    id: 'cria',
    name: 'Respingo',
    blurb: 'Fragmento veloz de um Pingo.',
    hp: 42, speed: 99, armor: 1, shield: 0, bounty: 4, radius: 16, damage: 1,
    flying: false, boss: false, legs: 4, body: ['#ffcfe8', '#be185d'], eye: '#ecfccb',
  },
  lamina: {
    id: 'lamina',
    name: 'Aparo',
    blurb: 'Elite rápida e blindada ao mesmo tempo.',
    hp: 245, speed: 104, armor: 11, shield: 0, bounty: 36, radius: 25, damage: 3,
    flying: false, boss: false, legs: 4, body: ['#ffa1ae', '#881337'], eye: '#fef08a',
  },
  devorador: {
    id: 'devorador',
    name: 'Bico-de-Pena',
    blurb: 'CHEFE — casca grossa, escudo pesado e uma bocarra.',
    hp: 2400, speed: 38, armor: 15, shield: 420, shieldRegen: 30, bounty: 280, radius: 42, damage: 6,
    flying: false, boss: true, legs: 6, body: ['#ff9d4d', '#7c2d12'], eye: '#22d3ee',
  },
  tita: {
    id: 'tita',
    name: 'A Primeira Mancha',
    blurb: 'CHEFE FINAL — a própria Mancha encarnada.',
    hp: 6200, speed: 32, armor: 22, shield: 1100, shieldRegen: 55, bounty: 780, radius: 52, damage: 14,
    flying: false, boss: true, legs: 8, body: ['#c98cff', '#2e1065'], eye: '#f43f5e',
  },
}

/* ------------------------------------------------------------------ */
/* MAPAS                                                               */
/* ------------------------------------------------------------------ */

export const MAPS: MapDef[] = [
  {
    id: 'jardim',
    name: 'A Margem',
    blurb: 'A tinta ainda escorre pela borda da folha. Espaço de sobra para aprender.',
    waypoints: [[-1, 4], [2, 4], [2, 1], [5, 1], [5, 6], [8, 6], [8, 2], [11, 2], [11, 7]],
    decor: [[0, 0], [6, 0], [12, 0], [0, 8], [6, 8], [9, 4]],
    pads: [[1, 3], [1, 5], [3, 2], [3, 4], [4, 0], [4, 3], [6, 1], [6, 3], [6, 5], [7, 4], [7, 7], [9, 1], [9, 3], [9, 5], [10, 4], [12, 2], [12, 4]],
    gold: 280,
    lives: 20,
    hpScale: 1,
    unlockAt: 0,
    tint: ['#173c4c', '#0c1f2c'],
  },
  {
    id: 'obsidiana',
    name: 'A Página Rasgada',
    blurb: 'Você vira a folha: um desenho antigo, já todo cinza. Aqui a Mancha copia o que engole.',
    waypoints: [[-1, 1], [3, 1], [3, 4], [1, 4], [1, 7], [6, 7], [6, 3], [9, 3], [9, 7], [11, 7]],
    decor: [[0, 0], [6, 0], [12, 0], [0, 8], [4, 5], [8, 5]],
    pads: [[1, 0], [3, 0], [2, 2], [4, 2], [4, 4], [0, 5], [2, 5], [0, 7], [3, 6], [5, 6], [5, 3], [7, 2], [8, 4], [8, 6], [10, 4]],
    gold: 300,
    lives: 18,
    hpScale: 1.18,
    unlockAt: 1,
    tint: ['#2a1c3f', '#150f26'],
  },
  {
    id: 'cume',
    name: 'O Tinteiro',
    blurb: 'A origem: o vidro tombado na capa. Traçado brutal, nenhum respingo perdoado.',
    waypoints: [[-1, 7], [2, 7], [2, 4], [5, 4], [5, 7], [8, 7], [8, 3], [6, 3], [6, 1], [11, 1], [11, 6]],
    decor: [[0, 0], [3, 0], [0, 8], [3, 8], [9, 8], [9, 4]],
    pads: [[1, 4], [1, 6], [3, 3], [3, 6], [4, 5], [4, 7], [5, 2], [6, 6], [7, 2], [7, 5], [8, 0], [9, 2], [9, 5], [10, 3], [12, 1], [12, 3]],
    gold: 320,
    lives: 15,
    hpScale: 1.42,
    unlockAt: 2,
    tint: ['#42280f', '#20140a'],
  },
]

/* ------------------------------------------------------------------ */
/* ONDAS                                                               */
/* ------------------------------------------------------------------ */

const W = (label: string, groups: Array<[EnemyId, number, number, number?]>, boss = false): WaveDef => ({
  label,
  boss,
  groups: groups.map(([enemy, count, gap, delay]) => ({ enemy, count, gap, delay: delay ?? 0 })),
})

export const CAMPAIGN_WAVES: WaveDef[] = [
  W('Primeiro Pingo', [['rastejante', 8, 0.95]]),
  W('Escorre', [['rastejante', 13, 0.75]]),
  W('Riscos na Margem', [['rastejante', 8, 0.8], ['corredor', 6, 0.5, 4]]),
  W('Rabiscada', [['corredor', 14, 0.45]]),
  W('Casca Seca', [['couracado', 5, 1.5], ['rastejante', 12, 0.5, 2]]),
  W('Rasuras no Ar', [['espectro', 9, 0.9]]),
  W('Camada sobre Camada', [['rastejante', 16, 0.4], ['couracado', 5, 1.3, 3]]),
  W('Lacre', [['arcano', 6, 1.2], ['corredor', 12, 0.4, 4]]),
  W('Nuvem de Rasuras', [['espectro', 11, 0.6], ['corredor', 10, 0.4, 5]]),
  W('BICO-DE-PENA', [['devorador', 1, 1], ['rastejante', 14, 0.5, 3]], true),
  W('Mata-Borrão', [['curandeiro', 3, 2.2], ['couracado', 9, 0.9, 2]]),
  W('Pingou', [['divisor', 6, 1.4], ['corredor', 12, 0.4, 5]]),
  W('Selos no Ar', [['espectro', 12, 0.55], ['arcano', 7, 1.1, 4]]),
  W('Aparos', [['lamina', 8, 1], ['rastejante', 16, 0.35, 3]]),
  W('BICO-DE-PENA II', [['devorador', 1, 1], ['curandeiro', 4, 1.6, 2], ['espectro', 11, 0.6, 5]], true),
  W('Pingos Partidos', [['divisor', 9, 1.1], ['couracado', 10, 0.7, 4]]),
  W('Traço Fino', [['lamina', 12, 0.8], ['arcano', 8, 1, 5]]),
  W('Página Apagada', [['espectro', 17, 0.45], ['curandeiro', 5, 1.6, 6]]),
  W('Cerco de Tinta', [['devorador', 2, 6], ['lamina', 11, 0.7, 2], ['divisor', 7, 1.2, 8]], true),
  W('A PRIMEIRA MANCHA', [['tita', 1, 1], ['lamina', 13, 0.7, 6], ['espectro', 13, 0.5, 12], ['curandeiro', 5, 1.4, 20]], true),
]

const ENDLESS_POOL: EnemyId[] = [
  'rastejante', 'corredor', 'couracado', 'espectro', 'arcano', 'curandeiro', 'divisor', 'lamina',
]

export function getWave(n: number): WaveDef {
  // Trava em 1: `CAMPAIGN_WAVES[-1]` é undefined, e quem chamava com 0 (a
  // prévia da onda antes da primeira ser chamada) quebrava ao ler `.label`.
  if (n < 1) n = 1
  if (n <= CAMPAIGN_WAVES.length) return CAMPAIGN_WAVES[n - 1]
  const over = n - CAMPAIGN_WAVES.length
  const groups: Array<[EnemyId, number, number, number?]> = []
  const picks = 3 + Math.min(3, Math.floor(over / 6))
  for (let i = 0; i < picks; i++) {
    const enemy = ENDLESS_POOL[(over * 3 + i * 5) % ENDLESS_POOL.length]
    groups.push([enemy, 8 + Math.floor(over * 0.9) + i * 2, 0.42, i * 3])
  }
  if (over % 5 === 0) groups.unshift(['tita', Math.max(1, Math.floor(over / 10)), 4])
  else if (over % 3 === 0) groups.unshift(['devorador', 1 + Math.floor(over / 8), 3])
  return W(`Página ${over}`, groups, over % 3 === 0)
}

export function waveHpMultiplier(n: number, mapScale: number): number {
  const base = 1 + (n - 1) * 0.088 + Math.pow(n / 10, 2.05) * 0.34
  const endless = n > CAMPAIGN_WAVES.length ? Math.pow(1.135, n - CAMPAIGN_WAVES.length) : 1
  return base * endless * mapScale
}

export function waveBounty(n: number): number {
  return 1 + n * 0.028
}

export const MAX_CAMPAIGN_WAVES = CAMPAIGN_WAVES.length

/* ------------------------------------------------------------------ */
/* BÊNÇÃOS                                                             */
/* ------------------------------------------------------------------ */

export const BLESSINGS: Blessing[] = [
  { id: 'nucleo', name: 'Núcleo Ardente', desc: '+13% de dano em todas as torres.', icon: '🔥', rarity: 'comum', max: 5, apply: (m) => { m.damageMul *= 1.13 } },
  { id: 'lentes', name: 'Lentes Prismáticas', desc: '+11% de alcance em todas as torres.', icon: '🔭', rarity: 'comum', max: 3, apply: (m) => { m.rangeMul *= 1.11 } },
  { id: 'gatilho', name: 'Gatilho Rápido', desc: '+11% de cadência de tiro.', icon: '⚡', rarity: 'comum', max: 4, apply: (m) => { m.rateMul *= 1.11 } },
  { id: 'detonacao', name: 'Detonação Ampla', desc: '+28% no raio das explosões.', icon: '💥', rarity: 'comum', max: 3, apply: (m) => { m.splashMul *= 1.28 } },
  { id: 'toxina', name: 'Toxina Persistente', desc: '+32% de dano de veneno e queimadura.', icon: '🧪', rarity: 'comum', max: 3, apply: (m) => { m.dotMul *= 1.32 } },
  { id: 'frio', name: 'Frio Profundo', desc: 'Lentidão 25% mais intensa.', icon: '❄️', rarity: 'rara', max: 2, apply: (m) => { m.slowMul *= 0.75 } },
  { id: 'condutor', name: 'Condutor', desc: '+1 salto em todos os raios em cadeia.', icon: '🌩️', rarity: 'rara', max: 3, apply: (m) => { m.chainBonus += 1 } },
  { id: 'olho', name: 'Olho Certeiro', desc: '+13% de chance de crítico.', icon: '🎯', rarity: 'rara', max: 3, apply: (m) => { m.critChance += 0.13 } },
  { id: 'brutal', name: 'Golpe Brutal', desc: '+0,6x no multiplicador de crítico.', icon: '🗡️', rarity: 'rara', max: 2, apply: (m) => { m.critMult += 0.6 } },
  { id: 'saque', name: 'Saque', desc: '+3 de ouro por abate.', icon: '💰', rarity: 'comum', max: 4, apply: (m) => { m.goldPerKill += 3 } },
  { id: 'mercador', name: 'Mercador', desc: 'Torres e melhorias custam 9% menos.', icon: '🏷️', rarity: 'rara', max: 3, apply: (m) => { m.costMul *= 0.91 } },
  { id: 'revenda', name: 'Revenda Justa', desc: 'Vender devolve 95% do investido.', icon: '♻️', rarity: 'comum', max: 1, apply: (m) => { m.sellRate = 0.95 } },
  { id: 'reator', name: 'Reator', desc: 'Energia das habilidades carrega 35% mais rápido.', icon: '🔋', rarity: 'rara', max: 3, apply: (m) => { m.energyRegen *= 1.35 } },
  { id: 'escudo', name: 'Escudo do Núcleo', desc: '+3 vidas imediatamente.', icon: '🛡️', rarity: 'rara', max: 3, apply: (m) => { m.startLives += 3 } },
  { id: 'juros', name: 'Juros Compostos', desc: '+5% de juros sobre o ouro guardado.', icon: '📈', rarity: 'rara', max: 3, apply: (m) => { m.interestRate += 0.05 } },
  { id: 'primeiro', name: 'Primeiro Golpe', desc: 'O primeiro acerto em cada inimigo causa +70%.', icon: '✴️', rarity: 'lendaria', max: 2, apply: (m) => { m.firstStrike += 0.7 } },
  { id: 'excesso', name: 'Excesso Lucrativo', desc: 'Dano excedente ao matar vira ouro.', icon: '🪙', rarity: 'lendaria', max: 1, apply: (m) => { m.overkillGold += 0.02 } },
  { id: 'cacador', name: 'Caçador de Chefes', desc: '+35% de dano contra chefes.', icon: '👑', rarity: 'lendaria', max: 2, apply: (m) => { m.bossDamageMul *= 1.35 } },
  { id: 'sobrecarga', name: 'Sobrecarga Prismática', desc: '+22% de dano, mas -7% de alcance.', icon: '☄️', rarity: 'lendaria', max: 2, apply: (m) => { m.damageMul *= 1.22; m.rangeMul *= 0.93 } },
  { id: 'fortuna', name: 'Fortuna', desc: '+30% de prismas ganhos nesta partida.', icon: '💎', rarity: 'lendaria', max: 2, apply: (m) => { m.prismaMul *= 1.3 } },
]

export const BLESSING_BY_ID: Record<string, Blessing> = Object.fromEntries(
  BLESSINGS.map((b) => [b.id, b]),
)

/* ------------------------------------------------------------------ */
/* ÁRVORE PERMANENTE                                                   */
/* ------------------------------------------------------------------ */

export const SKILLS: SkillNode[] = [
  { id: 'fortuna', name: 'Cofre Inicial', desc: '+60 de ouro no início da partida.', cost: 2, ranks: 3, tier: 1, icon: '💰', apply: (m, r) => { m.startGold += 60 * r } },
  { id: 'vitalidade', name: 'Vitalidade', desc: '+2 vidas iniciais.', cost: 2, ranks: 3, tier: 1, icon: '❤️', apply: (m, r) => { m.startLives += 2 * r } },
  { id: 'foco', name: 'Foco', desc: '+3% de dano permanente.', cost: 3, ranks: 3, tier: 1, icon: '🎯', apply: (m, r) => { m.damageMul *= 1 + 0.03 * r } },
  { id: 'arsenal', name: 'Arsenal', desc: 'Torres custam 4% menos.', cost: 5, ranks: 2, tier: 2, icon: '🏗️', apply: (m, r) => { m.costMul *= Math.pow(0.96, r) } },
  { id: 'alcance', name: 'Horizonte', desc: '+4% de alcance permanente.', cost: 5, ranks: 2, tier: 2, icon: '🔭', apply: (m, r) => { m.rangeMul *= 1 + 0.04 * r } },
  { id: 'reator', name: 'Reator Frio', desc: '+18% de regeneração de energia.', cost: 5, ranks: 2, tier: 2, icon: '🔋', apply: (m, r) => { m.energyRegen *= 1 + 0.18 * r } },
  { id: 'cadencia', name: 'Cadência', desc: '+5% de velocidade de tiro.', cost: 9, ranks: 2, tier: 3, icon: '⚙️', apply: (m, r) => { m.rateMul *= 1 + 0.05 * r } },
  { id: 'ganancia', name: 'Ganância', desc: '+12% de ouro ganho.', cost: 9, ranks: 2, tier: 3, icon: '🪙', apply: (m, r) => { m.goldMul *= 1 + 0.12 * r } },
  { id: 'revendaperm', name: 'Negociante', desc: 'Vender devolve 88% do investido.', cost: 9, ranks: 1, tier: 3, icon: '♻️', apply: (m) => { m.sellRate = Math.max(m.sellRate, 0.88) } },
  { id: 'sabedoria', name: 'Sabedoria', desc: '+18% de prismas ganhos.', cost: 15, ranks: 2, tier: 4, icon: '💎', apply: (m, r) => { m.prismaMul *= 1 + 0.18 * r } },
  { id: 'draft', name: 'Visão Ampla', desc: 'As bênçãos oferecem 4 opções em vez de 3.', cost: 15, ranks: 1, tier: 4, icon: '🔮', apply: (m) => { m.draftSize = 4 } },
  { id: 'critico', name: 'Crítico Latente', desc: '+8% de chance de crítico permanente.', cost: 15, ranks: 2, tier: 4, icon: '✴️', apply: (m, r) => { m.critChance += 0.08 * r } },
]

export const SKILL_BY_ID: Record<string, SkillNode> = Object.fromEntries(SKILLS.map((s) => [s.id, s]))

/* ------------------------------------------------------------------ */
/* CONQUISTAS                                                          */
/* ------------------------------------------------------------------ */

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'primeirosangue', name: 'Primeiro Sangue', desc: 'Elimine 50 inimigos.', reward: 2 },
  { id: 'exterminador', name: 'Exterminador', desc: 'Elimine 1.000 inimigos no total.', reward: 6 },
  { id: 'genocida', name: 'Ceifador', desc: 'Elimine 5.000 inimigos no total.', reward: 14 },
  { id: 'onda10', name: 'Meio Caminho', desc: 'Chegue à onda 10 em qualquer mapa.', reward: 3 },
  { id: 'vitoria', name: 'Guardião', desc: 'Vença a campanha de um mapa.', reward: 10 },
  { id: 'perfeito', name: 'Muralha Intacta', desc: 'Vença sem perder nenhuma vida.', reward: 20 },
  { id: 'endless25', name: 'Insistente', desc: 'Alcance a onda 25 no modo infinito.', reward: 8 },
  { id: 'endless40', name: 'Imortal', desc: 'Alcance a onda 40 no modo infinito.', reward: 25 },
  { id: 'maxtower', name: 'Obra-Prima', desc: 'Leve uma torre ao nível máximo.', reward: 4 },
  { id: 'setetorres', name: 'Coleção Completa', desc: 'Tenha as 7 torres em campo ao mesmo tempo.', reward: 6 },
  { id: 'sinergia3', name: 'Engenheiro', desc: 'Ative 3 sinergias simultâneas.', reward: 6 },
  { id: 'rico', name: 'Magnata', desc: 'Acumule 3.000 de ouro em uma partida.', reward: 5 },
  { id: 'titan', name: 'Matador de Titãs', desc: 'Derrote o A Primeira Mancha.', reward: 15 },
  { id: 'todososmapas', name: 'Cartógrafo', desc: 'Desbloqueie todos os mapas.', reward: 8 },
]

export const ACHIEVEMENT_BY_ID: Record<string, Achievement> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
)

/* ------------------------------------------------------------------ */
/* HABILIDADES ATIVAS                                                  */
/* ------------------------------------------------------------------ */

export interface AbilityDef {
  id: 'meteoro' | 'estase' | 'reparo'
  name: string
  desc: string
  icon: string
  cost: number
  gradient: [string, string]
}

export const ABILITIES: AbilityDef[] = [
  { id: 'meteoro', name: "Gota d'Água", desc: 'Estoura a tinta numa área inteira. Toque no alvo.', icon: '☄️', cost: 45, gradient: ['#fb923c', '#dc2626'] },
  { id: 'estase', name: 'Secagem', desc: 'A tinta seca: trava todo mundo por 3,5 segundos.', icon: '🧊', cost: 60, gradient: ['#67e8f9', '#0e7490'] },
  { id: 'reparo', name: 'Retoque', desc: 'Redesenha o Prisma: devolve 5 vidas.', icon: '💗', cost: 85, gradient: ['#f9a8d4', '#be123c'] },
]

export function defaultModifiers(): Modifiers {
  return {
    damageMul: 1,
    rangeMul: 1,
    rateMul: 1,
    splashMul: 1,
    slowMul: 1,
    dotMul: 1,
    chainBonus: 0,
    critChance: 0,
    critMult: 0,
    goldPerKill: 0,
    goldMul: 1,
    costMul: 1,
    sellRate: 0.72,
    energyRegen: 1,
    startGold: 0,
    startLives: 0,
    interestRate: 0.05,
    draftSize: 3,
    prismaMul: 1,
    bossDamageMul: 1,
    firstStrike: 0,
    overkillGold: 0,
  }
}
