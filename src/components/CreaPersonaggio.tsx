import { Fragment, useMemo, useState } from 'react';
import type { Ability, Character, Categoria } from '../data/types';
import { LOCAZIONI } from '../data/types';
import { RACES, raceLabel } from '../data/races';
import { PANTHEON } from '../data/deities';
import { BG_CARATTERI, BUDGET_PC, SOVRANNATURALI, SPUNTI_BG, checkCreation, creationAbilities, removeWithDependents } from '../creation';
import { compute } from '../rules';

const PASSI = ['Razza', 'Identità', 'Abilità', 'Background', 'Riepilogo'];
const CAT: { id: Categoria; nome: string }[] = [
  { id: 'fisico', nome: 'Fisiche e di combattimento' }, { id: 'mentale', nome: 'Mentali e di conoscenza' }, { id: 'sovrannaturale', nome: 'Sovrannaturali' },
];
const PROVENIENZE = ['Feudo Nord', 'Feudo Centrale', 'Feudo Acqua Viva', 'Feudo dei Cieli', 'Feudo Fiamma Ardente', 'Regno Aureo', 'Raghen, Foreste di Luce', 'Montagne dei Vinteralf'];

export function nuovaScheda(): Character {
  return {
    id: '', giocatore: '', nome: '', cognome: '', provenienza: '', razza: '', professione: '', sephire: 1,
    abilita: ['armi-corte'], slot: {}, incantesimi: [], bgTesto: '', spuntiBg: [],
    equipaggiamento: { ...Object.fromEntries(LOCAZIONI.map((l) => [l.id, { armatura: 'nessuna' }])), completa: false } as Character['equipaggiamento'],
  };
}

export function CreaPersonaggio({ initial, catalog, notaStaff, onSubmit, onCancel }: {
  initial: Character; catalog: Ability[]; notaStaff?: string;
  onSubmit: (c: Character, file: File | null) => Promise<void>; onCancel?: () => void;
}) {
  const [c, setC] = useState<Character>(initial);
  const [passo, setPasso] = useState(initial.razza ? 1 : 0);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Character>(k: K, v: Character[K]) => setC((x) => ({ ...x, [k]: v }));
  const race = RACES.find((r) => r.id === c.razza);
  const check = useMemo(() => checkCreation(c.abilita, race, catalog), [c.abilita, race, catalog]);
  const lista = creationAbilities(catalog);
  const owned = new Set(c.abilita);
  const obbl = new Set(race?.abilitaObbligatorie ?? []);
  const magia = c.abilita.includes('conoscenze-magiche') || c.abilita.includes('dono-arcano-1');
  const sacerdote = c.abilita.includes('legame-divino-1');
  const calc = useMemo(() => (race ? compute(c, catalog, RACES) : null), [c, catalog, race]);

  const scegliRazza = (id: string) => {
    const r = RACES.find((x) => x.id === id)!;
    // le abilità obbligatorie della razza vengono aggiunte; quelle vietate tolte
    let ab = c.abilita.filter((a) => !(r.abilitaVietate ?? []).includes(a));
    for (const o of r.abilitaObbligatorie ?? []) if (!ab.includes(o)) ab.push(o);
    // prerequisiti delle obbligatorie (es. Linguaggio Runico richiede Leggere & Scrivere)
    if (ab.includes('linguaggio-runico') && !ab.includes('leggere-scrivere')) ab.push('leggere-scrivere');
    setC((x) => ({ ...x, razza: id, abilita: ab, provenienza: r.nome === 'Umano' ? r.origine ?? x.provenienza : x.provenienza, razzaEreditata: undefined }));
  };
  const toggle = (a: Ability) => {
    if (owned.has(a.id)) {
      if (obbl.has(a.id)) return;
      set('abilita', removeWithDependents(c.abilita, a.id, catalog));
    } else if (!check.bloccate.has(a.id)) set('abilita', [...c.abilita, a.id]);
  };

  const erroriPasso = (p: number): string[] => {
    const e: string[] = [];
    if (p === 0 && !race) e.push('Scegli la razza del personaggio.');
    if (p === 1) {
      if (!c.nome.trim()) e.push('Scrivi il nome del personaggio.');
      if (!c.provenienza.trim()) e.push('Indica il luogo di provenienza.');
      if (c.eta != null && (c.eta < 1 || c.eta > 150)) e.push('L’età deve essere tra 1 e 150 anni.');
    }
    if (p === 2) {
      e.push(...check.errori);
      if (sacerdote && !c.divinita) e.push('Con Legame Divino Minore devi scegliere la Divinità (torna al passo Identità).');
      if (magia && !c.elemento) e.push('Con un potere arcano devi scegliere l’Elemento (torna al passo Identità).');
    }
    if (p === 3 && !(c.bgTesto ?? '').trim() && !file && !c.bgFile) e.push('Scrivi il background o allega il file.');
    if (p === 3 && (c.bgTesto ?? '').length > BG_CARATTERI) e.push(`Il background supera i ${BG_CARATTERI.toLocaleString('it-IT')} caratteri: accorcialo per proseguire.`);
    return e;
  };
  const avanti = () => {
    const e = erroriPasso(passo);
    if (e.length) { setErr(e.join(' ')); return; }
    setErr(''); setPasso((p) => p + 1); window.scrollTo(0, 0);
  };
  const invia = async () => {
    const tutti = [0, 1, 2, 3].flatMap(erroriPasso);
    if (tutti.length) { setErr(tutti.join(' ')); return; }
    setBusy(true); setErr('');
    try { await onSubmit({ ...c, usiTalento: check.usiTalento, astriOro: check.astriOro }, file); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  const bgLen = (c.bgTesto ?? '').length;

  return (
    <div className="page wizard">
      <header className="wiz-head">
        {onCancel && <button className="link" onClick={onCancel}>Annulla</button>}
        <h1>{initial.id ? 'Modifica la scheda' : 'Crea il personaggio'}</h1>
        <ol className="steps" aria-label="Passi">
          {PASSI.map((n, i) => (
            <li key={n} className={i === passo ? 'on' : i < passo ? 'done' : ''}>
              <button disabled={i > passo} onClick={() => { setErr(''); setPasso(i); }}>{n}</button>
            </li>
          ))}
        </ol>
      </header>
      {notaStaff && <div className="notice"><strong>Nota dello staff:</strong> {notaStaff}</div>}

      <div key={passo} className="view">
      {passo === 0 && (
        <section className="wiz-sec">
          <p className="hint">Ogni razza ha un bonus e un malus. Trovi le descrizioni complete nel Manuale di Creazione.</p>
          <div className="race-list" role="radiogroup" aria-label="Razza">
            {RACES.map((r) => (
              <label key={r.id} className={`race-opt${c.razza === r.id ? ' on' : ''}`}>
                <input type="radio" name="razza" checked={c.razza === r.id} onChange={() => scegliRazza(r.id)} />
                <span className="race-name">{raceLabel(r)}</span>
                <span className="race-bonus"><strong>{r.bonusNome}.</strong> {r.bonus}</span>
                <span className="race-malus">Malus: {r.malus}</span>
                {r.abilitaObbligatorie && <span className="race-req">Deve apprendere: {r.abilitaObbligatorie.map((id) => catalog.find((a) => a.id === id)?.nome).join(', ')}</span>}
              </label>
            ))}
          </div>
          {race?.ereditaDaScelta && <div className="notice info">Per il Mezz’Elfo bonus e malus si decidono con il Fato: il tiro lo fanno i Master dopo l’invio.</div>}
        </section>
      )}

      {passo === 1 && (
        <section className="wiz-sec form">
          <div className="grid2">
            <div className="field"><label htmlFor="w-nome">Nome</label><input id="w-nome" value={c.nome} onChange={(e) => set('nome', e.target.value)} /></div>
            <div className="field"><label htmlFor="w-cognome">Cognome o soprannome</label><input id="w-cognome" value={c.cognome} onChange={(e) => set('cognome', e.target.value)} /></div>
          </div>
          <p className="hint">Il nome va approvato dai Master. Tra gli umani gli orfani hanno di solito un soprannome al posto del cognome.</p>
          <div className="field"><label htmlFor="w-prov">Luogo di provenienza</label>
            <input id="w-prov" list="w-provenienze" value={c.provenienza} onChange={(e) => set('provenienza', e.target.value)} />
            <datalist id="w-provenienze">{PROVENIENZE.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div className="field"><label htmlFor="w-eta">Età</label>
            <input id="w-eta" type="number" min={1} max={150} value={c.eta ?? ''} onChange={(e) => set('eta', e.target.value ? Number(e.target.value) : undefined)} />
            <span className="hint">Massimo 150 anni.{race?.longevita ? ` Longevità della razza: ${race.longevita}.` : ''}</span>
          </div>
          <div className="field"><label htmlFor="w-div">Divinità</label>
            <select id="w-div" value={c.divinita ?? ''} onChange={(e) => set('divinita', e.target.value || undefined)}>
              <option value="">Nessuna in particolare</option>
              {PANTHEON.map((p) => (
                <optgroup key={p.astro} label={`Pantheon ${p.nome}`}>
                  <option value={p.nome}>{p.nome}</option>
                  {p.semiDei.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="hint">Obbligatoria solo per chi prende Legame Divino Minore. Odino, Surtur e Morte non si possono scegliere in creazione.{race?.dei ? ` Dei tipici della tua razza: ${race.dei}.` : ''}</span>
          </div>
          <div className="field"><label htmlFor="w-el">Elemento</label>
            <select id="w-el" value={c.elemento ?? ''} onChange={(e) => set('elemento', e.target.value || undefined)}>
              <option value="">Nessuno</option>
              {['Fuoco', 'Acqua', 'Terra', 'Aria'].map((x) => <option key={x}>{x}</option>)}
            </select>
            <span className="hint">Solo per chi prende Conoscenze Magiche o Dono Arcano Minore. Gli incantesimi li assegnano i Master a caso.</span>
          </div>
        </section>
      )}

      {passo === 2 && (
        <section className="wiz-sec">
          <div className="pc-bar" aria-live="polite">
            <div><strong>{Math.max(0, check.restanti)}</strong><span>PC rimasti su {BUDGET_PC}</span></div>
            <div className="pc-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (check.spesi / BUDGET_PC) * 100)}%` }} className={check.restanti < 0 ? 'over' : ''} /></div>
            <small>{check.usiTalento > 0 || check.astriOro > 0
              ? `Con i PC avanzati ottieni ${check.usiTalento ? `${check.usiTalento} ${check.usiTalento === 1 ? 'uso' : 'usi'} di Talento 1` : ''}${check.usiTalento && check.astriOro ? ' e ' : ''}${check.astriOro ? `${check.astriOro} ${check.astriOro === 1 ? 'Astro' : 'Astri'} d’Oro` : ''}.`
              : 'Hai usato tutti i PC.'}</small>
          </div>
          {CAT.map((cat) => (
            <div key={cat.id} className="chk-group">
              <h3>{cat.nome}</h3>
              {lista.filter((a) => a.categoria === cat.id).map((a) => {
                const on = owned.has(a.id); const why = check.bloccate.get(a.id); const locked = obbl.has(a.id);
                return (
                  <label key={a.id} className={`chk wiz-ab${on ? ' on' : ''}${!on && why ? ' blocked' : ''}`}>
                    <input type="checkbox" checked={on} disabled={locked || (!on && !!why)} onChange={() => toggle(a)} />
                    <span>
                      <span className="ab-line">{a.nome}<b className="pc">{a.pc} PC</b></span>
                      {locked && <small>Obbligatoria per la tua razza</small>}
                      {!on && why && <small>{why}</small>}
                      {a.soloCreazione && <small>Si può prendere solo adesso, in creazione</small>}
                      <details className="ab-desc"><summary>Descrizione</summary><p>{a.descrizione}</p></details>
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
          {SOVRANNATURALI.some((id) => owned.has(id)) && <p className="hint">Conoscenze Magiche, Dono Arcano Minore e Legame Divino Minore sono incompatibili tra loro.</p>}
        </section>
      )}

      {passo === 3 && (
        <section className="wiz-sec form">
          <p className="hint">Racconta da dove viene il personaggio e perché è diventato un Fyrd. Al massimo 10.000 caratteri, circa due fogli A4. Puoi scriverlo qui o allegare il file.</p>
          <div className="field">
            <label htmlFor="w-bg">Background</label>
            <textarea id="w-bg" rows={12} maxLength={BG_CARATTERI} value={c.bgTesto ?? ''} onChange={(e) => set('bgTesto', e.target.value.slice(0, BG_CARATTERI))} />
            <span className={`hint${bgLen >= BG_CARATTERI ? ' bad' : ''}`}>{bgLen.toLocaleString('it-IT')} su {BG_CARATTERI.toLocaleString('it-IT')} caratteri{bgLen >= BG_CARATTERI ? ': hai raggiunto il limite' : ''}</span>
          </div>
          <div className="field">
            <label htmlFor="w-file">Oppure allega il file (PDF o Word, massimo 5 MB)</label>
            <input id="w-file" type="file" accept=".pdf,.doc,.docx,.odt" onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > 5_000_000) { setErr('Il file supera i 5 MB.'); e.target.value = ''; return; }
              setFile(f);
            }} />
            {(file || c.bgFile) && <span className="hint">Allegato: {file?.name ?? c.bgFile?.nome}</span>}
          </div>
          <fieldset className="fs">
            <legend>Spunti narrativi</legend>
            <p className="hint">I Master seguono le trame personali dei background che contengono almeno uno di questi spunti. Segna quelli che hai usato.</p>
            <div className="chips">
              {SPUNTI_BG.map((s) => {
                const on = (c.spuntiBg ?? []).includes(s);
                return <button key={s} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on}
                  onClick={() => set('spuntiBg', on ? (c.spuntiBg ?? []).filter((x) => x !== s) : [...(c.spuntiBg ?? []), s])}>{s}</button>;
              })}
            </div>
          </fieldset>
        </section>
      )}

      {passo === 4 && calc && (
        <section className="wiz-sec">
          <div className="race-card">
            <h2 className="section-title" style={{ marginBottom: 0 }}>{c.nome} {c.cognome}</h2>
            <dl className="facts">
              <dt>Razza</dt><dd>{raceLabel(race)}</dd>
              <dt>Provenienza</dt><dd>{c.provenienza}</dd>
              {c.eta != null && (<><dt>Età</dt><dd>{c.eta} anni</dd></>)}
              {c.divinita && (<><dt>Divinità</dt><dd>{c.divinita}</dd></>)}
              {c.elemento && (<><dt>Elemento</dt><dd>{c.elemento}</dd></>)}
              <dt>PF</dt><dd>{calc.pfBase} per locazione</dd>
              {calc.potere.map((p) => (<Fragment key={p.via}><dt>{p.risorsa}</dt><dd>{p.qta} ({p.nome} {p.livelloNome})</dd></Fragment>))}
              <dt>Abilità</dt><dd>{c.abilita.map((id) => catalog.find((a) => a.id === id)?.nome ?? id).join(', ')}</dd>
              <dt>PC</dt><dd>{check.spesi} spesi{check.usiTalento ? `, ${check.usiTalento} Talento 1` : ''}{check.astriOro ? `, ${check.astriOro} ${check.astriOro === 1 ? 'Astro' : 'Astri'} d’Oro` : ''}</dd>
              <dt>Background</dt><dd>{file?.name ?? c.bgFile?.nome ?? `${bgLen.toLocaleString('it-IT')} caratteri`}{(c.spuntiBg ?? []).length ? `, spunti: ${(c.spuntiBg ?? []).join(', ')}` : ''}</dd>
            </dl>
          </div>
          <p className="hint">Dopo l’invio la scheda resta “In approvazione” finché i Master non la controllano. Se serve qualche modifica te la segnalano qui.</p>
        </section>
      )}

      </div>
      {err && <div className="notice" role="alert">{err}</div>}
      <div className="wiz-nav">
        {passo > 0 && <button className="btn ghost" onClick={() => { setErr(''); setPasso((p) => p - 1); window.scrollTo(0, 0); }}>Indietro</button>}
        {passo < PASSI.length - 1
          ? <button className="btn primary" onClick={avanti}>Avanti</button>
          : <button className="btn primary" onClick={invia} disabled={busy}>{busy ? 'Invio…' : 'Invia ai Master'}</button>}
      </div>
    </div>
  );
}
