import type { LocId } from '../data/types';
import type { LocStats } from '../rules';
import { ARMOR } from '../rules';

// Figura stilizzata vista di fronte: il braccio destro del personaggio è a sinistra di chi guarda.
const SHAPES: Record<LocId, { d: string; tx: number; ty: number }> = {
  tronco: { d: 'M88 66 Q110 60 132 66 L140 74 L138 166 Q110 174 82 166 L80 74 Z', tx: 110, ty: 118 },
  braccioDx: { d: 'M78 72 L62 78 L44 170 L50 196 L66 196 L70 172 L82 104 Z', tx: 61, ty: 142 },
  braccioSx: { d: 'M142 72 L158 78 L176 170 L170 196 L154 196 L150 172 L138 104 Z', tx: 159, ty: 142 },
  gambaDx: { d: 'M82 170 Q95 175 108 176 L104 296 L80 296 L78 236 Z', tx: 93, ty: 238 },
  gambaSx: { d: 'M138 170 Q125 175 112 176 L116 296 L140 296 L142 236 Z', tx: 127, ty: 238 },
};

const fillFor = (pa: number) => {
  // più PA = più metallo
  if (pa <= 0) return 'var(--surface-2)';
  const a = Math.min(pa, 5) / 5;
  return `color-mix(in srgb, var(--steel) ${Math.round(25 + a * 45)}%, var(--surface-2))`;
};

export function BodyFigure({ locs, onPick }: { locs: LocStats[]; onPick: (id: LocId) => void }) {
  return (
    <div className="figure-wrap">
      <svg className="figure" viewBox="20 0 180 304" role="group" aria-label="Locazioni del corpo">
        <circle className="head" cx="110" cy="34" r="22" />
        {locs.map((l) => {
          const s = SHAPES[l.id];
          const narrow = l.id.startsWith('braccio');
          return (
            <g
              key={l.id}
              className="zone"
              role="button"
              tabIndex={0}
              aria-label={`${l.nome}: ${l.pl} punti locazione, ${l.pf} PF e ${l.pa} PA, armatura ${ARMOR[l.armatura].nome}. Tocca per cambiare armatura`}
              onClick={() => onPick(l.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(l.id))}
            >
              <path d={s.d} fill={fillFor(l.pa)} />
              <text key={l.pl} className="pl-num" x={s.tx} y={s.ty - (narrow ? 10 : 14)} textAnchor="middle" fontSize={narrow ? 19 : 28}>{l.pl}</text>
              <text className="sub" x={s.tx} y={s.ty + (narrow ? 2 : 0)} textAnchor="middle" fontSize={narrow ? 8 : 10}>PL</text>
              {narrow || l.id.startsWith('gamba') ? (
                <>
                  <text className="pfv" x={s.tx} y={s.ty + 16} textAnchor="middle" fontSize={9.5}>PF {l.pf}</text>
                  <text className="pav" x={s.tx} y={s.ty + 28} textAnchor="middle" fontSize={9.5}>PA {l.pa}</text>
                </>
              ) : (
                <text x={s.tx} y={s.ty + 20} textAnchor="middle" fontSize={12}>
                  <tspan className="pfv">PF {l.pf}</tspan><tspan dx="8" className="pav">PA {l.pa}</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
