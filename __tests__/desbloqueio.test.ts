import { describe, expect, it } from 'vitest'
import { CAMPAIGN_WAVES, ENEMIES, MAPS, TOWERS, TOWER_ORDER } from '../src/game/content'
import { ARSENAL, nextUnlock, progressOf, towerTip, unlockWave, unlockedTowers } from '../src/game/unlock'

/**
 * A escada de desbloqueio é conteúdo, e conteúdo apodrece: basta alguém mexer
 * na ordem das ondas para o jogador ficar sem resposta a uma ameaça. Estes
 * testes derivam as ameaças de `CAMPAIGN_WAVES`, não de números escritos aqui
 * — se alguém antecipar as Rasuras, é este arquivo que quebra.
 */

/** Primeira onda da campanha que traz inimigo voador (1-indexada). */
const primeiraOndaAerea = (() => {
  for (let i = 0; i < CAMPAIGN_WAVES.length; i++) {
    if (CAMPAIGN_WAVES[i].groups.some((g) => ENEMIES[g.enemy].flying)) return i + 1
  }
  return Infinity
})()

const atira = (id: (typeof TOWER_ORDER)[number]) => TOWERS[id].base.kind !== 'none'
const pegaVoador = (id: (typeof TOWER_ORDER)[number]) => TOWERS[id].base.hitsAir !== false

describe('escada de desbloqueio', () => {
  it('cobre todas as torres, uma vez cada, com dica', () => {
    expect(ARSENAL.map((a) => a.id).sort()).toEqual([...TOWER_ORDER].sort())
    for (const { id, tip } of ARSENAL) {
      expect(tip.length, `${id} sem dica`).toBeGreaterThan(40)
    }
  })

  it('não anda para trás', () => {
    const ondas = ARSENAL.map((a) => a.wave)
    expect([...ondas].sort((a, b) => a - b)).toEqual(ondas)
  })

  it('começa com pelo menos duas torres, e uma que atira', () => {
    const inicio = unlockedTowers(0)
    expect(inicio.length).toBeGreaterThanOrEqual(2)
    expect(inicio.some(atira)).toBe(true)
  })

  it('o ouro inicial de todo mapa compra alguma torre liberada', () => {
    const inicio = unlockedTowers(0)
    for (const m of MAPS) {
      const maisBarata = Math.min(...inicio.map((id) => TOWERS[id].levels[0].cost))
      expect(m.gold, `${m.name} não compra nada`).toBeGreaterThanOrEqual(maisBarata)
    }
  })

  it('dá uma resposta aos voadores antes de eles chegarem', () => {
    expect(primeiraOndaAerea).toBeLessThan(Infinity)
    // O desbloqueio acontece no preparo DA onda seguinte, então uma torre
    // liberada "na onda N" está na mão para enfrentar a onda N+1.
    const naMao = unlockedTowers(primeiraOndaAerea - 1)
    expect(naMao.filter((id) => atira(id) && pegaVoador(id)).length).toBeGreaterThan(0)
  })

  it('libera tudo dentro da campanha', () => {
    expect(unlockedTowers(CAMPAIGN_WAVES.length)).toHaveLength(TOWER_ORDER.length)
    expect(nextUnlock(CAMPAIGN_WAVES.length)).toBeNull()
  })

  it('só cresce conforme o progresso', () => {
    for (let w = 1; w <= CAMPAIGN_WAVES.length; w++) {
      const antes = unlockedTowers(w - 1)
      const depois = unlockedTowers(w)
      expect(depois).toEqual(expect.arrayContaining(antes))
    }
  })

  it('nextUnlock aponta a próxima, e unlockWave concorda', () => {
    const prox = nextUnlock(0)
    expect(prox).not.toBeNull()
    expect(unlockWave(prox!.id)).toBe(prox!.wave)
    expect(prox!.wave).toBeGreaterThan(0)
  })

  it('progresso é a onda mais alta de qualquer mapa', () => {
    expect(progressOf({})).toBe(0)
    expect(progressOf({ jardim: 4, obsidiana: 11, cume: 2 })).toBe(11)
  })

  it('towerTip responde para toda torre', () => {
    for (const id of TOWER_ORDER) expect(towerTip(id)).not.toBe('')
  })
})
