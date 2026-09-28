import { useEffect, useState } from 'react';
import { monthLabel, monthShort } from '../../domain/dates';
import { formatEuro } from '../../domain/money';
import type { MonthTotals } from '../../domain/types';

interface Props {
  rows: MonthTotals[];
  goal: number;
}

const W = 340;
const H = 190;
const TOP = 12;
const BOTTOM = 22; // place des libellés de mois

/** Épargne mensuelle en barres rouges, objectif en pointillés. SVG pur, sans bibliothèque. */
export function MonthlyBarChart({ rows, goal }: Props) {
  const [selected, setSelected] = useState(rows.length - 1);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => setSelected(rows.length - 1), [rows.length]);

  const max = Math.max(goal, ...rows.map((r) => r.savings), 1);
  const min = Math.min(0, ...rows.map((r) => r.savings));
  const plotH = H - TOP - BOTTOM;
  const y = (v: number) => TOP + ((max - v) / (max - min)) * plotH;
  const zero = y(0);
  const slot = W / rows.length;
  const barW = Math.min(18, slot * 0.56);
  const sel = rows[selected];

  return (
    <figure>
      <figcaption className="mb-3 flex items-baseline justify-between" aria-live="polite">
        <span className="label">{sel ? monthLabel(sel.month) : ''}</span>
        <span className={`num text-2xl ${sel && sel.savings < 0 ? 'text-accent-text' : 'text-white'}`}>
          {sel ? formatEuro(sel.savings, { round: true }) : ''}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Épargne des 12 derniers mois">
        <line x1={0} x2={W} y1={zero} y2={zero} stroke="#262626" />
        {rows.map((r, i) => {
          const cx = slot * i + slot / 2;
          const top = Math.min(y(r.savings), zero);
          const h = Math.max(r.savings === 0 ? 0 : 2, Math.abs(y(r.savings) - zero));
          const neg = r.savings < 0;
          return (
            <g key={r.month} onClick={() => setSelected(i)} className="cursor-pointer">
              <rect x={slot * i} y={0} width={slot} height={H} fill="transparent" />
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={h}
                rx={3}
                fill={neg ? 'transparent' : '#E10600'}
                stroke={neg ? '#E10600' : 'none'}
                strokeWidth={neg ? 1.5 : 0}
                opacity={i === selected ? 1 : 0.55}
                style={{
                  transform: `scaleY(${grown ? 1 : 0})`,
                  transformBox: 'fill-box',
                  transformOrigin: neg ? 'center top' : 'center bottom',
                  transition: 'transform 700ms ease-out, opacity 150ms',
                }}
              />
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                fontSize={10}
                fontWeight={i === selected ? 800 : 600}
                fill={i === selected ? '#fff' : '#8a8a8a'}
                fontFamily="Montserrat, sans-serif"
              >
                {monthShort(r.month)}
              </text>
            </g>
          );
        })}
        {goal > 0 && (
          <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="#fff" strokeOpacity={0.7} strokeDasharray="4 4" />
        )}
      </svg>
      <div className="mt-2 flex gap-4 text-[11px] font-semibold text-sub">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />Épargne</span>
        {goal > 0 && <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-white/70" />Objectif</span>}
      </div>
      {/* Données lisibles au lecteur d'écran. */}
      <table className="sr-only">
        <caption>Épargne par mois</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}><th scope="row">{monthLabel(r.month)}</th><td>{formatEuro(r.savings)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
