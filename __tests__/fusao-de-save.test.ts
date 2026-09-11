import { describe, expect, it } from 'vitest'
import { emptySave, mergeSaves, parseSave, skillSpent } from '../src/game/save'
import type { SaveData } from '../src/game/types'

const ganho = (s: SaveData) => s.prismas + skillSpent(s)

function sv(p: Partial<SaveData>): SaveData {
  return { ...emptySave(), ...p }
}

describe('fusão local × nuvem', () => {
  it('não duplica prismas: a economia vem inteira do lado mais avançado', () => {
    const local = sv({ prismas: 100 })
    const nuvem = sv({ prismas: 50, skills: { sabedoria: 2, fortuna: 3 } })
    expect(ganho(nuvem)).toBeGreaterThan(ganho(local))

    const r = mergeSaves(local, nuvem)
    // economia idêntica à do lado escolhido — nada é somado
    expect(r.prismas).toBe(nuvem.prismas)
    expect(r.skills).toEqual(nuvem.skills)
    expect(ganho(r)).toBe(ganho(nuvem))
  })

  it('escolhe o local quando ele está mais avançado', () => {
    const local = sv({ prismas: 40, skills: { sabedoria: 2 } })
    const nuvem = sv({ prismas: 10 })
    const r = mergeSaves(local, nuvem)
    expect(r.prismas).toBe(40)
    expect(r.skills).toEqual({ sabedoria: 2 })
  })

  it('une o que não é econômico pelo melhor dos dois', () => {
    const local = sv({
      prismas: 200,
      unlockedMaps: ['jardim', 'obsidiana'],
      achievements: ['vitoria'],
      bestWave: { jardim: 20, obsidiana: 4 },
      totalKills: 900, wins: 3, totalRuns: 11,
    })
    const nuvem = sv({
      prismas: 5,
      unlockedMaps: ['jardim', 'cume'],
      achievements: ['titan'],
      bestWave: { jardim: 12, cume: 31 },
      totalKills: 40, wins: 9, totalRuns: 2,
    })
    const r = mergeSaves(local, nuvem)
    expect(r.unlockedMaps.sort()).toEqual(['cume', 'jardim', 'obsidiana'])
    expect(r.achievements.sort()).toEqual(['titan', 'vitoria'])
    expect(r.bestWave).toEqual({ jardim: 20, obsidiana: 4, cume: 31 })
    expect(r.totalKills).toBe(900)
    expect(r.wins).toBe(9)
    expect(r.totalRuns).toBe(11)
  })

  it('é comutativo no resultado', () => {
    const a = sv({ prismas: 70, achievements: ['onda10'], bestWave: { jardim: 9 } })
    const b = sv({ prismas: 30, skills: { foco: 3 }, achievements: ['rico'], bestWave: { jardim: 14 } })
    const ab = mergeSaves(a, b)
    const ba = mergeSaves(b, a)
    expect(ab.prismas).toBe(ba.prismas)
    expect(ab.skills).toEqual(ba.skills)
    expect(ab.bestWave).toEqual(ba.bestWave)
    expect(ab.achievements.sort()).toEqual(ba.achievements.sort())
  })

  it('parseSave tolera lixo e preenche o que falta', () => {
    expect(parseSave(null)).toBeNull()
    expect(parseSave('{quebrado')).toBeNull()
    const r = parseSave('{"prismas":12}')
    expect(r?.prismas).toBe(12)
    expect(r?.unlockedMaps).toContain('jardim')
    expect(r?.achievements).toEqual([])
  })
})
