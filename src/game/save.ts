import { MAPS, SKILL_BY_ID, defaultModifiers } from './content'
import type { Modifiers, SaveData } from './types'

const KEY = 'prisma-td-save-v1'

export function emptySave(): SaveData {
  return {
    prismas: 0,
    skills: {},
    unlockedMaps: [MAPS[0].id],
    achievements: [],
    bestWave: {},
    totalKills: 0,
    totalRuns: 0,
    wins: 0,
    muted: false,
    playerName: '',
  }
}

export function loadSave(): SaveData {
  if (typeof window === 'undefined') return emptySave()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return emptySave()
    const parsed = JSON.parse(raw) as Partial<SaveData>
    const base = emptySave()
    return {
      ...base,
      ...parsed,
      skills: { ...base.skills, ...(parsed.skills ?? {}) },
      unlockedMaps: Array.from(new Set([...base.unlockedMaps, ...(parsed.unlockedMaps ?? [])])),
      achievements: parsed.achievements ?? [],
      bestWave: { ...(parsed.bestWave ?? {}) },
      playerName: parsed.playerName ?? '',
    }
  } catch {
    return emptySave()
  }
}

export function persistSave(data: SaveData): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* armazenamento indisponível — o jogo segue sem salvar */
  }
}

export function skillModifiers(save: SaveData): Modifiers {
  const m = defaultModifiers()
  for (const [id, rank] of Object.entries(save.skills)) {
    if (!rank) continue
    const node = SKILL_BY_ID[id]
    if (node) node.apply(m, Math.min(rank, node.ranks))
  }
  return m
}

export function skillSpent(save: SaveData): number {
  let total = 0
  for (const [id, rank] of Object.entries(save.skills)) {
    const node = SKILL_BY_ID[id]
    if (!node) continue
    for (let r = 1; r <= Math.min(rank, node.ranks); r++) total += node.cost * r
  }
  return total
}

export function skillCost(id: string, currentRank: number): number {
  const node = SKILL_BY_ID[id]
  if (!node) return Infinity
  return node.cost * (currentRank + 1)
}

/* ------------------------------------------------------------------ */
/* fusão local × nuvem                                                 */
/* ------------------------------------------------------------------ */

/** Prismas em caixa + já gastos = total que o jogador ganhou na vida. */
function totalGanho(s: SaveData): number {
  return s.prismas + skillSpent(s)
}

/**
 * Funde o progresso local com o da conta ao vincular pela primeira vez.
 *
 * A economia (prismas em caixa + ranks da árvore) vem INTEIRA de um lado só,
 * o mais avançado. Misturar os dois duplicaria moeda: um rank comprado no
 * celular sairia de graça se somássemos os prismas do computador.
 *
 * O que não é econômico — mapas destravados, conquistas, recordes, contadores
 * — é unido pelo melhor dos dois, porque não dá para farmar nada com isso.
 * Conquista herdada do outro lado vem sem o prêmio em prismas, de propósito:
 * é o lado conservador do trade-off.
 */
export function mergeSaves(a: SaveData, b: SaveData): SaveData {
  const base = totalGanho(a) >= totalGanho(b) ? a : b
  const outro = base === a ? b : a

  const bestWave: Record<string, number> = { ...a.bestWave }
  for (const [id, w] of Object.entries(b.bestWave)) {
    bestWave[id] = Math.max(bestWave[id] ?? 0, w)
  }

  return {
    ...base,
    skills: { ...base.skills },
    unlockedMaps: Array.from(new Set([...a.unlockedMaps, ...b.unlockedMaps])),
    achievements: Array.from(new Set([...a.achievements, ...b.achievements])),
    bestWave,
    totalKills: Math.max(a.totalKills, b.totalKills),
    totalRuns: Math.max(a.totalRuns, b.totalRuns),
    wins: Math.max(a.wins, b.wins),
    playerName: base.playerName || outro.playerName,
  }
}

/** Lê um save vindo da nuvem, tolerando JSON inválido ou campos faltando. */
export function parseSave(raw: string | null | undefined): SaveData | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<SaveData>
    const base = emptySave()
    return {
      ...base,
      ...p,
      skills: { ...base.skills, ...(p.skills ?? {}) },
      unlockedMaps: Array.from(new Set([...base.unlockedMaps, ...(p.unlockedMaps ?? [])])),
      achievements: p.achievements ?? [],
      bestWave: { ...(p.bestWave ?? {}) },
      playerName: p.playerName ?? '',
    }
  } catch {
    return null
  }
}
