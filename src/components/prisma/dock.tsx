import { ABILITIES, SYNERGIES, TOWERS } from '@/game/content'
import { towerTip, unlockWave } from '@/game/unlock'
import type { Engine } from '@/game/engine'
import { Bar, TowerGlyph } from './glyphs'
import type { AbilityId, Branch, HudSnapshot, Tower, TowerId } from '@/game/types'

export function fmt(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  return Math.round(n).toString()
}

/* ------------------------------------------------------------------ *
 * A doca
 *
 * No retrato ela fica abaixo do campo; na paisagem, ao lado. O mesmo
 * componente serve os dois: quem decide a densidade é o CSS (`.pr-towers`,
 * `.pr-tower`, `.pr-tower-tag`). Ladrilho com glifo, nome e preço é tudo que
 * se decide na hora de construir — descrição é papel do tutorial e do códice.
 * ------------------------------------------------------------------ */

/** Folha de poderes: as três habilidades e a energia que as paga. */
export function SkillSheet({
  hud,
  onAbility,
}: {
  hud: HudSnapshot
  onAbility: (id: AbilityId) => void
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {ABILITIES.map((a, i) => {
          const ready = hud.energy >= a.cost
          return (
            <button
              key={a.id}
              onClick={() => onAbility(a.id)}
              disabled={!ready}
              className="pr-btn flex flex-col items-center gap-1 p-2"
              style={ready ? { borderColor: a.gradient[0] } : undefined}
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-xl text-lg"
                style={{ background: `linear-gradient(135deg, ${a.gradient[0]}, ${a.gradient[1]})` }}
              >
                {a.icon}
              </span>
              <span className="text-[11px] font-bold leading-tight text-ink">{a.name}</span>
              <span className="text-[10px] text-ink-dim">
                {a.cost} <span className="text-ink-dim">[{['Q', 'W', 'E'][i]}]</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[10px] uppercase tracking-widest text-ink-dim">energia</span>
        <span className="flex-1">
          <Bar value={hud.energy} max={hud.maxEnergy} from="#67e8f9" to="#a855f7" height={6} />
        </span>
        <span className="shrink-0 text-[11px] font-bold text-ink">
          {Math.round(hud.energy)}/{hud.maxEnergy}
        </span>
      </div>
    </>
  )
}

export function BuildDock({
  towers,
  locked,
  build,
  gold,
  costOf,
  onChoose,
}: {
  towers: TowerId[]
  locked: { id: TowerId; wave: number } | null
  build: TowerId | null
  gold: number
  costOf: (id: TowerId) => number
  onChoose: (id: TowerId) => void
}) {
  return (
    <div className="pr-towers">
        {towers.map((id, i) => {
          const def = TOWERS[id]
          const cost = costOf(id)
          const afford = gold >= cost
          const active = build === id
          return (
            <button
              key={id}
              onClick={() => onChoose(id)}
              disabled={!afford && !active}
              className={`pr-btn pr-tower ${active ? 'pr-ping' : ''}`}
              style={
                active
                  ? {
                      borderColor: def.gradient[0],
                      background: `linear-gradient(135deg, ${def.gradient[0]}26, ${def.gradient[1]}1a)`,
                    }
                  : undefined
              }
            >
              <TowerGlyph id={id} size={36} />
              <span className="pr-tower-body">
                <span className="pr-tower-name text-ink">
                  {def.name}
                  <span className="pr-tower-key text-[10px] text-ink-dim"> [{i + 1}]</span>
                </span>
                <span className="pr-tower-tag text-[11px] text-ink-soft">{def.role}</span>
                <span className={`pr-tower-cost ${afford ? 'text-amber' : 'text-rose'}`}>{cost} 🪙</span>
              </span>
            </button>
          )
        })}

        {locked && (
          <div className="pr-tower border-2 border-dashed border-edge opacity-70" aria-hidden>
            <span className="grid h-9 w-9 place-items-center text-lg">🔒</span>
            <span className="pr-tower-body">
              <span className="pr-tower-name text-ink-dim">onda {locked.wave}</span>
              <span className="pr-tower-cost text-ink-dim">nova torre</span>
            </span>
        </div>
      )}
    </div>
  )
}

/** Cartão de estreia de uma torre. Só aparece no preparo, nunca no combate. */
export function TowerTipCard({ id, onClose }: { id: TowerId; onClose: () => void }) {
  const def = TOWERS[id]
  return (
    <div className="pr-panel pr-rise w-[min(440px,94vw)] p-5">
      <div className="text-center text-[11px] uppercase tracking-widest text-ink-dim">
        nova torre · onda {unlockWave(id)}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <TowerGlyph id={id} size={64} />
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold text-ink">{def.name}</h3>
          <span
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: `linear-gradient(135deg, ${def.gradient[0]}, ${def.gradient[1]})`, color: '#08131c' }}
          >
            {def.role}
          </span>
        </div>
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">{towerTip(id)}</p>
      <button className="pr-btn pr-btn-hot mt-5 w-full py-3" onClick={onClose}>
        Entendi
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function TowerPanel({
  engine,
  tower,
  gold,
  onUpgrade,
  onSell,
  onClose,
  onPriority,
}: {
  engine: Engine | null
  tower: Tower
  gold: number
  onUpgrade: (b?: Branch) => void
  onSell: () => void
  onClose: () => void
  onPriority: () => void
}) {
  if (!engine) return null
  const def = tower.def
  const s = engine.statsOf(tower)
  const priority = engine.priorities.get(tower.uid) ?? 'first'
  const priorityLabel = priority === 'first' ? 'Primeiro' : priority === 'strong' ? 'Mais forte' : 'Mais próximo'
  const syn = engine.synergyCache.get(tower.uid) ?? []

  const dps = (() => {
    if (s.kind === 'none') return 0
    const shots = Math.max(1, s.spread)
    let mult = shots
    if (s.chainCount > 0) {
      let m = 0
      let f = 1
      for (let i = 0; i < s.chainCount; i++) {
        m += f
        f *= s.chainFalloff
      }
      mult = m
    }
    const crit = 1 + s.critChance * (s.critMult - 1)
    return s.damage * s.rate * mult * crit
  })()

  const nextLabel = (() => {
    if (tower.level < 3) return def.levels[tower.level].label
    if (tower.level === 3) return null
    if (tower.branch) return def.branches[tower.branch].levels[tower.level - 3].label
    return null
  })()

  return (
    <div className="pr-panel p-3">
      <div className="flex items-start gap-3">
        <TowerGlyph id={def.id} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold text-ink">{def.name}</h3>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: `linear-gradient(135deg, ${def.gradient[0]}, ${def.gradient[1]})`, color: '#08131c' }}
            >
              Nv {tower.level}
            </span>
          </div>
          <p className="text-[11px] text-ink-soft">{tower.branch ? def.branches[tower.branch].name : def.role}</p>
        </div>
        <button className="px-2 text-ink-dim hover:text-ink" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
        {s.damage > 0 && <Row k="Dano" v={fmt(s.damage)} />}
        {dps > 0 && <Row k="DPS aprox." v={fmt(dps)} />}
        {s.range > 0 && <Row k="Alcance" v={fmt(s.range)} />}
        {s.rate > 0 && s.kind !== 'none' && <Row k="Cadência" v={`${s.rate.toFixed(2)}/s`} />}
        {s.splash > 0 && <Row k="Área" v={fmt(s.splash)} />}
        {s.slowFactor < 1 && <Row k="Lentidão" v={`${Math.round((1 - s.slowFactor) * 100)}%`} />}
        {s.chainCount > 0 && <Row k="Saltos" v={s.chainCount.toString()} />}
        {s.dotDps > 0 && <Row k="Veneno" v={`${fmt(s.dotDps)}/s`} />}
        {s.shred > 0 && <Row k="Corrosão" v={`-${s.shred}`} />}
        {s.pierce > 100 && <Row k="Perfura" v="armadura" />}
        {s.critChance > 0 && <Row k="Crítico" v={`${Math.round(s.critChance * 100)}% · ${s.critMult.toFixed(1)}x`} />}
        {s.stunChance > 0 && <Row k="Atordoar" v={`${Math.round(s.stunChance * 100)}%`} />}
        {s.auraDamage > 0 && <Row k="Aura dano" v={`+${Math.round(s.auraDamage * 100)}%`} />}
        {s.auraGold > 0 && <Row k="Ouro/s" v={s.auraGold.toFixed(0)} />}
        <Row k="Abates" v={tower.kills.toString()} />
      </div>

      {syn.length > 0 && (
        <div className="mt-2 rounded-xl border border-edge bg-prisma/10 px-2.5 py-1.5">
          <div className="text-[10px] uppercase tracking-widest text-prisma">Sinergia</div>
          {syn.map((sid) => {
            const sd = SYNERGIES.find((x) => x.id === sid)
            return sd ? (
              <div key={sid} className="text-[11px] text-ink-soft">
                {sd.name}
              </div>
            ) : null
          })}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {tower.level < 3 && (
          <UpgradeButton
            label={`Melhorar → ${nextLabel}`}
            desc={def.levels[tower.level].desc}
            cost={engine.upgradeCost(tower)}
            gold={gold}
            gradient={def.gradient}
            onClick={() => onUpgrade()}
          />
        )}

        {tower.level === 3 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-ink-dim">Escolha um caminho (definitivo)</div>
            {(['a', 'b'] as Branch[]).map((b) => (
              <UpgradeButton
                key={b}
                label={def.branches[b].name}
                desc={def.branches[b].desc}
                cost={engine.upgradeCost(tower, b)}
                gold={gold}
                gradient={def.gradient}
                tag={def.branches[b].tag}
                onClick={() => onUpgrade(b)}
              />
            ))}
          </div>
        )}

        {tower.level === 4 && tower.branch && (
          <UpgradeButton
            label={`Melhorar → ${nextLabel}`}
            desc={def.branches[tower.branch].levels[1].desc}
            cost={engine.upgradeCost(tower)}
            gold={gold}
            gradient={def.gradient}
            onClick={() => onUpgrade()}
          />
        )}

        {tower.level >= 5 && (
          <div className="rounded-xl border-2 border-edge bg-ink/5 px-3 py-2 text-center text-xs font-bold text-prisma">
            Nível máximo alcançado
          </div>
        )}

        <div className="flex gap-2">
          {s.kind !== 'none' && (
            <button className="pr-btn flex-1 py-2.5 text-xs" onClick={onPriority}>
              Alvo: {priorityLabel}
            </button>
          )}
          <button className="pr-btn flex-1 py-2.5 text-xs text-amber" onClick={onSell}>
            Vender +{engine.sellValue(tower)} 🪙
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-lg bg-ink/5 px-2 py-1">
      <span className="text-ink-dim">{k}</span>
      <span className="font-display font-bold text-ink">{v}</span>
    </div>
  )
}

function UpgradeButton({
  label,
  desc,
  cost,
  gold,
  gradient,
  tag,
  onClick,
}: {
  label: string
  desc: string
  cost: number
  gold: number
  gradient: [string, string]
  tag?: string
  onClick: () => void
}) {
  const afford = gold >= cost
  return (
    <button
      onClick={onClick}
      disabled={!afford}
      className="pr-btn w-full p-2.5 text-left"
      style={afford ? { borderColor: gradient[0] } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="font-display text-sm font-bold text-ink">{label}</span>
        {tag && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`, color: '#08131c' }}
          >
            {tag}
          </span>
        )}
        <span className={`ml-auto text-xs font-bold ${afford ? 'text-amber' : 'text-rose'}`}>{cost} 🪙</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{desc}</p>
    </button>
  )
}
