import type { EnemyDef, EnemyId, MapDef } from '../build/game/types'
const E = (id: EnemyId, radius: number, legs: number, flying: boolean, boss: boolean, extra: Partial<EnemyDef> = {}): EnemyDef =>
  ({ id, name: id, blurb: '', hp: 1, speed: 60, armor: 0, shield: 0, bounty: 0, radius, damage: 1,
     flying, boss, legs, body: ['#000', '#000'], eye: '#fff', ...extra }) as EnemyDef

export const ENEMY_DEFS: Record<EnemyId, EnemyDef> = {
  rastejante: E('rastejante', 22, 4, false, false),
  corredor: E('corredor', 19, 2, false, false),
  couracado: E('couracado', 26, 6, false, false),
  espectro: E('espectro', 22, 0, true, false),
  arcano: E('arcano', 24, 4, false, false, { shield: 76 }),
  curandeiro: E('curandeiro', 23, 4, false, false, { heal: { amount: 20, radius: 140, interval: 1.5 } }),
  divisor: E('divisor', 29, 6, false, false),
  cria: E('cria', 16, 4, false, false),
  lamina: E('lamina', 25, 4, false, false),
  devorador: E('devorador', 42, 6, false, true, { shield: 420 }),
  tita: E('tita', 52, 8, false, true, { shield: 1100 }),
}
export const ENEMY_ORDER: EnemyId[] = ['rastejante','corredor','couracado','espectro','arcano','curandeiro','divisor','cria','lamina','devorador','tita']
export const TOWER_ORDER = ['faisca','gelido','estilhaco','voltaico','alquimico','lanca','farol'] as const

const M = (id: string, waypoints: Array<[number, number]>, decor: Array<[number, number]>, pads: Array<[number, number]>): MapDef =>
  ({ id, name: id, blurb: '', waypoints, decor, pads, gold: 280, lives: 20, hpScale: 1, unlockAt: 0, tint: ['#173c4c', '#0c1f2c'] })

export const MAPS: Record<string, MapDef> = {
  jardim: M('jardim', [[-1,4],[2,4],[2,1],[5,1],[5,6],[8,6],[8,2],[11,2],[11,7]], [[0,0],[6,0],[12,0],[0,8],[6,8],[9,4]],
    [[1,3],[1,5],[3,2],[3,4],[4,0],[4,3],[6,1],[6,3],[6,5],[7,4],[7,7],[9,1],[9,3],[9,5],[10,4],[12,2],[12,4]]),
  obsidiana: M('obsidiana', [[-1,1],[3,1],[3,4],[1,4],[1,7],[6,7],[6,3],[9,3],[9,7],[11,7]], [[0,0],[6,0],[12,0],[0,8],[4,5],[8,5]],
    [[1,0],[3,0],[2,2],[4,2],[4,4],[0,5],[2,5],[0,7],[3,6],[5,6],[5,3],[7,2],[8,4],[8,6],[10,4]]),
  cume: M('cume', [[-1,7],[2,7],[2,4],[5,4],[5,7],[8,7],[8,3],[6,3],[6,1],[11,1],[11,6]], [[0,0],[3,0],[0,8],[3,8],[9,8],[9,4]],
    [[1,4],[1,6],[3,3],[3,6],[4,5],[4,7],[5,2],[6,6],[7,2],[7,5],[8,0],[9,2],[9,5],[10,3],[12,1],[12,3]]),
}
