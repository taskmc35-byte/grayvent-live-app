import { useLayoutEffect, useRef, useState } from 'react';
import type { Ability, ArmorType, Character, LocId, Race } from '../data/types';
import { LOCAZIONI } from '../data/types';
import { ARMOR, ARMOR_ORDER, effectiveRace, type Computed } from '../rules';
import { raceLabel } from '../data/races';
import { BodyFigure } from './BodyFigure';
import { BottomSheet } from './Sheet';
import { AfflizioniRiga, AfflizioniSezione } from './Afflizioni';
import { astroOf, PANTHEON } from '../data/deities';

const ARMOR_SKILL: Record<ArmorType, string> = {
  nessuna: '', cuoio: 'Armatura di Cuoio', cuoioLavorato: 'Armatura di Cuoio Lavorato', anelli: 'Armatura ad Anelli', piastre: 'Armatura di Piastre',
};

export function SchedaTab({ pg, calc, races, onSaveEq, onPoteri }: {
  pg: Character; calc: Computed; races: Race[]; catalog: Ability[];
  onSaveEq: (eq: Character['equipaggiamento']) => Promise<void>;
  onPoteri?: () => void;
}) {
  const [editLoc, setEditLoc] = useState<LocId | null>(null);
  const fit = useFitHeight();

  return (
    <div className="page scheda-fit" ref={fit}>
      <SchedaHero pg={pg} races={races} />

      <section className="body-block fit" aria-label="Locazioni">
        <BodyFigure locs={calc.locazioni} onPick={setEditLoc} />
        <p className="fig-hint">Tocca una parte del corpo per cambiare armatura</p>
        {calc.haCompleta && (
          <label className={`check completa mini${calc.completaPossibile ? '' : ' off'}`}>
            <input type="checkbox" checked={calc.completaAttiva} disabled={!calc.completaPossibile}
              onChange={(e) => onSaveEq({ ...pg.equipaggiamento, completa: e.target.checked })} />
            <span>
              <strong>Armatura Completa</strong>: ti copre almeno l’80% del corpo?
              <span className="hint">{calc.completaPossibile ? ' Se sì, +1 PA ovunque.' : ' Serve armatura su tutte le locazioni.'}</span>
            </span>
          </label>
        )}
      </section>

      {(calc.avvisi.length > 0 || calc.note.length > 0) && (
        <div className="notices-mini">
          {calc.avvisi.map((a) => <div key={a} className="notice">{a}</div>)}
          {calc.note.map((n) => <div key={n} className="notice info">{n}</div>)}
        </div>
      )}

      {calc.potere.map((p) => (
        <button key={p.via} className="power-mini" onClick={onPoteri} aria-label={`${p.nome} ${p.livelloNome}: ${p.qta} ${p.risorsa}. Apri i poteri`}>
          <span className="pm-name">{p.nome} {p.livelloNome}</span>
          {p.risorsa === 'Punti Potere' && <span className="slots-pp" aria-hidden="true">{Array.from({ length: Math.min(p.qta, 8) }, (_, i) => <span key={i} />)}</span>}
          <span className="pm-qta"><strong key={p.qta}>{p.qta}</strong> {p.risorsa === 'Punti Potere' ? 'PP' : p.risorsa}</span>
        </button>
      ))}

      <AfflizioniRiga personaggioId={pg.id} />

      {editLoc && (
        <EquipEditor
          loc={editLoc}
          pg={pg}
          calc={calc}
          onClose={() => setEditLoc(null)}
          onSave={async (eq) => { await onSaveEq(eq); setEditLoc(null); }}
        />
      )}
    </div>
  );
}

function SchedaHero({ pg, races }: { pg: Character; races: Race[] }) {
  const { race, inherited } = effectiveRace(pg, races);
  return (
    <header className="hero">
      <div>
        <h1>
          {pg.nome}
          {pg.cognome && <span className="cognome">{pg.cognome}</span>}
        </h1>
        <div className="razza">{raceLabel(race)}{inherited && `, con sangue ${raceLabel(inherited).toLowerCase()}`}</div>
      </div>
      <div className="hero-seph" aria-label={`${pg.sephire} Sephire`}>
        <span>{pg.sephire === 1 ? 'Sephira' : 'Sephire'}</span>
        <strong>{pg.sephire}</strong>
        <div className="gems" aria-hidden="true">{Array.from({ length: Math.min(pg.sephire, 6) }, (_, i) => <span key={i} className="gem" />)}</div>
      </div>
    </header>
  );
}

/** Linguetta "Personaggio": dati anagrafici, bonus e malus di razza, note dei Master */
export function PersonaggioTab({ pg, races }: { pg: Character; races: Race[] }) {
  const { race, inherited } = effectiveRace(pg, races);
  const rEff = inherited ?? race;
  return (
    <div className="page">
      <section className="race-card">
        <h2 className="section-title" style={{ marginBottom: 0 }}>Personaggio</h2>
        <dl className="facts">
          {pg.titolo && (<><dt>Titolo</dt><dd>{pg.titolo}</dd></>)}
          <dt>Nome</dt><dd>{pg.nome} {pg.cognome}</dd>
          <dt>Provenienza</dt><dd>{pg.provenienza || '—'}</dd>
          <dt>Razza</dt><dd>{raceLabel(race)}{inherited && `, con sangue ${raceLabel(inherited).toLowerCase()}`}</dd>
          <dt>Professione</dt><dd>{pg.professione || 'Nessuna'}{pg.professioneAvanzata ? `, ${pg.professioneAvanzata}` : ''}</dd>
          {pg.divinita && (<><dt>Divinità</dt><dd>{divinitaLabel(pg.divinita)}</dd></>)}
          {pg.elemento && (<><dt>Elemento</dt><dd>{pg.elemento}</dd></>)}
          {pg.eta != null && (<><dt>Età</dt><dd>{pg.eta} anni</dd></>)}
          <dt>Sephire</dt><dd>{pg.sephire}</dd>
          {pg.varie && (<><dt>Varie</dt><dd>{pg.varie}</dd></>)}
        </dl>
        {rEff && (
          <>
            <div><span className="tag">Bonus di razza</span><p><strong>{rEff.bonusNome}.</strong> {rEff.bonus}</p></div>
            <div><span className="tag">Malus di razza</span><p>{rEff.malus}</p></div>
          </>
        )}
        {pg.abilitaSpeciali && (
          <div><span className="tag">Abilità speciali e note</span>
            <ul className="spec-list">{pg.abilitaSpeciali.split('\n').map((r) => r.trim()).filter(Boolean).map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
        {pg.note && <div><span className="tag">Note dei Master</span><p>{pg.note}</p></div>}
      </section>
      <AfflizioniSezione personaggioId={pg.id} />
    </div>
  );
}

/** Adatta l'altezza della Scheda allo schermo libero, così la figura si ridimensiona invece di far scorrere */
function useFitHeight() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const app = document.querySelector('.app');
      const bar = app ? parseFloat(getComputedStyle(app).paddingBottom) || 0 : 0;
      el.style.height = `${Math.max(560, window.innerHeight - top - bar)}px`;
    };
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);
  return ref;
}

function EquipEditor({ loc, pg, calc, onClose, onSave }: {
  loc: LocId; pg: Character; calc: Computed; onClose: () => void; onSave: (eq: Character['equipaggiamento']) => Promise<void>;
}) {
  const cur = pg.equipaggiamento[loc] ?? { armatura: 'nessuna' as ArmorType };
  const [armatura, setArmatura] = useState<ArmorType>(cur.armatura);
  const [saving, setSaving] = useState(false);
  const nome = LOCAZIONI.find((l) => l.id === loc)!.nome;

  const save = async (all: boolean) => {
    setSaving(true);
    const eq = { ...pg.equipaggiamento };
    for (const l of LOCAZIONI) if (all || l.id === loc) eq[l.id] = { armatura };
    try { await onSave(eq); } finally { setSaving(false); }
  };

  return (
    <BottomSheet onClose={onClose} label={`Armatura: ${nome}`}>
      <h2>{nome}</h2>
      <p className="hint">Segna l’armatura più pesante che copre almeno metà della locazione. Conta solo quella.</p>
      <div className="armor-opts" role="radiogroup" aria-label="Tipo di armatura">
        {ARMOR_ORDER.map((t) => {
          const ok = calc.armaturePermesse.includes(t);
          return (
            <label key={t} className={`armor-opt${ok ? '' : ' disabled'}`}>
              <input type="radio" name="armatura" value={t} checked={armatura === t} disabled={!ok} onChange={() => setArmatura(t)} />
              <span>
                {ARMOR[t].nome}
                {!ok && <small>Serve l’abilità {ARMOR_SKILL[t]}</small>}
              </span>
              <span className="pa-val">{ARMOR[t].pa} PA</span>
            </label>
          );
        })}
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => save(true)} disabled={saving}>Usa ovunque</button>
        <button className="btn primary" onClick={() => save(false)} disabled={saving}>{saving ? 'Salvo…' : 'Salva'}</button>
      </div>
    </BottomSheet>
  );
}

const PANTHEON_DI = { Madre: 'della Madre', Spada: 'della Spada', Padre: 'del Padre' } as const;
function divinitaLabel(d: string) {
  const a = astroOf(d);
  if (!a || PANTHEON.some((p) => p.nome === d)) return d;
  return `${d}, Pantheon ${PANTHEON_DI[a]}`;
}
