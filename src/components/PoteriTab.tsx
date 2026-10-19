import { useState } from 'react';
import type { Character, Spell } from '../data/types';
import type { Computed, PowerStats } from '../rules';
import { BottomSheet } from './Sheet';
import { astroOf } from '../data/deities';

export function PowerCard({ p }: { p: PowerStats }) {
  return (
    <section className="power" aria-label={`${p.risorsa} da ${p.nome}`}>
      <div className="power-head">
        <h3>{p.nome} {p.livelloNome}</h3>
        <div className="power-qta"><strong><span key={p.qta}>{p.qta}</span></strong><span>{p.risorsa}</span></div>
      </div>
      {p.risorsa === 'Punti Potere' && (
        <div className="slots-pp" aria-hidden="true">{Array.from({ length: p.qta }, (_, i) => <span key={i} />)}</div>
      )}
      <dl className="facts">
        {p.tdr && (<><dt>Recupero</dt><dd>{p.tdr} per slot (massimo {p.tdrMax})</dd></>)}
        {p.extra && (<><dt>Nota</dt><dd>{p.extra}</dd></>)}
      </dl>
    </section>
  );
}

const SCUOLA_LABEL: Record<string, string> = {
  Fuoco: 'Scuola del Fuoco', Acqua: 'Scuola dell’Acqua', Terra: 'Scuola della Terra', Aria: 'Scuola dell’Aria', Sintesi: 'Incantesimi di Sintesi',
  Madre: 'Miracoli della Madre', Padre: 'Miracoli del Padre', Spada: 'Miracoli della Spada', Generico: 'Miracoli Generici',
};

export function PoteriTab({ pg, calc, spells }: { pg: Character; calc: Computed; spells: Spell[] }) {
  const [open, setOpen] = useState<Spell | null>(null);
  const known = pg.incantesimi.map((id) => spells.find((s) => s.id === id)).filter(Boolean) as Spell[];
  const groups = new Map<string, Spell[]>();
  for (const s of known) groups.set(s.scuola, [...(groups.get(s.scuola) ?? []), s]);
  const soloMiracoli = known.length > 0 && known.every((s) => s.tipo === 'miracolo');

  return (
    <div className="page">
      <h1 style={{ fontSize: '2rem' }}>{soloMiracoli ? 'Miracoli' : 'Poteri'}</h1>
      {calc.potere.map((p) => <PowerCard key={p.via} p={p} />)}
      {known.length === 0 ? (
        <p className="hint">Non conosci ancora incantesimi o miracoli. Li aggiungono i Master quando li apprendi.</p>
      ) : (
        <div>
          {[...groups.entries()].map(([scuola, list]) => (
            <div key={scuola} className="spell-group">
              <h3>{SCUOLA_LABEL[scuola] ?? scuola}</h3>
              {list.map((s) => (
                <button key={s.id} className="spell-btn" onClick={() => setOpen(s)}>{s.nome}</button>
              ))}
            </div>
          ))}
        </div>
      )}
      {open && <SpellCard s={open} pg={pg} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SpellCard({ s, pg, onClose }: { s: Spell; pg: Character; onClose: () => void }) {
  // Sostituisce i segnaposto delle formule generiche con elemento/astro del PG, quando noti
  const el = pg.elemento ? ELEMENTO[pg.elemento] : undefined;
  const as = astro(pg.divinita);
  const fill = (t: string) => t
    .replace(/del MIO ELEMENTO/gi, el ?? 'del MIO ELEMENTO')
    .replace(/della MIA DIVINITÀ/g, as ?? 'della MIA DIVINITÀ');
  return (
    <BottomSheet onClose={onClose} label={s.nome}>
      <span className="tag">{SCUOLA_LABEL[s.scuola] ?? s.scuola}, livello {s.livello}</span>
      <h2>{s.nome}</h2>
      {s.flavor && <p className="flavor">{s.flavor}</p>}
      <div className="formula">{fill(s.formula)}</div>
      <dl className="facts">
        {s.aggiunta && (<><dt>Aggiunta</dt><dd>{s.aggiunta}</dd></>)}
        <dt>Effetto</dt><dd>{s.descrizione}</dd>
        <dt>Gittata</dt><dd>{s.gittata}</dd>
        <dt>Bersaglio</dt><dd>{s.bersaglio}</dd>
        <dt>Lancio</dt><dd>{s.lancio}</dd>
        <dt>Durata</dt><dd>{s.durata}</dd>
      </dl>
      <button className="btn block" onClick={onClose}>Chiudi</button>
    </BottomSheet>
  );
}

const ELEMENTO: Record<string, string> = { Fuoco: 'del Fuoco', Acqua: 'dell’Acqua', Terra: 'della Terra', Aria: 'dell’Aria' };
// Divinità del PG (Astro o Semi Dio) -> Astro del suo Pantheon
const ASTRO_PREP = { Madre: 'della Madre', Padre: 'del Padre', Spada: 'della Spada' } as const;
function astro(d?: string) {
  const a = astroOf(d);
  return a ? ASTRO_PREP[a] : null;
}
