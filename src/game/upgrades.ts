import type { Branch, TowerDef, TowerLevel } from './types'

/** Nível máximo de uma torre. Acima disso não há próxima melhoria. */
export const MAX_LEVEL = 5

/**
 * A próxima melhoria de uma torre, ou `null` quando não existe.
 *
 * Existe porque a indexação por nível é uma armadilha: o tronco tem 3 entradas
 * em `levels` (a primeira é a construção, não uma melhoria) e cada ramo tem
 * 2 — então `levels[level - 3]` no nível 5 pede o índice 2 de um array de dois
 * e devolve `undefined`. Era o crash "cannot read properties of undefined
 * (reading 'label')": aparecia ao TOCAR numa torre já no máximo, o que só
 * acontece depois de um tempo de jogo.
 *
 * Toda a aritmética de nível mora aqui, e `__tests__/melhorias.test.ts` varre
 * a matriz inteira de torre × ramo × nível.
 */
export function nextUpgrade(def: TowerDef, level: number, branch: Branch | null): TowerLevel | null {
  if (!Number.isFinite(level) || level < 1) return null
  // 1 → 2 → 3 sobem pelo tronco; `levels[0]` é a construção, então o índice
  // da próxima melhoria é o próprio nível atual.
  if (level < 3) return def.levels[level] ?? null
  // No 3 a próxima escolha é o ramo, e ela não tem rótulo único.
  if (level === 3) return null
  if (level >= MAX_LEVEL || !branch) return null
  return def.branches[branch].levels[level - 3] ?? null
}

/** Está no teto? Usado para mostrar "nível máximo" em vez de um botão. */
export function isMaxed(level: number): boolean {
  return level >= MAX_LEVEL
}
