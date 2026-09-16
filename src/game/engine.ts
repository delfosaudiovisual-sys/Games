import {
  ABILITIES,
  BLESSINGS,
  BLESSING_BY_ID,
  CELL,
  CHAIN_JUMP,
  COLS,
  ENEMIES,
  FIELD_H,
  FIELD_W,
  MAX_CAMPAIGN_WAVES,
  METEOR_RADIUS,
  PLAGUE_RADIUS,
  ROWS,
  SYNERGIES,
  TOWERS,
  defaultModifiers,
  getWave,
  waveBounty,
  waveHpMultiplier,
} from './content'
import { play } from './audio'
import type {
  AbilityId,
  Blessing,
  Branch,
  Enemy,
  EnemyDef,
  EnemyId,
  FloatText,
  GameStatus,
  HudSnapshot,
  MapDef,
  Modifiers,
  Particle,
  Projectile,
  Tower,
  TowerDef,
  TowerId,
  TowerStats,
} from './types'

export type Priority = 'first' | 'strong' | 'close'

export interface BeamFx {
  pts: number[]
  life: number
  max: number
  color: string
  width: number
}

export interface Vec {
  x: number
  y: number
}

const SYNERGY_RANGE = CELL * 2.25
const PREP_FIRST = 24
const PREP_NEXT = 12
const MAX_ENERGY = 100

let uidCounter = 1
const nextUid = () => uidCounter++

function key(col: number, row: number): string {
  return `${col},${row}`
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

function pointSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  if (len === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export class Engine {
  map: MapDef
  endless: boolean

  path: Vec[] = []
  cum: number[] = []
  totalLen = 0
  flyFrom: Vec = { x: 0, y: 0 }
  flyTo: Vec = { x: 0, y: 0 }
  flyLen = 0
  blocked = new Set<string>()
  pathCells = new Set<string>()
  padCells = new Set<string>()
  core: Vec = { x: 0, y: 0 }
  coreCell: [number, number] = [0, 0]
  entrance: Vec = { x: 0, y: 0 }
  entranceAngle = 0

  status: GameStatus = 'prep'
  wave = 0
  gold = 0
  lives = 0
  maxLives = 0
  energy = 40
  kills = 0
  leaked = 0
  score = 0
  speed = 1
  prepTimer = PREP_FIRST
  waveTime = 0
  time = 0
  combo = 0
  comboTimer = 0
  peakGold = 0

  towers: Tower[] = []
  enemies: Enemy[] = []
  enemyIndex = new Map<number, Enemy>()
  projectiles: Projectile[] = []
  particles: Particle[] = []
  texts: FloatText[] = []
  beams: BeamFx[] = []
  spawnQueue: Array<{ t: number; enemy: EnemyId; hpMul: number }> = []

  priorities = new Map<number, Priority>()
  plagued = new Set<number>()
  statsCache = new Map<number, TowerStats>()
  synergyCache = new Map<number, string[]>()
  synergyLinks: Array<[number, number, number, number, string]> = []

  baseMods: Modifiers
  mods: Modifiers
  blessings: string[] = []

  abilityCd: Record<AbilityId, number> = { meteoro: 0, estase: 0, reparo: 0 }
  pendingMeteor = false

  selectedTowerUid: number | null = null
  selectedSlot: [number, number] | null = null
  buildChoice: TowerId | null = null
  hover: [number, number] | null = null
  draft: Blessing[] | null = null

  message = ''
  messageKey = 0

  maxedTower = false
  perfectRun = true
  killedTitan = false
  maxSynergies = 0

  shake = 0

  constructor(map: MapDef, mods: Modifiers, endless: boolean) {
    this.map = map
    this.endless = endless
    this.baseMods = mods
    this.mods = { ...mods }
    this.buildGeometry()
    this.gold = Math.round(map.gold + mods.startGold)
    this.maxLives = map.lives + mods.startLives
    this.lives = this.maxLives
    this.peakGold = this.gold
    this.wave = 0
    this.prepTimer = PREP_FIRST
    this.say('Escolha uma torre e toque numa plataforma livre.')
  }

  /* ---------------- geometria ---------------- */

  private buildGeometry(): void {
    const pts = this.map.waypoints.map(([c, r]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }))
    this.path = pts
    this.cum = [0]
    let total = 0
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      this.cum.push(total)
    }
    this.totalLen = total
    this.core = pts[pts.length - 1]
    this.coreCell = this.map.waypoints[this.map.waypoints.length - 1]
    this.flyFrom = { x: pts[0].x, y: pts[0].y }
    this.flyTo = this.core
    this.flyLen = Math.hypot(this.flyTo.x - this.flyFrom.x, this.flyTo.y - this.flyFrom.y)

    // portão de entrada: primeiro ponto do caminho já dentro da tela
    const a = this.posAt(0, false)
    const b = this.posAt(CELL, false)
    this.entrance = b
    this.entranceAngle = Math.atan2(b.y - a.y, b.x - a.x)

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const cx = c * CELL + CELL / 2
        const cy = r * CELL + CELL / 2
        let near = false
        for (let i = 1; i < pts.length; i++) {
          if (pointSegmentDist(cx, cy, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) < CELL * 0.7) {
            near = true
            break
          }
        }
        if (near) {
          this.pathCells.add(key(c, r))
          this.blocked.add(key(c, r))
        }
      }
    }
    for (const [c, r] of this.map.decor) this.blocked.add(key(c, r))
    const [coreCol, coreRow] = this.coreCell
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) this.blocked.add(key(coreCol + dc, coreRow + dr))
    }
    // Plataformas: as únicas células construíveis. Vêm desenhadas à mão em
    // `content.ts`; a guarda contra `blocked` é só cinto de segurança.
    for (const [c, r] of this.map.pads) {
      if (!this.blocked.has(key(c, r))) this.padCells.add(key(c, r))
    }
  }

  posAt(d: number, flying: boolean): Vec {
    if (flying) {
      const t = Math.max(0, Math.min(1, d / this.flyLen))
      return {
        x: this.flyFrom.x + (this.flyTo.x - this.flyFrom.x) * t,
        y: this.flyFrom.y + (this.flyTo.y - this.flyFrom.y) * t,
      }
    }
    if (d <= 0) return this.path[0]
    if (d >= this.totalLen) return this.path[this.path.length - 1]
    let i = 1
    while (i < this.cum.length && this.cum[i] < d) i++
    const a = this.path[i - 1]
    const b = this.path[i]
    const segLen = this.cum[i] - this.cum[i - 1]
    const t = segLen === 0 ? 0 : (d - this.cum[i - 1]) / segLen
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

  isBuildable(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false
    if (!this.padCells.has(key(col, row))) return false
    return !this.towers.some((t) => t.col === col && t.row === row)
  }

  isPath(col: number, row: number): boolean {
    return this.pathCells.has(key(col, row))
  }

  towerAt(col: number, row: number): Tower | null {
    return this.towers.find((t) => t.col === col && t.row === row) ?? null
  }

  /* ---------------- modificadores ---------------- */

  recomputeMods(): void {
    const m = defaultModifiers()
    const base = this.baseMods
    m.damageMul = base.damageMul
    m.rangeMul = base.rangeMul
    m.rateMul = base.rateMul
    m.splashMul = base.splashMul
    m.slowMul = base.slowMul
    m.dotMul = base.dotMul
    m.chainBonus = base.chainBonus
    m.critChance = base.critChance
    m.critMult = base.critMult
    m.goldPerKill = base.goldPerKill
    m.goldMul = base.goldMul
    m.costMul = base.costMul
    m.sellRate = base.sellRate
    m.energyRegen = base.energyRegen
    m.interestRate = base.interestRate
    m.draftSize = base.draftSize
    m.prismaMul = base.prismaMul
    m.bossDamageMul = base.bossDamageMul
    m.firstStrike = base.firstStrike
    m.overkillGold = base.overkillGold
    m.startGold = base.startGold
    m.startLives = base.startLives

    for (const id of this.blessings) {
      const b = BLESSING_BY_ID[id]
      if (b) b.apply(m)
    }
    this.mods = m
    this.refreshTowerStats()
  }

  blessingCount(id: string): number {
    return this.blessings.filter((b) => b === id).length
  }

  refreshTowerStats(): void {
    this.statsCache.clear()
    this.synergyCache.clear()
    this.synergyLinks = []
    const seenLinks = new Set<string>()

    for (const t of this.towers) {
      const s = this.rawStats(t.def, t.level, t.branch)
      const m = this.mods
      let damageMul = m.damageMul
      let rangeMul = m.rangeMul
      let rateMul = m.rateMul
      let splashMul = m.splashMul
      let dotMul = m.dotMul
      let slowBonus = 1
      const syn: string[] = []

      for (const o of this.towers) {
        if (o.uid === t.uid || o.def.id !== 'farol') continue
        const os = this.rawStats(o.def, o.level, o.branch)
        const r = os.auraRange * m.rangeMul
        if (dist2(t.x, t.y, o.x, o.y) <= r * r) {
          damageMul *= 1 + os.auraDamage
          rateMul *= 1 + os.rate
        }
      }

      for (const def of SYNERGIES) {
        const isA = t.def.id === def.a
        const isB = t.def.id === def.b
        if (!isA && !isB) continue
        const otherId = isA ? def.b : def.a
        const partner = this.towers.find(
          (o) => o.uid !== t.uid && o.def.id === otherId && dist2(t.x, t.y, o.x, o.y) <= SYNERGY_RANGE * SYNERGY_RANGE,
        )
        if (!partner) continue
        const eff = isA ? def.effA : def.effB
        damageMul *= eff.damageMul ?? 1
        rangeMul *= eff.rangeMul ?? 1
        rateMul *= eff.rateMul ?? 1
        splashMul *= eff.splashMul ?? 1
        dotMul *= eff.dotMul ?? 1
        slowBonus *= eff.slowBonus ?? 1
        syn.push(def.id)
        const lk = t.uid < partner.uid ? `${t.uid}-${partner.uid}-${def.id}` : `${partner.uid}-${t.uid}-${def.id}`
        if (!seenLinks.has(lk)) {
          seenLinks.add(lk)
          this.synergyLinks.push([t.x, t.y, partner.x, partner.y, t.def.accent])
        }
      }

      const final: TowerStats = {
        ...s,
        damage: s.damage * damageMul,
        range: s.range * rangeMul,
        rate: s.rate * rateMul,
        splash: s.splash * splashMul,
        dotDps: s.dotDps * dotMul,
        slowFactor: s.slowFactor < 1 ? Math.max(0.1, s.slowFactor * m.slowMul * slowBonus) : 1,
        chainCount: s.chainCount > 0 ? s.chainCount + m.chainBonus : 0,
        critChance: s.damage > 0 ? Math.min(0.95, s.critChance + m.critChance) : 0,
        critMult: s.critMult + m.critMult,
        auraRange: s.auraRange * m.rangeMul,
      }
      this.statsCache.set(t.uid, final)
      this.synergyCache.set(t.uid, syn)
    }

    const active = new Set<string>()
    for (const list of this.synergyCache.values()) for (const s of list) active.add(s)
    this.maxSynergies = Math.max(this.maxSynergies, active.size)
  }

  rawStats(def: TowerDef, level: number, branch: Branch | null): TowerStats {
    let s: TowerStats = { ...def.base }
    for (let i = 0; i < Math.min(level, 3); i++) s = { ...s, ...def.levels[i].stats }
    if (level >= 4 && branch) {
      const br = def.branches[branch]
      for (let i = 0; i < level - 3; i++) s = { ...s, ...br.levels[i].stats }
    }
    return s
  }

  statsOf(t: Tower): TowerStats {
    return this.statsCache.get(t.uid) ?? this.rawStats(t.def, t.level, t.branch)
  }

  activeSynergies(): string[] {
    const set = new Set<string>()
    for (const list of this.synergyCache.values()) for (const s of list) set.add(s)
    return Array.from(set)
  }

  /* ---------------- custos ---------------- */

  buildCost(id: TowerId): number {
    return Math.round(TOWERS[id].levels[0].cost * this.mods.costMul)
  }

  upgradeCost(t: Tower, branch?: Branch): number {
    if (t.level >= 5) return Infinity
    if (t.level < 3) return Math.round(t.def.levels[t.level].cost * this.mods.costMul)
    const br = branch ?? t.branch
    if (!br) return Infinity
    return Math.round(t.def.branches[br].levels[t.level - 3].cost * this.mods.costMul)
  }

  sellValue(t: Tower): number {
    return Math.floor(t.spent * this.mods.sellRate)
  }

  /* ---------------- ações ---------------- */

  say(msg: string): void {
    this.message = msg
    this.messageKey++
  }

  selectSlot(col: number, row: number): void {
    const t = this.towerAt(col, row)
    if (t) {
      this.selectedTowerUid = t.uid
      this.selectedSlot = null
      return
    }
    if (this.isBuildable(col, row)) {
      this.selectedSlot = [col, row]
      this.selectedTowerUid = null
      if (this.buildChoice) this.tryBuild(col, row, this.buildChoice)
    } else {
      this.selectedSlot = null
      this.selectedTowerUid = null
      if (this.buildChoice) this.say('Aqui não dá. Só nas plataformas.')
    }
  }

  clearSelection(): void {
    this.selectedSlot = null
    this.selectedTowerUid = null
  }

  tryBuild(col: number, row: number, id: TowerId): boolean {
    if (!this.isBuildable(col, row)) return false
    const cost = this.buildCost(id)
    if (this.gold < cost) {
      this.say('Ouro insuficiente.')
      return false
    }
    const def = TOWERS[id]
    const t: Tower = {
      uid: nextUid(),
      def,
      col,
      row,
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
      level: 1,
      branch: null,
      angle: -Math.PI / 2,
      cooldown: 0,
      spent: cost,
      kills: 0,
      damage: 0,
      recoil: 0,
      bob: Math.random() * Math.PI * 2,
      targetUid: null,
      charge: 0,
    }
    this.gold -= cost
    this.towers.push(t)
    this.priorities.set(t.uid, 'first')
    this.selectedTowerUid = t.uid
    this.selectedSlot = null
    this.refreshTowerStats()
    this.burst(t.x, t.y, def.accent, 16, 'ring')
    play('build')
    return true
  }

  tryUpgrade(uid: number, branch?: Branch): boolean {
    const t = this.towers.find((x) => x.uid === uid)
    if (!t || t.level >= 5) return false
    if (t.level === 3 && !branch && !t.branch) return false
    const cost = this.upgradeCost(t, branch)
    if (!Number.isFinite(cost) || this.gold < cost) {
      this.say('Ouro insuficiente para essa melhoria.')
      return false
    }
    this.gold -= cost
    t.spent += cost
    t.level++
    if (t.level === 4 && branch) t.branch = branch
    if (t.level >= 5) this.maxedTower = true
    this.refreshTowerStats()
    this.burst(t.x, t.y, t.def.accent, 24, 'shard')
    play('upgrade')
    return true
  }

  sell(uid: number): void {
    const idx = this.towers.findIndex((x) => x.uid === uid)
    if (idx < 0) return
    const t = this.towers[idx]
    this.gold += this.sellValue(t)
    this.towers.splice(idx, 1)
    this.priorities.delete(t.uid)
    this.selectedTowerUid = null
    this.refreshTowerStats()
    this.burst(t.x, t.y, '#fbbf24', 14, 'spark')
    play('sell')
  }

  cyclePriority(uid: number): void {
    const order: Priority[] = ['first', 'strong', 'close']
    const cur = this.priorities.get(uid) ?? 'first'
    this.priorities.set(uid, order[(order.indexOf(cur) + 1) % order.length])
  }

  setSpeed(s: number): void {
    this.speed = s
  }

  callWave(): void {
    if (this.status !== 'prep') return
    const bonus = Math.floor(Math.max(0, this.prepTimer) * 4)
    if (bonus > 0) {
      this.gold += bonus
      this.floating(this.core.x, this.core.y - 46, `+${bonus} adiantado`, '#fbbf24', 18)
    }
    this.prepTimer = 0
    this.startWave()
  }

  private startWave(): void {
    this.wave++
    this.status = 'wave'
    this.waveTime = 0
    const def = getWave(this.wave)
    const hpMul = waveHpMultiplier(this.wave, this.map.hpScale)
    const queue: Array<{ t: number; enemy: EnemyId; hpMul: number }> = []
    for (const g of def.groups) {
      for (let i = 0; i < g.count; i++) queue.push({ t: g.delay + i * g.gap, enemy: g.enemy, hpMul })
    }
    queue.sort((a, b) => a.t - b.t)
    this.spawnQueue = queue
    this.say(`Onda ${this.wave} — ${def.label}`)
    play('wave')
  }

  useAbility(id: AbilityId, at?: Vec): boolean {
    const def = ABILITIES.find((a) => a.id === id)
    if (!def) return false
    if (this.energy < def.cost) {
      this.say('Energia insuficiente.')
      return false
    }
    if (id === 'meteoro') {
      if (!at) {
        this.pendingMeteor = true
        this.say('Escolha onde o meteoro deve cair.')
        return false
      }
      this.energy -= def.cost
      this.pendingMeteor = false
      this.meteorAt(at.x, at.y)
      return true
    }
    this.energy -= def.cost
    if (id === 'estase') {
      for (const e of this.enemies) e.fx.stunUntil = Math.max(e.fx.stunUntil, this.time + 3.5)
      this.burst(FIELD_W / 2, FIELD_H / 2, '#67e8f9', 60, 'ring')
      this.say('Estase! Tudo congelado por 3,5s.')
      play('freeze')
    }
    if (id === 'reparo') {
      this.lives = Math.min(this.maxLives, this.lives + 5)
      this.floating(this.core.x, this.core.y - 50, '+5 vidas', '#f9a8d4', 20)
      this.say('Núcleo reparado.')
      play('pick')
    }
    return true
  }

  private meteorAt(x: number, y: number): void {
    const radius = METEOR_RADIUS
    const dmg = 280 + this.wave * 45
    this.shake = 16
    this.burst(x, y, '#fb923c', 52, 'spark')
    this.burst(x, y, '#fef3c7', 20, 'ring')
    for (const e of this.enemies) {
      if (e.dead) continue
      if (dist2(e.x, e.y, x, y) <= radius * radius) {
        this.damage(e, dmg, { pierce: true, source: null })
        e.fx.dotDps = Math.max(e.fx.dotDps, 40)
        e.fx.dotUntil = Math.max(e.fx.dotUntil, this.time + 3)
      }
    }
    play('boom')
    this.say('Meteoro!')
  }

  pickDraft(b: Blessing): void {
    this.blessings.push(b.id)
    this.draft = null
    this.status = 'prep'
    this.prepTimer = PREP_NEXT
    this.recomputeMods()
    if (b.id === 'escudo') {
      this.lives = Math.min(this.maxLives + 3, this.lives + 3)
      this.maxLives += 3
    }
    this.say(`Bênção adquirida: ${b.name}`)
    play('pick')
  }

  private openDraft(): void {
    const pool = BLESSINGS.filter((b) => this.blessingCount(b.id) < (b.max ?? 99))
    const weights: Record<string, number> = { comum: 6, rara: 3, lendaria: 1 }
    const picked: Blessing[] = []
    const bag = [...pool]
    const want = Math.min(this.mods.draftSize, bag.length)
    while (picked.length < want && bag.length) {
      let total = 0
      for (const b of bag) total += weights[b.rarity]
      let roll = Math.random() * total
      let idx = 0
      for (let i = 0; i < bag.length; i++) {
        roll -= weights[bag[i].rarity]
        if (roll <= 0) {
          idx = i
          break
        }
      }
      picked.push(bag[idx])
      bag.splice(idx, 1)
    }
    if (!picked.length) {
      this.status = 'prep'
      this.prepTimer = PREP_NEXT
      return
    }
    this.draft = picked
    this.status = 'draft'
  }

  /* ---------------- combate ---------------- */

  private spawn(id: EnemyId, hpMul: number, dist = 0, gen = 0): Enemy {
    const def: EnemyDef = ENEMIES[id]
    const hp = def.hp * hpMul
    const pos = this.posAt(dist, def.flying)
    const e: Enemy = {
      uid: nextUid(),
      def,
      hp,
      maxHp: hp,
      armor: def.armor,
      shield: def.shield * Math.min(hpMul, 4),
      maxShield: def.shield * Math.min(hpMul, 4),
      shieldCooldown: 0,
      dist,
      x: pos.x,
      y: pos.y,
      angle: 0,
      speed: def.speed,
      phase: Math.random() * Math.PI * 2,
      scale: 1,
      fx: { slowFactor: 1, slowUntil: 0, stunUntil: 0, dotDps: 0, dotUntil: 0, shred: 0, markUntil: 0 },
      healTimer: 0,
      dead: false,
      leaked: false,
      spawnFlash: 0.45,
      hitFlash: 0,
      generation: gen,
    }
    this.enemies.push(e)
    this.enemyIndex.set(e.uid, e)
    return e
  }

  private damage(
    e: Enemy,
    amount: number,
    opts: { pierce?: boolean; source: Tower | null; crit?: boolean },
  ): void {
    if (e.dead) return
    let dmg = amount
    if (e.def.boss) dmg *= this.mods.bossDamageMul
    if (this.mods.firstStrike > 0 && e.fx.markUntil === 0) dmg *= 1 + this.mods.firstStrike
    e.fx.markUntil = 1

    if (!opts.pierce) {
      const armor = Math.max(0, e.armor)
      dmg = Math.max(dmg * 0.15, dmg - armor)
    }
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, dmg)
      e.shield -= absorbed
      dmg -= absorbed
      e.shieldCooldown = 4.5
      if (absorbed > 0) this.spark(e.x, e.y, '#a5b4fc', 3)
    }
    if (dmg <= 0) return
    e.hp -= dmg
    e.hitFlash = 0.12
    if (opts.source) opts.source.damage += dmg
    if (opts.crit) this.floating(e.x, e.y - e.def.radius, `${Math.round(dmg)}!`, '#fde047', 17)

    if (e.hp <= 0) this.kill(e, opts.source, -e.hp)
  }

  private kill(e: Enemy, source: Tower | null, overkill: number): void {
    if (e.dead) return
    e.dead = true
    this.kills++
    this.combo++
    this.comboTimer = 2.4
    if (source) source.kills++
    if (e.def.id === 'tita') this.killedTitan = true

    let gold = (e.def.bounty * waveBounty(this.wave) + this.mods.goldPerKill) * this.mods.goldMul
    if (this.mods.overkillGold > 0) gold += overkill * this.mods.overkillGold
    gold = Math.max(1, Math.round(gold))
    this.gold += gold
    this.score += Math.round(e.def.bounty * (1 + this.combo * 0.02))
    this.peakGold = Math.max(this.peakGold, this.gold)

    this.burst(e.x, e.y, e.def.body[0], e.def.boss ? 44 : 11, 'spark')
    if (e.def.boss) {
      this.shake = 20
      this.floating(e.x, e.y - 40, `+${gold}`, '#fbbf24', 22)
      play('boom')
    } else if (this.combo % 6 === 0) {
      play('coin')
    }

    if (e.def.split) {
      for (let i = 0; i < e.def.split.count; i++) {
        const child = this.spawn(e.def.split.into, e.maxHp / (e.def.hp || 1), Math.max(0, e.dist - i * 20))
        child.fx.slowFactor = e.fx.slowFactor
        child.fx.slowUntil = e.fx.slowUntil
      }
    }

    if (this.plagued.has(e.uid)) {
      for (const o of this.enemies) {
        if (o.dead || o.uid === e.uid) continue
        if (dist2(o.x, o.y, e.x, e.y) <= PLAGUE_RADIUS * PLAGUE_RADIUS) {
          o.fx.dotDps = Math.max(o.fx.dotDps, e.fx.dotDps * 0.8)
          o.fx.dotUntil = Math.max(o.fx.dotUntil, this.time + 3)
          this.plagued.add(o.uid)
        }
      }
      this.burst(e.x, e.y, '#bef264', 20, 'ring')
    }
    this.plagued.delete(e.uid)
  }

  private splashDamage(
    x: number,
    y: number,
    radius: number,
    dmg: number,
    src: Tower | null,
    p: Partial<Projectile>,
  ): void {
    const r2 = radius * radius
    for (const e of this.enemies) {
      if (e.dead) continue
      if (dist2(e.x, e.y, x, y) > r2) continue
      this.applyPayload(e, dmg, src, p)
    }
  }

  private applyPayload(e: Enemy, dmg: number, src: Tower | null, p: Partial<Projectile>): void {
    if (p.shred) {
      e.armor = Math.max(0, e.armor - p.shred)
      e.fx.shred += p.shred
    }
    if (p.slowFactor !== undefined && p.slowFactor < 1) {
      e.fx.slowFactor = Math.min(e.fx.slowFactor, p.slowFactor)
      e.fx.slowUntil = Math.max(e.fx.slowUntil, this.time + (p.slowDur ?? 1.5))
    }
    if (p.dotDps) {
      e.fx.dotDps = Math.max(e.fx.dotDps, p.dotDps)
      e.fx.dotUntil = Math.max(e.fx.dotUntil, this.time + (p.dotDur ?? 3))
      if (src && src.def.id === 'alquimico' && src.branch === 'a') this.plagued.add(e.uid)
    }
    if (p.stunChance && Math.random() < p.stunChance) {
      e.fx.stunUntil = Math.max(e.fx.stunUntil, this.time + (p.stunDur ?? 0.5))
      this.spark(e.x, e.y, '#e0f2fe', 4)
    }
    if (dmg > 0) this.damage(e, dmg, { pierce: (p.pierce ?? 0) > 100, source: src, crit: p.crit })
  }

  private pickTarget(t: Tower, s: TowerStats): Enemy | null {
    const r2 = s.range * s.range
    const mode = this.priorities.get(t.uid) ?? 'first'
    let best: Enemy | null = null
    let bestScore = -Infinity
    for (const e of this.enemies) {
      if (e.dead || e.leaked) continue
      if (e.def.flying && !s.hitsAir) continue
      const d2 = dist2(t.x, t.y, e.x, e.y)
      if (d2 > r2) continue
      let sc: number
      if (mode === 'first') sc = e.def.flying ? e.dist / Math.max(1, this.flyLen) : e.dist / Math.max(1, this.totalLen)
      else if (mode === 'strong') sc = e.hp + e.shield
      else sc = -d2
      if (sc > bestScore) {
        bestScore = sc
        best = e
      }
    }
    return best
  }

  private fire(t: Tower, s: TowerStats, target: Enemy): void {
    const [c1] = t.def.gradient
    t.recoil = 1

    if (s.kind === 'chain') {
      const pts: number[] = [t.x, t.y]
      let cur = target
      const hit = new Set<number>([cur.uid])
      let dmg = s.damage
      const crit = Math.random() < s.critChance
      if (crit) dmg *= s.critMult
      for (let i = 0; i < Math.max(1, s.chainCount); i++) {
        pts.push(cur.x, cur.y)
        this.applyPayload(cur, dmg, t, {
          shred: s.shred,
          stunChance: s.stunChance,
          stunDur: s.stunDur,
          pierce: s.pierce,
          crit,
        })
        dmg *= s.chainFalloff
        let nxt: Enemy | null = null
        let bd = CHAIN_JUMP * CHAIN_JUMP
        for (const e of this.enemies) {
          if (e.dead || hit.has(e.uid)) continue
          if (e.def.flying && !s.hitsAir) continue
          const d2 = dist2(cur.x, cur.y, e.x, e.y)
          if (d2 < bd) {
            bd = d2
            nxt = e
          }
        }
        if (!nxt) break
        hit.add(nxt.uid)
        cur = nxt
      }
      this.beams.push({ pts, life: 0.16, max: 0.16, color: c1, width: 4 })
      play('zap')
      return
    }

    if (s.kind === 'beam') {
      const crit = Math.random() < s.critChance
      const dmg = s.damage * (crit ? s.critMult : 1)
      this.beams.push({ pts: [t.x, t.y, target.x, target.y], life: 0.2, max: 0.2, color: c1, width: crit ? 8 : 5 })
      if (s.pierce > 100) {
        for (const e of this.enemies) {
          if (e.dead) continue
          if (e.def.flying && !s.hitsAir) continue
          if (pointSegmentDist(e.x, e.y, t.x, t.y, target.x, target.y) < e.def.radius + 14) {
            this.applyPayload(e, dmg, t, { pierce: s.pierce, dotDps: s.dotDps, dotDur: s.dotDur, shred: s.shred, crit })
          }
        }
      } else {
        this.applyPayload(target, dmg, t, { pierce: s.pierce, dotDps: s.dotDps, dotDur: s.dotDur, shred: s.shred, crit })
      }
      if (s.splash > 0) this.splashDamage(target.x, target.y, s.splash, dmg * 0.5, t, { dotDps: s.dotDps, dotDur: s.dotDur })
      this.spark(target.x, target.y, c1, 7)
      play('shot')
      return
    }

    const shots = Math.max(1, Math.round(s.spread))
    for (let i = 0; i < shots; i++) {
      const crit = Math.random() < s.critChance
      const spreadAng = shots > 1 ? (i - (shots - 1) / 2) * 0.16 : 0
      const lead = s.kind === 'mortar' ? Math.hypot(target.x - t.x, target.y - t.y) / s.projectileSpeed : 0
      const aimX = target.x + Math.cos(target.angle) * target.speed * lead * 0.7
      const aimY = target.y + Math.sin(target.angle) * target.speed * lead * 0.7
      const ang = Math.atan2(aimY - t.y, aimX - t.x) + spreadAng
      const jitter = shots > 1 ? (Math.random() - 0.5) * 38 : 0
      this.projectiles.push({
        uid: nextUid(),
        kind: s.kind,
        x: t.x,
        y: t.y,
        tx: aimX + jitter,
        ty: aimY + jitter,
        vx: Math.cos(ang) * s.projectileSpeed,
        vy: Math.sin(ang) * s.projectileSpeed,
        speed: s.projectileSpeed,
        targetUid: s.kind === 'mortar' ? null : target.uid,
        damage: s.damage * (crit ? s.critMult : 1),
        splash: s.splash,
        pierce: s.pierce,
        slowFactor: s.slowFactor,
        slowDur: s.slowDur,
        dotDps: s.dotDps,
        dotDur: s.dotDur,
        shred: s.shred,
        stunChance: s.stunChance,
        stunDur: s.stunDur,
        chainLeft: 0,
        chainFalloff: s.chainFalloff,
        color: c1,
        color2: t.def.gradient[1],
        life: 3,
        trail: [],
        crit,
        hitAir: s.hitsAir,
        ownerUid: t.uid,
      })
    }
    play('shot')
  }

  private detonate(p: Projectile): void {
    const owner = this.towers.find((t) => t.uid === p.ownerUid) ?? null
    if (p.splash > 0) {
      this.splashDamage(p.x, p.y, p.splash, p.damage, owner, p)
      this.burst(p.x, p.y, p.color, p.splash > 100 ? 24 : 13, 'spark')
      if (p.kind === 'mortar') {
        this.shake = Math.max(this.shake, 4)
        play('boom')
      }
    } else if (p.targetUid !== null) {
      const e = this.enemyIndex.get(p.targetUid)
      if (e && !e.dead) this.applyPayload(e, p.damage, owner, p)
      this.spark(p.x, p.y, p.color, 5)
    }
  }

  /* ---------------- partículas ---------------- */

  burst(x: number, y: number, color: string, n: number, kind: Particle['kind']): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = kind === 'ring' ? 26 + Math.random() * 50 : 60 + Math.random() * 200
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.5,
        maxLife: 0.85,
        size: kind === 'ring' ? 2.5 : 2.2 + Math.random() * 3,
        color,
        kind,
        angle: a,
      })
    }
  }

  spark(x: number, y: number, color: string, n: number): void {
    this.burst(x, y, color, n, 'spark')
  }

  floating(x: number, y: number, text: string, color: string, size: number): void {
    this.texts.push({ x, y, vy: -42, life: 1.1, text, color, size })
  }

  /* ---------------- loop ---------------- */

  update(dtReal: number): void {
    if (this.status === 'draft' || this.status === 'victory' || this.status === 'defeat') {
      this.decayFx(dtReal)
      return
    }
    const steps = this.speed
    for (let i = 0; i < steps; i++) this.step(dtReal)
  }

  private decayFx(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const t of this.texts) {
      t.y += t.vy * dt
      t.life -= dt
    }
    this.texts = this.texts.filter((t) => t.life > 0)
    for (const b of this.beams) b.life -= dt
    this.beams = this.beams.filter((b) => b.life > 0)
  }

  private step(dt: number): void {
    this.time += dt
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 40)
    this.energy = Math.min(MAX_ENERGY, this.energy + dt * 3.4 * this.mods.energyRegen)
    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) this.combo = 0
    }

    if (this.status === 'prep') {
      this.prepTimer -= dt
      if (this.prepTimer <= 0) this.startWave()
    } else if (this.status === 'wave') {
      this.waveTime += dt
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveTime) {
        const item = this.spawnQueue.shift()!
        this.spawn(item.enemy, item.hpMul)
      }
    }

    this.updateEnemies(dt)
    this.updateTowers(dt)
    this.updateProjectiles(dt)
    this.decayFx(dt)

    if (this.status === 'wave' && !this.spawnQueue.length && !this.enemies.length) this.endWave()
    if (this.lives <= 0 && this.status !== 'defeat') {
      this.status = 'defeat'
      play('lose')
      this.say('O núcleo caiu.')
    }
  }

  private endWave(): void {
    const interest = Math.min(90, Math.floor(this.gold * this.mods.interestRate))
    const bonus = 42 + this.wave * 13 + interest
    this.gold += bonus
    this.score += 120 + this.wave * 25
    this.floating(this.core.x, this.core.y - 56, `+${bonus} ouro`, '#fbbf24', 19)

    if (!this.endless && this.wave >= MAX_CAMPAIGN_WAVES) {
      this.status = 'victory'
      play('win')
      this.say('Vitória! O Prisma resistiu.')
      return
    }
    if (this.wave % 5 === 0) {
      this.openDraft()
      return
    }
    this.status = 'prep'
    this.prepTimer = PREP_NEXT
  }

  continueEndless(): void {
    this.endless = true
    this.status = 'prep'
    this.prepTimer = PREP_NEXT
    this.say('Modo infinito. Boa sorte.')
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.dead) continue
      if (e.spawnFlash > 0) e.spawnFlash -= dt
      if (e.hitFlash > 0) e.hitFlash -= dt
      e.phase += dt * (4 + e.speed * 0.03)

      if (this.time < e.fx.dotUntil && e.fx.dotDps > 0) {
        e.hp -= e.fx.dotDps * dt
        if (Math.random() < dt * 6) this.spark(e.x, e.y, '#bef264', 1)
        if (e.hp <= 0) {
          this.kill(e, null, 0)
          continue
        }
      }

      if (e.shield < e.maxShield && e.def.shieldRegen) {
        e.shieldCooldown -= dt
        if (e.shieldCooldown <= 0) e.shield = Math.min(e.maxShield, e.shield + e.def.shieldRegen * dt)
      }

      if (e.def.heal) {
        e.healTimer -= dt
        if (e.healTimer <= 0) {
          e.healTimer = e.def.heal.interval
          const r2 = e.def.heal.radius * e.def.heal.radius
          let healed = false
          for (const o of this.enemies) {
            if (o.dead || o.uid === e.uid) continue
            if (o.hp >= o.maxHp) continue
            if (dist2(o.x, o.y, e.x, e.y) <= r2) {
              o.hp = Math.min(o.maxHp, o.hp + e.def.heal.amount)
              healed = true
              this.spark(o.x, o.y, '#86efac', 2)
            }
          }
          if (healed) this.burst(e.x, e.y, '#4ade80', 7, 'ring')
        }
      }

      let mul = 1
      if (this.time < e.fx.stunUntil) mul = 0
      else if (this.time < e.fx.slowUntil) mul = e.fx.slowFactor
      else e.fx.slowFactor = 1

      e.dist += e.speed * mul * dt
      const limit = e.def.flying ? this.flyLen : this.totalLen
      if (e.dist >= limit) {
        e.leaked = true
        e.dead = true
        this.lives -= e.def.damage
        this.perfectRun = false
        this.leaked++
        this.shake = Math.max(this.shake, 12)
        this.burst(this.core.x, this.core.y, '#f43f5e', 22, 'ring')
        this.floating(this.core.x, this.core.y - 34, `-${e.def.damage}`, '#f43f5e', 22)
        play('leak')
        continue
      }
      const prev = { x: e.x, y: e.y }
      const pos = this.posAt(e.dist, e.def.flying)
      e.x = pos.x
      e.y = pos.y
      if (mul > 0) e.angle = Math.atan2(pos.y - prev.y, pos.x - prev.x) || e.angle
    }

    if (this.enemies.some((e) => e.dead)) {
      for (const e of this.enemies) if (e.dead) this.enemyIndex.delete(e.uid)
      this.enemies = this.enemies.filter((e) => !e.dead)
    }
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      const s = this.statsOf(t)
      t.bob += dt * 2
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 6)

      if (s.auraGold > 0) {
        t.charge += dt * s.auraGold
        if (t.charge >= 1) {
          const inc = Math.floor(t.charge)
          t.charge -= inc
          this.gold += inc
          if (Math.random() < 0.25) this.floating(t.x, t.y - 30, `+${inc}`, '#fcd34d', 13)
        }
      }
      if (s.kind === 'none' || s.damage <= 0) continue

      t.cooldown -= dt
      const target = this.pickTarget(t, s)
      if (target) {
        const want = Math.atan2(target.y - t.y, target.x - t.x)
        let diff = want - t.angle
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        t.angle += diff * Math.min(1, dt * 12)
        t.targetUid = target.uid
        if (t.cooldown <= 0) {
          t.cooldown = 1 / Math.max(0.05, s.rate)
          this.fire(t, s, target)
        }
      } else {
        t.targetUid = null
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      p.life -= dt
      if (p.trail.length > 6) p.trail.shift()
      p.trail.push([p.x, p.y])

      if (p.kind === 'mortar') {
        const dx = p.tx - p.x
        const dy = p.ty - p.y
        const d = Math.hypot(dx, dy)
        if (d < p.speed * dt + 4) {
          p.x = p.tx
          p.y = p.ty
          this.detonate(p)
          p.life = -1
          continue
        }
        p.x += (dx / d) * p.speed * dt
        p.y += (dy / d) * p.speed * dt
        continue
      }

      const target = p.targetUid !== null ? this.enemyIndex.get(p.targetUid) : undefined
      if (target && !target.dead) {
        const dx = target.x - p.x
        const dy = target.y - p.y
        const d = Math.hypot(dx, dy) || 1
        const turn = Math.min(1, dt * 9)
        p.vx += ((dx / d) * p.speed - p.vx) * turn
        p.vy += ((dy / d) * p.speed - p.vy) * turn
        if (d < target.def.radius + 8) {
          p.x = target.x
          p.y = target.y
          this.detonate(p)
          p.life = -1
          continue
        }
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.x < -60 || p.y < -60 || p.x > FIELD_W + 60 || p.y > FIELD_H + 60) p.life = -1
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0)
  }

  /* ---------------- saída ---------------- */

  earnedPrismas(): number {
    const cleared = this.status === 'victory' ? this.wave : Math.max(0, this.wave - 1)
    const endlessDepth = Math.max(0, cleared - MAX_CAMPAIGN_WAVES)
    const raw =
      cleared * 1.5 +
      this.kills * 0.035 +
      (this.status === 'victory' ? 30 : 0) +
      endlessDepth * 4 +
      (this.perfectRun && cleared >= 10 ? 10 : 0)
    return Math.max(1, Math.floor(raw * this.mods.prismaMul))
  }

  hud(): HudSnapshot {
    const selected = this.selectedTowerUid !== null
      ? this.towers.find((t) => t.uid === this.selectedTowerUid) ?? null
      : null
    const counts = new Map<string, number>()
    for (const b of this.blessings) counts.set(b, (counts.get(b) ?? 0) + 1)
    const remaining = this.spawnQueue.length + this.enemies.length
    const totalWave = this.status === 'wave' ? Math.max(1, remaining + this.kills) : 1
    return {
      status: this.status,
      wave: this.wave,
      maxWaves: MAX_CAMPAIGN_WAVES,
      gold: Math.floor(this.gold),
      lives: Math.max(0, this.lives),
      maxLives: this.maxLives,
      energy: this.energy,
      maxEnergy: MAX_ENERGY,
      kills: this.kills,
      score: this.score,
      speed: this.speed,
      prepTimer: Math.max(0, this.prepTimer),
      waveProgress: this.status === 'wave' ? 1 - remaining / totalWave : 0,
      enemiesLeft: remaining,
      endless: this.endless || this.wave > MAX_CAMPAIGN_WAVES,
      selectedTower: selected,
      selectedSlot: this.selectedSlot,
      buildChoice: this.buildChoice,
      draft: this.draft,
      blessings: Array.from(counts.entries()).map(([id, count]) => ({ id, count })),
      abilities: { ...this.abilityCd },
      earnedPrismas: this.earnedPrismas(),
      combo: this.combo,
      lastMessage: this.message,
      messageKey: this.messageKey,
      synergies: this.activeSynergies(),
    }
  }
}
