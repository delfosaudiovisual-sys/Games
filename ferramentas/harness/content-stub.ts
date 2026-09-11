import type { TowerDef, TowerId, TowerStats } from './types'
export const CELL = 64, COLS = 13, ROWS = 9
export const FIELD_W = COLS * CELL, FIELD_H = ROWS * CELL
export const METEOR_RADIUS = CELL * 2.4
const R: Record<TowerId, number> = { faisca:177, estilhaco:258, gelido:194, voltaico:200, lanca:380, alquimico:206, farol:0 }
const A: Record<TowerId, number> = { faisca:0, estilhaco:0, gelido:0, voltaico:0, lanca:0, alquimico:0, farol:224 }
const G: Record<TowerId, [string,string]> = {
  faisca:['#6ee7ff','#1d64d8'], estilhaco:['#ffc23d','#e0621a'], gelido:['#a8f7ff','#0891b2'],
  voltaico:['#cbb2ff','#7c3aed'], lanca:['#f7b0ff','#a21caf'], alquimico:['#c5f74f','#15803d'], farol:['#ffb0bf','#e11d48'],
}
const ids: TowerId[] = ['faisca','estilhaco','gelido','voltaico','lanca','alquimico','farol']
export const TOWERS = Object.fromEntries(ids.map((id) => [id, {
  id, name: id, role: '', tagline: '', gradient: G[id], accent: G[id][0],
  base: { range: R[id], auraRange: A[id], spread: 1 } as unknown as TowerStats,
  levels: [], branches: {},
} as unknown as TowerDef])) as Record<TowerId, TowerDef>
