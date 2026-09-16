import { describe, expect, it } from 'vitest'
import { CAMPAIGN_WAVES, TOWERS, TOWER_ORDER, getWave } from '../src/game/content'
import { MAX_LEVEL, isMaxed, nextUpgrade } from '../src/game/upgrades'
import type { Branch } from '../src/game/types'

/**
 * Regressão do crash "cannot read properties of undefined (reading 'label')".
 *
 * A causa era indexar `levels` por nível sem conferir o tamanho: o tronco tem 3
 * entradas em `levels` e cada ramo tem 2, então `levels[level - 3]` no nível 5
 * pedia o índice 2 de um array de dois.
 * O teste varre a matriz inteira em vez de conferir o caso que quebrou.
 */

const RAMOS: Array<Branch | null> = ['a', 'b', null]

describe('próxima melhoria', () => {
  it('nunca estoura, em nenhuma torre, ramo ou nível', () => {
    for (const id of TOWER_ORDER) {
      for (const ramo of RAMOS) {
        for (let nivel = -2; nivel <= MAX_LEVEL + 3; nivel++) {
          const alvo = () => nextUpgrade(TOWERS[id], nivel, ramo)
          expect(alvo, `${id} ramo=${ramo} nivel=${nivel}`).not.toThrow()
          const r = alvo()
          if (r !== null) {
            expect(typeof r.label, `${id} nivel=${nivel}`).toBe('string')
            expect(typeof r.desc).toBe('string')
            expect(r.cost).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('no teto não há próxima, com ramo ou sem', () => {
    for (const id of TOWER_ORDER) {
      for (const ramo of RAMOS) {
        expect(nextUpgrade(TOWERS[id], MAX_LEVEL, ramo)).toBeNull()
        expect(nextUpgrade(TOWERS[id], MAX_LEVEL + 1, ramo)).toBeNull()
      }
      expect(isMaxed(MAX_LEVEL)).toBe(true)
      expect(isMaxed(MAX_LEVEL - 1)).toBe(false)
    }
  })

  it('no nível 3 a próxima é a escolha de ramo, que não tem rótulo único', () => {
    for (const id of TOWER_ORDER) {
      for (const ramo of RAMOS) expect(nextUpgrade(TOWERS[id], 3, ramo)).toBeNull()
    }
  })

  it('o caminho inteiro de cada torre tem rótulo em 1, 2 e 4', () => {
    for (const id of TOWER_ORDER) {
      const def = TOWERS[id]
      expect(nextUpgrade(def, 1, null)?.label).toBe(def.levels[1]!.label)
      expect(nextUpgrade(def, 2, null)?.label).toBe(def.levels[2]!.label)
      for (const b of ['a', 'b'] as Branch[]) {
        expect(nextUpgrade(def, 4, b)?.label).toBe(def.branches[b].levels[1]!.label)
      }
    }
  })

  it('no nível 4 sem ramo escolhido não há próxima', () => {
    for (const id of TOWER_ORDER) expect(nextUpgrade(TOWERS[id], 4, null)).toBeNull()
  })
})

describe('getWave', () => {
  it('nunca devolve undefined, nem em 0, nem negativo, nem no infinito', () => {
    for (const n of [-5, 0, 1, 2, CAMPAIGN_WAVES.length, CAMPAIGN_WAVES.length + 1, 137]) {
      const def = getWave(n)
      expect(def, `onda ${n}`).toBeDefined()
      expect(typeof def.label, `onda ${n}`).toBe('string')
      expect(def.groups.length, `onda ${n}`).toBeGreaterThan(0)
    }
  })
})
