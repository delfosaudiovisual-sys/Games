import type { TowerId } from './types'

/**
 * O arsenal, na ordem em que o jogo ensina.
 *
 * Sete torres de uma vez, na primeira onda, é a razão pela qual a lista ficava
 * enorme e a escolha ficava vazia: o jogador novo não tem como saber qual das
 * sete resolve o problema que ele ainda não viu. Então cada torre entra no
 * momento em que a ameaça que ela responde aparece — e entra com uma dica.
 *
 * `wave` é a onda da campanha a partir da qual a torre existe. Compare sempre
 * com o PROGRESSO (a onda mais alta já alcançada em qualquer mapa), não com a
 * onda da partida atual: o desbloqueio é permanente, quem já chegou na onda 14
 * começa a próxima partida com tudo na mão.
 *
 * A ordem deste array é a ordem de exibição e a dos atalhos 1..7, e ela não
 * muda conforme as torres entram — o atalho de uma torre é para sempre o mesmo.
 */
export const ARSENAL: Array<{ id: TowerId; wave: number; tip: string }> = [
  {
    id: 'faisca',
    wave: 0,
    tip: 'Alvo único, barata, sempre atirando. Duas Lápis cobrindo a mesma curva resolvem o começo de qualquer página.',
  },
  {
    id: 'gelido',
    wave: 0,
    tip: 'O Giz quase não machuca: ele SEGURA. Ponha uma no início do caminho e todas as outras torres ganham tempo de tiro.',
  },
  {
    id: 'estilhaco',
    wave: 3,
    tip: 'Os Riscos vêm em bando, e bando é o que a explosão do Guache desmancha. Cuidado: morteiro não alcança quem voa.',
  },
  {
    id: 'lanca',
    wave: 5,
    tip: 'As Rasuras chegam voando na próxima onda, e o Guache não as pega. A Lupa pega — de longe, e com crítico.',
  },
  {
    id: 'voltaico',
    wave: 8,
    tip: 'O raio do Clipe salta entre inimigos colados. Numa reta cheia ele vale por três torres; contra um inimigo só, por meia.',
  },
  {
    id: 'alquimico',
    wave: 11,
    tip: 'O Mata-Borrão cura os outros mais rápido do que você os mata. O veneno do Solvente não para de contar — é o que vence a cura.',
  },
  {
    id: 'farol',
    wave: 14,
    tip: 'A Luminária não atira: ela dá dano e ouro para as vizinhas. Vale a plataforma só quando há torres em volta para potencializar.',
  },
]

export const UNLOCK_ORDER: TowerId[] = ARSENAL.map((a) => a.id)

const WAVE_OF = new Map(ARSENAL.map((a) => [a.id, a.wave]))
const TIP_OF = new Map(ARSENAL.map((a) => [a.id, a.tip]))

export function unlockWave(id: TowerId): number {
  return WAVE_OF.get(id) ?? 0
}

export function towerTip(id: TowerId): string {
  return TIP_OF.get(id) ?? ''
}

/** Onda mais alta já alcançada em qualquer mapa. É o progresso que libera. */
export function progressOf(bestWave: Record<string, number>): number {
  let best = 0
  for (const v of Object.values(bestWave)) if (v > best) best = v
  return best
}

export function unlockedTowers(progress: number): TowerId[] {
  return ARSENAL.filter((a) => a.wave <= progress).map((a) => a.id)
}

/** A próxima torre a entrar, para mostrar de onde vem a recompensa. */
export function nextUnlock(progress: number): { id: TowerId; wave: number } | null {
  const next = ARSENAL.find((a) => a.wave > progress)
  return next ? { id: next.id, wave: next.wave } : null
}
