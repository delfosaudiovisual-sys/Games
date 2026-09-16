import { it } from 'vitest'
import { Engine } from '../src/game/engine'
import { COLS, MAPS, ROWS, defaultModifiers } from '../src/game/content'
import { unlockedTowers } from '../src/game/unlock'
/* eslint-disable @typescript-eslint/no-explicit-any */
type E = any
/** Devolve o isBuildable ANTIGO: qualquer celula nao bloqueada. */
function livre(e: E) {
  e.isBuildable = function (c: number, r: number) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false
    if (this.blocked.has(`${c},${r}`)) return false
    return !this.towers.some((t: E) => t.col === c && t.row === r)
  }
}
/** Jogador automatico: constroi enquanto houver vaga e ouro, senao melhora o mais barato. */
function loja(e: E) {
  for (let g = 0; g < 80; g++) {
    const vagas: Array<[number, number]> = []
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (e.isBuildable(c, r)) vagas.push([c, r])
    // Comparacao justa: no modo livre, preferir celulas coladas na estrada.
    // Sem isso o jogador automatico enche o canto do mapa de torres inuteis
    // e o modo livre parece pior do que e.
    const perto = (c: number, r: number) => {
      let melhor = 1e9
      for (const k of e.pathCells) {
        const [pc, pr] = (k as string).split(',').map(Number)
        const d = Math.abs(pc - c) + Math.abs(pr - r)
        if (d < melhor) melhor = d
      }
      return melhor
    }
    vagas.sort((x, y) => perto(x[0], x[1]) - perto(y[0], y[1]))
    // Ciente do desbloqueio: o jogador automatico so constroi o que a onda
    // atual liberou, como um jogador de primeira viagem. E o caso pior — quem
    // ja avancou comeca a partida com o arsenal inteiro.
    const pool = unlockedTowers(e.wave)
    const id = pool[e.towers.length % pool.length]
    if (vagas.length && e.gold >= e.buildCost(id)) { e.tryBuild(vagas[0][0], vagas[0][1], id); continue }
    const ups = e.towers.filter((t: E) => t.level < 5)
      .map((t: E) => ({ t, c: t.level === 3 ? e.upgradeCost(t, 'a') : e.upgradeCost(t) }))
      .filter((x: E) => Number.isFinite(x.c) && x.c <= e.gold)
      .sort((a: E, b: E) => a.c - b.c)
    if (!ups.length) break
    e.tryUpgrade(ups[0].t.uid, ups[0].t.level === 3 ? 'a' : undefined)
  }
}
function roda(mi: number, modoLivre: boolean) {
  const e: E = new Engine(MAPS[mi], defaultModifiers(), false)
  e.recomputeMods()
  if (modoLivre) livre(e)
  const dt = 1 / 30
  for (let i = 0; i < 400000; i++) {
    if (e.status === 'victory' || e.status === 'defeat') break
    if (e.status === 'draft') { e.pickDraft(e.draft[0]); continue }
    if (i % 60 === 0) loja(e)
    e.update(dt)
  }
  return { wave: e.wave, lives: Math.max(0, e.lives), max: e.maxLives, st: e.status, tw: e.towers.length }
}
it.skipIf(!process.env.SIM)('relatorio de balanceamento', () => {
  const N = Number(process.env.N ?? 3)
  console.log('\n mapa               modo     onda   vidas      torres  vitorias')
  for (const mi of [0, 1, 2]) {
    for (const fm of [false, true]) {
      const rs = Array.from({ length: N }, () => roda(mi, fm))
      const m = (f: (r: typeof rs[0]) => number) => rs.reduce((a, r) => a + f(r), 0) / N
      console.log(
        ` ${MAPS[mi].name.padEnd(18)} ${(fm ? 'LIVRE' : 'PLATAF').padEnd(8)} ` +
        `${m(r => r.wave).toFixed(1).padStart(4)}   ` +
        `${m(r => r.lives).toFixed(1).padStart(4)}/${rs[0].max}   ` +
        `${m(r => r.tw).toFixed(1).padStart(5)}   ${rs.filter(r => r.st === 'victory').length}/${N}`,
      )
    }
  }
}, 900000)
