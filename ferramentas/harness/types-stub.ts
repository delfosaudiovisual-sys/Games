// Recorte fiel de src/game/types.ts, só para checagem local. NÃO é enviado.
export type TowerId = 'faisca' | 'estilhaco' | 'gelido' | 'voltaico' | 'lanca' | 'alquimico' | 'farol'
export type EnemyId =
  | 'rastejante' | 'corredor' | 'couracado' | 'espectro' | 'arcano' | 'curandeiro'
  | 'divisor' | 'cria' | 'lamina' | 'devorador' | 'tita'
export type Branch = 'a' | 'b'
export type ProjectileKind = 'bolt' | 'mortar' | 'beam' | 'chain' | 'orb' | 'none'

export interface TowerStats {
  damage: number; range: number; rate: number; splash: number; slowFactor: number; slowDur: number
  chainCount: number; chainFalloff: number; dotDps: number; dotDur: number; pierce: number
  critChance: number; critMult: number; stunChance: number; stunDur: number; shred: number
  auraDamage: number; auraRange: number; auraGold: number; spread: number; projectileSpeed: number
  hitsAir: boolean; kind: ProjectileKind
}
export interface TowerLevel { cost: number; label: string; desc: string; stats: Partial<TowerStats> }
export interface BranchDef { name: string; tag: string; desc: string; levels: TowerLevel[] }
export interface TowerDef {
  id: TowerId; name: string; role: string; tagline: string
  gradient: [string, string]; accent: string; base: TowerStats
  levels: TowerLevel[]; branches: Record<Branch, BranchDef>
}
export interface EnemyDef {
  id: EnemyId; name: string; blurb: string; hp: number; speed: number; armor: number; shield: number
  bounty: number; radius: number; damage: number; flying: boolean; boss: boolean; legs: number
  body: [string, string]; eye: string
  heal?: { amount: number; radius: number; interval: number }
  split?: { into: EnemyId; count: number }
  shieldRegen?: number
}
export interface Effect {
  slowFactor: number; slowUntil: number; stunUntil: number; dotDps: number; dotUntil: number
  shred: number; markUntil: number
}
export interface Enemy {
  uid: number; def: EnemyDef; hp: number; maxHp: number; armor: number; shield: number
  maxShield: number; shieldCooldown: number; dist: number; x: number; y: number; angle: number
  speed: number; phase: number; scale: number; fx: Effect; healTimer: number; dead: boolean
  leaked: boolean; spawnFlash: number; hitFlash: number; generation: number
}
export interface Tower {
  uid: number; def: TowerDef; col: number; row: number; x: number; y: number; level: number
  branch: Branch | null; angle: number; cooldown: number; spent: number; kills: number
  damage: number; recoil: number; bob: number; targetUid: number | null; charge: number
}
export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number
  color: string; kind: 'spark' | 'smoke' | 'ring' | 'shard' | 'bolt'; angle: number
}
export interface Projectile {
  uid: number; kind: ProjectileKind; x: number; y: number; color: string; crit: boolean
  trail: Array<[number, number]>
}
export interface FloatText { x: number; y: number; vy: number; life: number; text: string; color: string; size: number }
export interface MapDef {
  id: string; name: string; blurb: string; waypoints: Array<[number, number]>
  decor: Array<[number, number]>; pads: Array<[number, number]>; gold: number; lives: number; hpScale: number
  unlockAt: number; tint: [string, string]
}
