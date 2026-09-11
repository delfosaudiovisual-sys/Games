import { ENEMIES, TOWERS } from '@/game/content'
import { ENEMY_INK, INK, PAPER_LIGHT, TOWER_INK } from '@/game/palette'
import type { EnemyId, TowerId } from '@/game/types'

/**
 * Retratos das unidades para loja, bestiário e painel de torre.
 *
 * Têm de falar a MESMA língua do canvas, senão o ícone da loja e o bicho em
 * campo viram desenhos diferentes:
 *   - torre = máquina sem rosto, sobre plinto, com uma lente acesa;
 *   - inimigo = borrão de nanquim com rosto e silhueta própria.
 * As cores saem de `palette.ts`, a mesma fonte que o `render.ts` usa.
 */

function Eyes({ cy, spread, r, pupil }: { cy: number; spread: number; r: number; pupil: string }) {
  return (
    <g>
      {[-1, 1].map((s) => (
        <g key={s}>
          <circle cx={24 + s * spread} cy={cy} r={r} fill={PAPER_LIGHT} stroke={INK} strokeWidth="1.5" />
          <circle cx={24 + s * spread} cy={cy + 0.4} r={r * 0.5} fill={pupil} />
          <circle cx={24 + s * spread} cy={cy + 0.4} r={r * 0.24} fill={INK} />
        </g>
      ))}
    </g>
  )
}

function Lens({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} stroke={INK} strokeWidth="1.8" />
      <circle cx={cx - r * 0.28} cy={cy - r * 0.3} r={r * 0.34} fill={PAPER_LIGHT} opacity="0.85" />
    </g>
  )
}

export function TowerGlyph({ id, size = 48 }: { id: TowerId; size?: number }) {
  const c = TOWER_INK[id]
  const [c1, c2] = c.body
  const S = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <title>{TOWERS[id].name}</title>
      <ellipse cx="24" cy="45" rx="13" ry="3" fill={INK} opacity="0.2" />
      <polygon points="11,35 37,35 33,45 15,45" fill={c2} {...S} />

      {id === 'faisca' && (
        <g>
          <rect x="17.5" y="6" width="4" height="20" rx="1.5" fill={c2} {...S} strokeWidth="1.7" />
          <rect x="26.5" y="6" width="4" height="20" rx="1.5" fill={c2} {...S} strokeWidth="1.7" />
          <rect x="12" y="22" width="24" height="14" rx="3" fill={c1} {...S} />
          <Lens cx={24} cy={29} r={4.6} color={c.lens} />
        </g>
      )}

      {id === 'gelido' && (
        <g>
          <polygon points="24,3 33,22 30,36 18,36 15,22" fill={c1} {...S} />
          <polygon points="24,6 29,22 24,33" fill={PAPER_LIGHT} opacity="0.45" />
          <polygon points="6,20 9,16 12,20 9,24" fill={c1} {...S} strokeWidth="1.3" />
          <polygon points="36,20 39,16 42,20 39,24" fill={c1} {...S} strokeWidth="1.3" />
          <Lens cx={24} cy={21} r={3.8} color={c.lens} />
        </g>
      )}

      {id === 'estilhaco' && (
        <g>
          <polygon points="17,24 31,24 37,5 11,5" fill={c1} {...S} />
          <ellipse cx="24" cy="5" rx="13" ry="3.6" fill={c2} {...S} strokeWidth="1.8" />
          <ellipse cx="24" cy="5.5" rx="8" ry="2.1" fill="#241a12" />
          <ellipse cx="24" cy="29" rx="15" ry="10" fill={c1} {...S} />
          <Lens cx={24} cy={29} r={4.2} color={c.lens} />
        </g>
      )}

      {id === 'voltaico' && (
        <g>
          <ellipse cx="24" cy="35" rx="16" ry="4" fill={c2} {...S} strokeWidth="1.7" />
          <ellipse cx="24" cy="28" rx="12" ry="4" fill={c1} {...S} strokeWidth="1.7" />
          <ellipse cx="24" cy="21" rx="8" ry="3.6" fill={c2} {...S} strokeWidth="1.7" />
          <path d="M24 11 L36 3 M24 11 L12 4 M24 11 L34 19" stroke={c.lens} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <circle cx="24" cy="11" r="9" fill={c1} {...S} />
          <Lens cx={24} cy={11} r={4.4} color={c.lens} />
        </g>
      )}

      {id === 'alquimico' && (
        <g>
          <g transform="rotate(-16 24 12)">
            <rect x="19.5" y="2" width="9" height="15" rx="2" fill={c2} {...S} strokeWidth="1.8" />
            <rect x="17.5" y="1" width="13" height="4.5" rx="1.5" fill={c2} {...S} strokeWidth="1.6" />
          </g>
          <circle cx="24" cy="26" r="13" fill={c1} {...S} />
          <path d="M11.5 27 A13 13 0 0 0 36.5 27 A13 13 0 0 1 11.5 27 Z" fill={c2} opacity="0.85" />
          <Lens cx={19} cy={21} r={3.4} color={c.lens} />
        </g>
      )}

      {id === 'lanca' && (
        <g>
          <path d="M24 28 L15 39 M24 28 L24 40 M24 28 L33 39" stroke={c2} strokeWidth="3" strokeLinecap="round" fill="none" />
          <rect x="19.5" y="3" width="9" height="27" rx="3" fill={c1} {...S} />
          <ellipse cx="24" cy="4" rx="6.5" ry="3.6" fill={c.lens} {...S} strokeWidth="1.7" />
          <ellipse cx="24" cy="29" rx="9" ry="7" fill={c2} {...S} />
          <Lens cx={24} cy={29} r={3.6} color={c.lens} />
        </g>
      )}

      {id === 'farol' && (
        <g>
          <polygon points="20,20 28,20 34,36 14,36" fill={c1} {...S} />
          <rect x="15" y="6" width="18" height="16" rx="2" fill={c2} {...S} />
          <polygon points="12,6 36,6 24,-2" fill={c1} {...S} strokeWidth="1.8" />
          <Lens cx={24} cy={14} r={5} color={c.lens} />
          <path d="M17 7 L14 4 M31 7 L34 4 M17 21 L14 24 M31 21 L34 24" stroke={c.lens} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

/** Mesma silhueta que `enemyBody` desenha no canvas, em escala de 48px. */
const BODY: Record<EnemyId, string> = {
  rastejante: 'M24 15 C33 15 38 20 38 26 C38 32 32 36 24 36 C16 36 10 32 10 26 C10 20 15 15 24 15 Z',
  corredor: 'M40 25 L29 14 L18 12 L10 19 L12 32 L22 38 L32 33 Z',
  couracado: 'M16 11 L32 11 L39 19 L38 34 L10 34 L9 19 Z',
  espectro: 'M24 9 L34 16 L34 29 L29 36 L24 30 L19 36 L14 29 L14 16 Z',
  arcano: 'M24 9 L37 16.5 L37 31.5 L24 39 L11 31.5 L11 16.5 Z',
  curandeiro: 'M24 12 C33 12 38 18 38 25 C38 32 32 37 24 37 C16 37 10 32 10 25 C10 18 15 12 24 12 Z',
  divisor: 'M24 10 L21 16 L12 18 L10 26 L14 35 L21 37 L24 32 L27 37 L34 35 L38 26 L36 18 L27 16 Z',
  cria: 'M24 14 L22 19 L15 21 L14 27 L18 33 L22 34 L24 30 L26 34 L30 33 L34 27 L33 21 L26 19 Z',
  lamina: 'M42 24 L28 12 L11 15 L16 24 L11 33 L28 36 Z',
  devorador: 'M24 7 L34 11 L40 20 L38 31 L30 39 L18 39 L10 31 L8 20 L14 11 Z',
  tita: 'M24 5 L35 9 L42 19 L40 31 L31 40 L17 40 L8 31 L6 19 L13 9 Z',
}

export function EnemyGlyph({ id, size = 44 }: { id: EnemyId; size?: number }) {
  const def = ENEMIES[id]
  const c = ENEMY_INK[id]
  const [c1, c2] = c.body
  const w = def.boss ? 2.8 : 2.2
  const legs = def.flying ? 0 : Math.min(6, def.legs)

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <title>{def.name}</title>
      <ellipse cx="24" cy="43" rx="11" ry="3" fill={INK} opacity="0.2" />

      {def.flying ? (
        <g>
          <path d="M17 18 Q4 10 2 24 Q10 25 16 27 Z" fill={c1} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M31 18 Q44 10 46 24 Q38 25 32 27 Z" fill={c1} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        </g>
      ) : (
        <g strokeLinecap="round" fill="none">
          {Array.from({ length: legs }).map((_, i) => {
            const side = i % 2 === 0 ? -1 : 1
            const row = Math.floor(i / 2)
            const bx = 24 + side * 7
            const by = 27 + row * 4
            const d = `M${bx} ${by} L${bx + side * 6} ${by + 7} L${bx + side * 8} ${by + 13}`
            return (
              <g key={i}>
                <path d={d} stroke={INK} strokeWidth="4.4" />
                <path d={d} stroke={c2} strokeWidth="2.2" />
              </g>
            )
          })}
        </g>
      )}

      {def.boss &&
        [-1, 0, 1].map((i) => (
          <polygon
            key={i}
            points={`${24 + i * 9},1 ${27.5 + i * 9},10 ${20.5 + i * 9},10`}
            fill={c1}
            stroke={INK}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        ))}

      <path d={BODY[id]} fill={c1} stroke={INK} strokeWidth={w} strokeLinejoin="round" />

      {id === 'couracado' && (
        <path d="M18 11 L19 34 M24 11 L24 34 M30 11 L29 34" stroke={INK} strokeWidth="1.6" fill="none" />
      )}
      {id === 'lamina' && (
        <polygon points="26,13 34,3 31,17" fill={c.lens} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      )}
      {(id === 'divisor' || id === 'cria') && (
        <path d="M24 10 L24 37" stroke={INK} strokeWidth="1.8" fill="none" />
      )}
      {id === 'arcano' && (
        <polygon points="24,4 41,14 41,34 24,44 7,34 7,14" fill="none" stroke="#7f8ac2" strokeWidth="1.8" opacity="0.75" />
      )}
      {def.heal && (
        <g>
          <ellipse cx="24" cy="8" rx="7" ry="2.2" fill="none" stroke="#9ac9a4" strokeWidth="2" />
          <path d="M24 21 v7 M20.5 24.5 h7" stroke={PAPER_LIGHT} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      )}

      <Eyes cy={def.boss ? 22 : 23} spread={def.boss ? 7 : 6} r={def.boss ? 4.4 : 3.8} pupil={c.lens} />
      <ellipse cx="24" cy={def.boss ? 32 : 31} rx="3.4" ry="2.8" fill="#2f2028" stroke={INK} strokeWidth="1.4" />
    </svg>
  )
}

export function Bar({
  value,
  max,
  from,
  to,
  height = 8,
}: {
  value: number
  max: number
  from: string
  to: string
  height?: number
}) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0)) * 100
  return (
    <div className="pr-bar w-full" style={{ height }}>
      <i style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} />
    </div>
  )
}
