export type TowerId =
  | 'faisca'
  | 'estilhaco'
  | 'gelido'
  | 'voltaico'
  | 'lanca'
  | 'alquimico'
  | 'farol'

export type EnemyId =
  | 'rastejante'
  | 'corredor'
  | 'couracado'
  | 'espectro'
  | 'arcano'
  | 'curandeiro'
  | 'divisor'
  | 'cria'
  | 'lamina'
  | 'devorador'
  | 'tita'

export type AbilityId = 'meteoro' | 'estase' | 'reparo'

export type Branch = 'a' | 'b'

export type ProjectileKind = 'bolt' | 'mortar' | 'beam' | 'chain' | 'orb' | 'none'

export interface TowerStats {
  damage: number
  range: number
  rate: number
  splash: number
  slowFactor: number
  slowDur: number
  chainCount: number
  chainFalloff: number
  dotDps: number
  dotDur: number
  pierce: number
  critChance: number
  critMult: number
  stunChance: number
  stunDur: number
  shred: number
  auraDamage: number
  auraRange: number
  auraGold: number
  spread: number
  projectileSpeed: number
  hitsAir: boolean
  kind: ProjectileKind
}

export interface TowerLevel {
  cost: number
  label: string
  desc: string
  stats: Partial<TowerStats>
}

export interface BranchDef {
  name: string
  tag: string
  desc: string
  levels: TowerLevel[]
}

export interface TowerDef {
  id: TowerId
  name: string
  role: string
  tagline: string
  gradient: [string, string]
  accent: string
  base: TowerStats
  levels: TowerLevel[]
  branches: Record<Branch, BranchDef>
}

export interface EnemyDef {
  id: EnemyId
  name: string
  blurb: string
  hp: number
  speed: number
  armor: number
  shield: number
  bounty: number
  radius: number
  damage: number
  flying: boolean
  boss: boolean
  legs: number
  body: [string, string]
  eye: string
  heal?: { amount: number; radius: number; interval: number }
  split?: { into: EnemyId; count: number }
  shieldRegen?: number
}

export interface WaveGroup {
  enemy: EnemyId
  count: number
  gap: number
  delay: number
}

export interface WaveDef {
  groups: WaveGroup[]
  label: string
  boss?: boolean
}

export interface MapDef {
  id: string
  name: string
  blurb: string
  waypoints: Array<[number, number]>
  decor: Array<[number, number]>
  /** Plataformas de torre. Só nelas dá para construir — desenhadas à mão por mapa. */
  pads: Array<[number, number]>
  gold: number
  lives: number
  hpScale: number
  unlockAt: number
  tint: [string, string]
}

export interface Effect {
  slowFactor: number
  slowUntil: number
  stunUntil: number
  dotDps: number
  dotUntil: number
  shred: number
  markUntil: number
}

export interface Enemy {
  uid: number
  def: EnemyDef
  hp: number
  maxHp: number
  armor: number
  shield: number
  maxShield: number
  shieldCooldown: number
  dist: number
  x: number
  y: number
  angle: number
  speed: number
  phase: number
  scale: number
  fx: Effect
  healTimer: number
  dead: boolean
  leaked: boolean
  spawnFlash: number
  hitFlash: number
  generation: number
}

export interface Tower {
  uid: number
  def: TowerDef
  col: number
  row: number
  x: number
  y: number
  level: number
  branch: Branch | null
  angle: number
  cooldown: number
  spent: number
  kills: number
  damage: number
  recoil: number
  bob: number
  targetUid: number | null
  charge: number
}

export interface Projectile {
  uid: number
  kind: ProjectileKind
  x: number
  y: number
  tx: number
  ty: number
  vx: number
  vy: number
  speed: number
  targetUid: number | null
  damage: number
  splash: number
  pierce: number
  slowFactor: number
  slowDur: number
  dotDps: number
  dotDur: number
  shred: number
  stunChance: number
  stunDur: number
  chainLeft: number
  chainFalloff: number
  color: string
  color2: string
  life: number
  trail: Array<[number, number]>
  crit: boolean
  hitAir: boolean
  ownerUid: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  kind: 'spark' | 'smoke' | 'ring' | 'shard' | 'bolt'
  angle: number
}

export interface FloatText {
  x: number
  y: number
  vy: number
  life: number
  text: string
  color: string
  size: number
}

export interface Blessing {
  id: string
  name: string
  desc: string
  icon: string
  rarity: 'comum' | 'rara' | 'lendaria'
  apply: (m: Modifiers) => void
  max?: number
}

export interface Modifiers {
  damageMul: number
  rangeMul: number
  rateMul: number
  splashMul: number
  slowMul: number
  dotMul: number
  chainBonus: number
  critChance: number
  critMult: number
  goldPerKill: number
  goldMul: number
  costMul: number
  sellRate: number
  energyRegen: number
  startGold: number
  startLives: number
  interestRate: number
  draftSize: number
  prismaMul: number
  bossDamageMul: number
  firstStrike: number
  overkillGold: number
}

export interface SkillNode {
  id: string
  name: string
  desc: string
  cost: number
  ranks: number
  tier: number
  icon: string
  apply: (m: Modifiers, rank: number) => void
}

export interface Achievement {
  id: string
  name: string
  desc: string
  reward: number
}

export interface SaveData {
  prismas: number
  skills: Record<string, number>
  unlockedMaps: string[]
  achievements: string[]
  bestWave: Record<string, number>
  totalKills: number
  totalRuns: number
  wins: number
  muted: boolean
  playerName: string
  /** Mapas cuja abertura de capítulo já foi assistida. */
  seenIntros: string[]
  /** Torres cujo cartão de estreia já foi mostrado. */
  seenTowerTips: string[]
}

export interface HudSnapshot {
  status: GameStatus
  wave: number
  maxWaves: number
  gold: number
  lives: number
  maxLives: number
  energy: number
  maxEnergy: number
  kills: number
  score: number
  speed: number
  prepTimer: number
  waveProgress: number
  enemiesLeft: number
  endless: boolean
  selectedTower: Tower | null
  selectedSlot: [number, number] | null
  buildChoice: TowerId | null
  draft: Blessing[] | null
  blessings: Array<{ id: string; count: number }>
  abilities: Record<AbilityId, number>
  earnedPrismas: number
  combo: number
  lastMessage: string
  messageKey: number
  synergies: string[]
}

export type GameStatus =
  | 'prep'
  | 'wave'
  | 'draft'
  | 'victory'
  | 'defeat'
