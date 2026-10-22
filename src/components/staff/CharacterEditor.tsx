import { useMemo, useState } from 'react';
import { api } from '../../api';
import type { Ability, ArmorType, Categoria, Character, LocId, SlotApprendimento, Spell } from '../../data/types';
import { LOCAZIONI } from '../../data/types';
import type { Profile, StaffCharacter } from '../../api';
import { RACES, raceLabel } from '../../data/races';
import { DEI_MINORI, PANTHEON, astroOf } from '../../data/deities';
import { ARMOR, ARMOR_ORDER, compute } from '../../rules';
import { gruppiSlot } from '../../slots';
import { motivoIncompatibile } from '../../incompat';
import { motivoRequisiti, prerequisitiMancanti, titoliAutomatici, titoliDelCatalogo } from '../../requisiti';
import { gruppiPoteri } from '../../poteri';
import { etichetteSpeciali } from '../AbilitaTab';
import { CampoFoto } from '../FotoPg';
import { TUTTI_GLI_ELEMENTI, elementiDi } from '../../elementi';
import { AfflizioniEditor } from '../Afflizioni';

const CAT: { id: Categoria; nome: string }[] = [
  { id: 'fisico', nome: 'Fisico' }, { id: 'mentale', nome: 'Mentale' }, { id: 'sovrannaturale', nome: 'Sovrannaturale' },
];
const PROFESSIONI = [
  'Cattedrale della Madre della Vita', 'Cattedrale del Padre dell’Oblio', 'Chiericato della Spada della Giustizia', 'Accademia d’Arme',
  'Crocevia, Via della Natura', 'Crocevia, Via della Parola', 'Crocevia, Speziali', 'Corte dei Miracoli', 'Bevär dei Barellieri',
  'Bevär dei Maniscalchi', 'Bevär dell’Avanguardia', 'Bevär dei Razziatori', 'Circolo Esoterico di Seidr',
];
export const emptyCharacter = (): StaffCharacter => ({
  id: '', giocatore: '', nome: '', cognome: '', provenienza: '', razza: 'umano-centrale', professione: '', sephire: 1,
  abilita: ['armi-corte'], slot: {}, incantesimi: [], proprietario: null, attivo: true,
  equipaggiamento: { ...Object.fromEntries(LOCAZIONI.map((l) => [l.id, { armatura: 'nessuna' }])), completa: false } as Character['equipaggiamento'],
});

export function CharacterEditor({ initial, catalog, spells, profiles, onSave, onCancel }: {
  initial: StaffCharacter; catalog: Ability[]; spells: Spell[]; profiles: Profile[];
  onSave: (c: StaffCharacter) => Promise<void>; onCancel: () => void;
}) {
  const [c, setC] = useState<StaffCharacter>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');
  const [tutte, setTutte] = useState(false);
  /** eccezione dello staff: insegnare fuori Sephira o fuori titolo/grado */
  const [eccezione, setEccezione] = useState(false);
  const [nuovoTitolo, setNuovoTitolo] = useState('');
  const elencoTitoli = useMemo(() => titoliDelCatalogo(catalog), [catalog]);
  const set = <K extends keyof StaffCharacter>(k: K, v: StaffCharacter[K]) => setC((x) => ({ ...x, [k]: v }));

  const calc = useMemo(() => compute(c, catalog, RACES), [c, catalog]);
  const [stampa, setStampa] = useState(false);
  const race = RACES.find((r) => r.id === c.razza);
  const owned = new Set(c.abilita);

  const conta = (id: string) => c.abilita.filter((x) => x === id).length;
  /** abilità riacquistabili: una volta in più o in meno (resta almeno una) */
  const cambiaVolte = (id: string, delta: 1 | -1) => setC((x) => {
    if (delta > 0) return { ...x, abilita: [...x.abilita, id] };
    const i = x.abilita.lastIndexOf(id);
    return conta(id) > 1 && i >= 0 ? { ...x, abilita: x.abilita.filter((_, j) => j !== i) } : x;
  });
  const toggleAb = (id: string) => set('abilita', owned.has(id) ? c.abilita.filter((x) => x !== id) : [...c.abilita, id]);
  const toggleSp = (id: string) => set('incantesimi', c.incantesimi.includes(id) ? c.incantesimi.filter((x) => x !== id) : [...c.incantesimi, id]);

  const missingPrereq = (a: Ability) => prerequisitiMancanti(a, owned, catalog);
  const auto = titoliAutomatici(c);
  const aggiungiTitolo = (t: string) => {
    const v = t.trim();
    if (!v) return;
    const tutti = [...auto, ...(c.titoli ?? [])].map((x) => x.toLowerCase());
    if (!tutti.includes(v.toLowerCase())) set('titoli', [...(c.titoli ?? []), v]);
    setNuovoTitolo('');
  };
  const vietate = new Set(race?.abilitaVietate ?? []);
  const obbligatorieMancanti = (race?.abilitaObbligatorie ?? []).filter((id) => !owned.has(id)).map((id) => catalog.find((a) => a.id === id)?.nome ?? id);

  const save = async (patch: Partial<StaffCharacter> = {}) => {
    if (!c.nome.trim()) { setError('Scrivi almeno il nome del personaggio.'); window.scrollTo(0, 0); return; }
    setSaving(true); setError('');
    try { await onSave({ ...c, stato: c.stato ?? 'approvato', ...patch }); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };
  const [notaRev, setNotaRev] = useState(initial.notaStaff ?? '');
  const [rimanda, setRimanda] = useState(false);
  const inAttesa = initial.stato === 'in_approvazione' || initial.stato === 'da_rivedere';
  const apriFile = async () => {
    if (!c.bgFile) return;
    try { const url = await api.bgFileUrl(c.bgFile.path); if (url) window.open(url, '_blank', 'noopener'); else setError('Il file non è disponibile in questa versione di prova.'); }
    catch (e) { setError((e as Error).message); }
  };

  const f = filtro.trim().toLowerCase();
  const astro = astroOf(c.divinita);
  const haMagia = calc.potere.some((p) => p.via === 'mago' || p.via === 'stregone');

  return (
    <div className="page editor">
      <div className="editor-head">
        <button className="link" onClick={onCancel}>Torna all’elenco</button>
        <h1>{initial.id ? `${initial.nome} ${initial.cognome}`.trim() : 'Nuovo personaggio'}</h1>
      </div>
      {error && <div className="notice" role="alert">{error}</div>}

      {inAttesa && (
        <section className="approve">
          <span className={`pill ${initial.stato === 'da_rivedere' ? 'warn' : 'wait'}`}>{initial.stato === 'da_rivedere' ? 'Rimandata al giocatore' : 'Da approvare'}</span>
          <p>Scheda creata dal giocatore con la creazione guidata{c.usiTalento || c.astriOro ? `: dai PC avanzati ${c.usiTalento ? `${c.usiTalento} Talento 1` : ''}${c.usiTalento && c.astriOro ? ' e ' : ''}${c.astriOro ? `${c.astriOro} ${c.astriOro === 1 ? 'Astro' : 'Astri'} d’Oro` : ''}` : ''}.
            Controlla razza, abilità e background{race?.ereditaDaScelta ? ', tira il Fato del Mezz’Elfo' : ''}{haMagia || calc.potere.some((p) => p.via === 'sacerdote') ? ' e assegna incantesimi o miracoli' : ''}, poi approva.</p>
          {initial.stato === 'da_rivedere' && initial.notaStaff && <blockquote className="staff-note">{initial.notaStaff}</blockquote>}
          {rimanda ? (
            <div className="form">
              <div className="field"><label htmlFor="nota-rev">Cosa deve cambiare il giocatore</label><textarea id="nota-rev" rows={3} value={notaRev} onChange={(e) => setNotaRev(e.target.value)} /></div>
              <div className="sheet-actions">
                <button className="btn ghost" onClick={() => setRimanda(false)}>Annulla</button>
                <button className="btn primary" disabled={saving || !notaRev.trim()} onClick={() => save({ stato: 'da_rivedere', notaStaff: notaRev.trim() })}>Rimanda al giocatore</button>
              </div>
            </div>
          ) : (
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setRimanda(true)}>Chiedi modifiche</button>
              <button className="btn primary" disabled={saving} onClick={() => save({ stato: 'approvato', notaStaff: undefined, attivo: true })}>Approva scheda</button>
            </div>
          )}
        </section>
      )}

      {(c.bgTesto || c.bgFile || (c.spuntiBg ?? []).length > 0) && (
        <details className="bg-box" open={inAttesa}>
          <summary>Background</summary>
          {(c.spuntiBg ?? []).length > 0 && <p className="hint">Spunti narrativi: {(c.spuntiBg ?? []).join(', ')}</p>}
          {c.bgFile && <button className="btn ghost" onClick={apriFile}>Apri il file allegato ({c.bgFile.nome})</button>}
          {c.bgTesto && <div className="bg-text">{c.bgTesto}</div>}
        </details>
      )}

      <section className="preview" aria-label="Anteprima calcoli">
        <div className="preview-locs">
          {calc.locazioni.map((l) => (
            <div key={l.id}><span>{l.nome.replace('Braccio ', 'Br. ').replace('Gamba ', 'Gb. ')}</span><strong>{l.pl}</strong><small>{l.pf} PF, {l.pa} PA</small></div>
          ))}
        </div>
        {calc.potere.map((p) => <p key={p.via} className="hint">{p.nome} {p.livelloNome}: {p.qta} {p.risorsa.toLowerCase()}</p>)}
        {[...calc.avvisi, ...obbligatorieMancanti.map((n) => `La razza richiede l’abilità ${n}.`)].map((a) => <div key={a} className="notice">{a}</div>)}
      </section>

      <fieldset className="fs">
        <legend>Account</legend>
        <div className="field">
          <label htmlFor="own">Giocatore</label>
          <select id="own" value={c.proprietario ?? ''} onChange={(e) => {
            const p = profiles.find((x) => x.id === e.target.value);
            setC((x) => ({ ...x, proprietario: e.target.value || null, giocatore: p?.nome ?? x.giocatore }));
          }}>
            <option value="">Nessun account collegato</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.nome ?? p.email} ({p.email})</option>)}
          </select>
          <span className="hint">Il giocatore vede solo le schede collegate al suo account. Gli account si creano dalla sezione Account.</span>
        </div>
        <label className="check"><input type="checkbox" checked={c.attivo} onChange={(e) => set('attivo', e.target.checked)} /><span>Personaggio in gioco<br /><span className="hint">Togli la spunta se è ritirato o morto: resta in archivio ma il giocatore non lo vede.</span></span></label>
      </fieldset>

      <fieldset className="fs">
        <legend>Identità</legend>
        <div className="grid2">
          <div className="field"><label htmlFor="nome">Nome</label><input id="nome" value={c.nome} onChange={(e) => set('nome', e.target.value)} /></div>
          <div className="field"><label htmlFor="cognome">Cognome o soprannome</label><input id="cognome" value={c.cognome} onChange={(e) => set('cognome', e.target.value)} /></div>
        </div>
        <CampoFoto c={c} onChange={(f) => set('foto', f)} nota="Si salva insieme alla scheda." />
        <div className="field"><label htmlFor="titolo">Titolo</label><input id="titolo" value={c.titolo ?? ''} onChange={(e) => set('titolo', e.target.value || undefined)} placeholder="Nessuno" /></div>
        <div className="field"><label htmlFor="prov">Luogo di provenienza</label><input id="prov" value={c.provenienza} onChange={(e) => set('provenienza', e.target.value)} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="razza">Razza</label>
            <select id="razza" value={c.razza} onChange={(e) => set('razza', e.target.value)}>
              {RACES.filter((r) => !r.soloStaff).map((r) => <option key={r.id} value={r.id}>{raceLabel(r)}</option>)}
              <optgroup label="Cambi di razza in gioco">{RACES.filter((r) => r.soloStaff === 'gioco').map((r) => <option key={r.id} value={r.id}>{raceLabel(r)}</option>)}</optgroup>
              <optgroup label="Solo PNG dei Master">{RACES.filter((r) => r.soloStaff === 'png').map((r) => <option key={r.id} value={r.id}>{raceLabel(r)}</option>)}</optgroup>
            </select>
          </div>
          {race?.ereditaDaScelta && (
            <div className="field"><label htmlFor="ered">Bonus ereditato (Fato)</label>
              <select id="ered" value={c.razzaEreditata ?? ''} onChange={(e) => set('razzaEreditata', e.target.value || undefined)}>
                <option value="">Da tirare</option>
                {RACES.filter((r) => r.id.startsWith('umano') || r.id === 'alf' || r.id === 'vinteralf').map((r) => <option key={r.id} value={r.id}>{raceLabel(r)}{r.bonusNome ? ` (${r.bonusNome})` : ''}</option>)}
              </select>
            </div>
          )}
          {race?.ereditaDaScelta && (
            <div className="field"><label htmlFor="ered-m">Malus ereditato (Fato)</label>
              <select id="ered-m" value={c.razzaMalus ?? ''} onChange={(e) => set('razzaMalus', e.target.value || undefined)}>
                <option value="">Stessa razza del bonus</option>
                {RACES.filter((r) => r.id.startsWith('umano') || r.id === 'alf' || r.id === 'vinteralf').map((r) => <option key={r.id} value={r.id}>{raceLabel(r)}</option>)}
              </select>
            </div>
          )}
          <div className="field"><label htmlFor="eta">Età</label><input id="eta" type="number" min={0} max={150} value={c.eta ?? ''} onChange={(e) => set('eta', e.target.value ? Number(e.target.value) : undefined)} /></div>
          <div className="field"><label htmlFor="seph">Sephire</label><input id="seph" type="number" min={1} value={c.sephire} onChange={(e) => set('sephire', Math.max(1, Number(e.target.value) || 1))} /></div>
        </div>
        <div className="field"><label htmlFor="prof">Professione</label>
          <input id="prof" list="professioni" value={c.professione} onChange={(e) => set('professione', e.target.value)} placeholder="Nessuna" />
          <datalist id="professioni">{PROFESSIONI.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="field"><label htmlFor="profa">Professione avanzata</label><input id="profa" value={c.professioneAvanzata ?? ''} onChange={(e) => set('professioneAvanzata', e.target.value || undefined)} placeholder="Nessuna" /></div>
        <div className="field">
          <label htmlFor="titoli">Titoli e cariche</label>
          <div className="titoli-chips" aria-label="Titoli del personaggio">
            {auto.map((t) => <span key={t} className="chip auto" title="Assegnato da sé">{t}</span>)}
            {(c.titoli ?? []).map((t) => (
              <span key={t} className="chip">{t}<button type="button" aria-label={`Togli ${t}`} onClick={() => set('titoli', (c.titoli ?? []).filter((x) => x !== t))}>×</button></span>
            ))}
          </div>
          <div className="row-add">
            <input id="titoli" list="elenco-titoli" value={nuovoTitolo} placeholder="Es. Mistagogo, Runista, Professione Segreta"
              onChange={(e) => setNuovoTitolo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aggiungiTitolo(nuovoTitolo); } }} />
            <button type="button" className="btn ghost" disabled={!nuovoTitolo.trim()} onClick={() => aggiungiTitolo(nuovoTitolo)}>Aggiungi</button>
          </div>
          <datalist id="elenco-titoli">{elencoTitoli.filter((t) => !auto.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
          <span className="hint">Servono per le abilità di professione: senza il titolo richiesto non si possono assegnare. Fyrd e la razza contano da sé.</span>
        </div>
        <div className="field"><label htmlFor="varie">Varie</label><input id="varie" value={c.varie ?? ''} onChange={(e) => set('varie', e.target.value || undefined)} placeholder="Es. Sacerdote di Loky" /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="div">Divinità</label>
            <select id="div" value={c.divinita ?? ''} onChange={(e) => set('divinita', e.target.value || undefined)}>
              <option value="">Nessuna in particolare</option>
              {PANTHEON.map((p) => (
                <optgroup key={p.astro} label={`Pantheon ${p.nome}`}>
                  <option value={p.nome}>{p.nome} (Astro)</option>
                  {p.semiDei.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
              <optgroup label="Dei Minori">{DEI_MINORI.map((d) => <option key={d} value={d}>{d}</option>)}</optgroup>
            </select>
            {astro && c.divinita && !PANTHEON.some((p) => p.nome === c.divinita) && <span className="hint">Miracoli dell’Astro: {PANTHEON.find((p) => p.astro === astro)!.nome}</span>}
          </div>
          <div className="field"><label htmlFor="el">Elemento principale</label>
            <select id="el" value={c.elemento ?? ''} onChange={(e) => setC((x) => ({ ...x, elemento: e.target.value || undefined, altriElementi: (x.altriElementi ?? []).filter((y) => y !== e.target.value) }))}>
              <option value="">{haMagia ? 'Da scegliere' : 'Nessuno'}</option>
              {TUTTI_GLI_ELEMENTI.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
        </div>
        {c.elemento && (
          <div className="field">
            <span className="label">Altri elementi</span>
            <div className="titoli-chips" role="group" aria-label="Altri elementi">
              {TUTTI_GLI_ELEMENTI.filter((x) => x !== c.elemento).map((x) => {
                const on = (c.altriElementi ?? []).includes(x);
                return (
                  <label key={x} className={`chip scelta${on ? ' on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => set('altriElementi', on ? (c.altriElementi ?? []).filter((y) => y !== x) : [...(c.altriElementi ?? []), x])} />{x}
                  </label>
                );
              })}
            </div>
            <span className="hint">Un mago può ottenere più elementi in gioco. L’Energia Pura è l’unione di tutti gli elementi e non ha incantesimi propri.</span>
          </div>
        )}
      </fieldset>

      <fieldset className="fs">
        <legend>Abilità apprese</legend>
        <input className="search" type="search" placeholder="Cerca un’abilità" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Cerca abilità" />
        <label className="check"><input type="checkbox" checked={tutte || eccezione} disabled={eccezione} onChange={(e) => setTutte(e.target.checked)} /><span>Mostra anche le abilità di altri titoli e professioni</span></label>
        <label className="check"><input type="checkbox" checked={eccezione} onChange={(e) => setEccezione(e.target.checked)} />
          <span>Eccezione dello staff: permetti di insegnare fuori Sephira o fuori titolo<br /><span className="hint">Vale solo mentre modifichi questa scheda. Le incompatibilità tra poteri restano bloccate.</span></span></label>
        {CAT.map((cat) => {
          const list = catalog.filter((a) => a.categoria === cat.id
            && (!f || a.nome.toLowerCase().includes(f) || (a.codice ?? '').toLowerCase() === f || (a.gruppo ?? '').toLowerCase().includes(f))
            && (tutte || f || owned.has(a.id) || !motivoRequisiti(a, { ...c, sephire: 99 })));
          if (!list.length) return null;
          const gruppi = new Map<string, Ability[]>();
          for (const a of list) {
            const g = owned.has(a.id) ? 'Possedute' : a.tipo === 'base' ? 'Base' : (a.gruppo || 'Altre');
            gruppi.set(g, [...(gruppi.get(g) ?? []), a]);
          }
          const ordine = [...gruppi.keys()].sort((x, y) => (x === 'Possedute' ? -1 : y === 'Possedute' ? 1 : x === 'Base' ? -1 : y === 'Base' ? 1 : x.localeCompare(y, 'it')));
          return (
            <div key={cat.id} className="chk-group">
              <h3>{cat.nome}</h3>
              {ordine.map((g) => (
                <div key={g}>
                  {gruppi.size > 1 && <h4 className="ab-sub">{g}</h4>}
                  {gruppi.get(g)!.sort((x, y) => (x.sephira ?? 0) - (y.sephira ?? 0) || x.nome.localeCompare(y.nome, 'it')).map((a) => {
                    const on = owned.has(a.id);
                    const miss = on ? [] : missingPrereq(a);
                    const incomp = on ? null : motivoIncompatibile(a, [...owned, ...Object.values(c.slot).filter(Boolean).map((v) => v!.abilita)], catalog);
                    const req = motivoRequisiti(a, c);
                    const blocco = incomp ?? (on || eccezione ? null : req);
                    const spec = etichetteSpeciali(a);
                    return (
                      <label key={a.id} className={`chk${on ? ' on' : ''}${blocco ? ' blocked' : ''}`}>
                        <input type="checkbox" checked={on} disabled={!!blocco} onChange={() => toggleAb(a.id)} />
                        <span>
                          {a.nome}{a.codice && <span className="codice">{a.codice}</span>}{a.tipo === 'avanzata' && <em> avanzata</em>}
                          {on && a.riacquistabile && (
                            <span className="ab-conta" onClick={(e) => e.preventDefault()}>
                              <button type="button" aria-label={`Una volta in meno: ${a.nome}`} disabled={conta(a.id) < 2} onClick={(e) => { e.preventDefault(); e.stopPropagation(); cambiaVolte(a.id, -1); }}>−</button>
                              <strong>×{conta(a.id)}</strong>
                              <button type="button" aria-label={`Riacquista: ${a.nome}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); cambiaVolte(a.id, 1); }}>+</button>
                            </span>
                          )}
                          <small className="ab-req">{[a.sephira ? `Sephira ${a.sephira}` : null, a.titolo && a.titolo !== 'Fyrd' ? a.titolo : null, a.pc != null ? `${a.pc} PC` : null, ...spec].filter(Boolean).join(' · ')}</small>
                          {vietate.has(a.id) && <small className="bad">Vietata per la razza</small>}
                          {blocco && <small className="bad">{blocco}</small>}
                          {!blocco && req && <small className="warn">{on ? 'Insegnata come eccezione' : 'Eccezione'}: {req.charAt(0).toLowerCase() + req.slice(1)}</small>}
                          {miss.length > 0 && <small>Richiede {miss.join(', ')}</small>}
                          {a.note && <small className="hint">Nota staff: {a.note}</small>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </fieldset>

      <fieldset className="fs">
        <legend>Slot di apprendimento</legend>
        <p className="hint">Per un’abilità che occupa più discipline, compila uno slot e spunta gli altri slot che occupa.</p>
        {gruppiSlot(c.slot).map((g) => {
          const cat = CAT.find((x) => x.id === g.cats[0])!;
          const s = g.slot;
          const nomi = g.cats.map((id) => CAT.find((x) => x.id === id)!.nome).join(' + ');
          // scrive lo stesso apprendimento in tutti gli slot del gruppo
          const setGroup = (v: SlotApprendimento | undefined, cats = g.cats) => setC((x) => {
            const slot = { ...x.slot };
            for (const id of g.cats) slot[id] = undefined;
            for (const id of cats) slot[id] = v ? { ...v } : undefined;
            return { ...x, slot };
          });
          // abilità che si apprendono in una delle discipline di questo slot, con i requisiti di titolo e Sephira
          const nelloSlot = (a: Ability) => (a.tempi && Object.keys(a.tempi).length
            ? Object.entries(a.tempi).some(([k, v]) => g.cats.includes(k as Categoria) && v !== 'NI')
            : g.cats.includes(a.categoria));
          const options = catalog.filter((a) => (!owned.has(a.id) || a.riacquistabile) && (a.id === s?.abilita || (nelloSlot(a) && (eccezione || !motivoRequisiti(a, c)))))
            .sort((x, y) => x.nome.localeCompare(y.nome, 'it'));
          // discipline occupate secondo il foglio dello staff (es. Fisico 2 + Mentale 2)
          const disciplineDi = (a?: Ability) => {
            const k = Object.entries(a?.tempi ?? {}).filter(([, v]) => typeof v === 'number').map(([k]) => k as Categoria);
            return k.length ? [...new Set([...g.cats.filter((x) => k.includes(x)), ...k])].filter((x) => !c.slot[x] || g.cats.includes(x)) : g.cats;
          };
          const altri = CAT.filter((x) => x.id !== cat.id);
          return (
            <div key={cat.id} className="slot-edit">
              <div className="field">
                <label htmlFor={`slot-${cat.id}`}>Slot {nomi}</label>
                <select id={`slot-${cat.id}`} value={s?.abilita ?? ''} onChange={(e) => {
                  const a = catalog.find((x) => x.id === e.target.value);
                  setGroup(e.target.value ? { abilita: e.target.value, eventiTotali: a?.tda || s?.eventiTotali || 1, eventiSvolti: 0, insegnante: s?.insegnante ?? '', eventoInizio: s?.eventoInizio ?? '' } : undefined,
                    e.target.value ? disciplineDi(a) : g.cats);
                }}>
                  <option value="">Libero</option>
                  {options.map((a) => {
                    // conta anche le abilità in apprendimento negli altri slot
                    const altri = [...owned, ...Object.entries(c.slot).filter(([k, v]) => v && !g.cats.includes(k as Categoria)).map(([, v]) => v!.abilita)];
                    const why = motivoIncompatibile(a, altri, catalog);
                    const tempi = Object.entries(a.tempi ?? {}).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k[0].toUpperCase()}${v}`).join(' ');
                    return <option key={a.id} value={a.id} disabled={!!why}>{a.nome}{a.codice ? ` [${a.codice}]` : ''}{tempi ? ` · ${tempi}` : ''}{why ? ` (${why.toLowerCase()})` : motivoRequisiti(a, c) ? ' (eccezione)' : ''}</option>;
                  })}
                </select>
              </div>
              {s && (
                <>
                  <div className="also-slots" role="group" aria-label="Altri slot occupati">
                    {altri.map((o) => {
                      const dentro = g.cats.includes(o.id);
                      const occupato = !dentro && !!c.slot[o.id];
                      return (
                        <label key={o.id} className={`check${occupato ? ' off' : ''}`}>
                          <input type="checkbox" checked={dentro} disabled={occupato}
                            onChange={(e) => setGroup(s, e.target.checked ? [...g.cats, o.id] : g.cats.filter((id) => id !== o.id))} />
                          <span>Occupa anche lo slot {o.nome}{occupato && <span className="hint"> (già occupato)</span>}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="grid2">
                    <div className="field"><label htmlFor={`tot-${cat.id}`}>Eventi necessari</label><input id={`tot-${cat.id}`} type="number" min={1} value={s.eventiTotali} onChange={(e) => setGroup({ ...s, eventiTotali: Math.max(1, Number(e.target.value) || 1) })} /></div>
                    <div className="field"><label htmlFor={`done-${cat.id}`}>Eventi svolti</label><input id={`done-${cat.id}`} type="number" min={0} value={s.eventiSvolti} onChange={(e) => setGroup({ ...s, eventiSvolti: Math.max(0, Number(e.target.value) || 0) })} /></div>
                    <div className="field"><label htmlFor={`ins-${cat.id}`}>Insegnante</label><input id={`ins-${cat.id}`} value={s.insegnante} onChange={(e) => setGroup({ ...s, insegnante: e.target.value })} /></div>
                    <div className="field"><label htmlFor={`ev-${cat.id}`}>Iniziata all’evento</label><input id={`ev-${cat.id}`} value={s.eventoInizio} onChange={(e) => setGroup({ ...s, eventoInizio: e.target.value })} /></div>
                  </div>
                  <button className="btn ghost" onClick={() => setC((x) => {
                    const slot = { ...x.slot };
                    for (const id of g.cats) slot[id] = undefined;
                    return { ...x, abilita: [...x.abilita, s.abilita], slot };
                  })}>
                    {g.cats.length > 1 ? 'Segna come appresa e libera gli slot' : 'Segna come appresa e libera lo slot'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </fieldset>

      <fieldset className="fs">
        <legend>Incantesimi, miracoli, rune e cerchi</legend>
        <p className="hint">Segreti e Master non compaiono mai tra le scelte dei giocatori: li assegna solo lo staff.</p>
        {gruppiPoteri(spells).map((gr) => {
          const list = gr.poteri;
          const n = list.filter((s) => c.incantesimi.includes(s.id)).length;
          const sc = gr.scuola;
          const rilevante = gr.tipo === 'incantesimo' ? (elementiDi(c).includes(sc) || (sc === 'Sintesi' && calc.potere.some((p) => p.via === 'mago')))
            : gr.tipo === 'miracolo' ? ((astro && sc === astro) || sc === c.divinita || (sc === 'Generico' && calc.potere.some((p) => p.via === 'sacerdote'))) : false;
          return (
            <details key={gr.chiave} className="sp-group" open={n > 0 || !!rilevante}>
              <summary>{gr.titolo}{n > 0 && <span className="badge">{n}</span>}</summary>
              {list.map((s) => (
                <label key={s.id} className={`chk${c.incantesimi.includes(s.id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={c.incantesimi.includes(s.id)} onChange={() => toggleSp(s.id)} />
                  <span>{s.nome} <small>{s.livello}</small>
                    {s.codice && <span className="codice">{s.codice}</span>}
                    {s.master && <span className="sp-flag">Master</span>}
                    {s.segreto && <span className="sp-flag">{s.brevetto ?? 'Segreto'}</span>}
                    {s.proibito && <span className="sp-flag">Proibito</span>}
                    {s.notaStaff && <small className={`ab-req${/NON APPRENDIBILE/i.test(s.notaStaff) ? ' bad' : ''}`}>Nota staff: {s.notaStaff}</small>}
                  </span>
                </label>
              ))}
            </details>
          );
        })}
      </fieldset>

      <fieldset className="fs">
        <legend>Equipaggiamento</legend>
        <p className="hint">Lo può cambiare anche il giocatore dalla sua scheda.</p>
        {LOCAZIONI.map((l) => {
          const e = c.equipaggiamento[l.id];
          const upd = (v: { armatura: ArmorType }) => set('equipaggiamento', { ...c.equipaggiamento, [l.id as LocId]: v });
          return (
            <div key={l.id} className="eq-row">
              <label htmlFor={`eq-${l.id}`}>{l.nome}</label>
              <select id={`eq-${l.id}`} value={e.armatura} onChange={(ev) => upd({ armatura: ev.target.value as ArmorType })}>
                {ARMOR_ORDER.map((t) => <option key={t} value={t}>{ARMOR[t].nome}</option>)}
              </select>
            </div>
          );
        })}
        {calc.haCompleta && (
          <label className="check">
            <input type="checkbox" checked={!!c.equipaggiamento.completa && calc.completaPossibile} disabled={!calc.completaPossibile}
              onChange={(e) => set('equipaggiamento', { ...c.equipaggiamento, completa: e.target.checked })} />
            <span>Armatura Completa: copre almeno l’80% del corpo (+1 PA in tutte le locazioni)
              {!calc.completaPossibile && <><br /><span className="hint">Si attiva solo con un’armatura su tutte le locazioni.</span></>}</span>
          </label>
        )}
      </fieldset>

      <AfflizioniEditor personaggioId={initial.id || undefined} />

      <fieldset className="fs">
        <legend>Abilità speciali e note</legend>
        <div className="field">
          <label htmlFor="abspec">Una per riga (es. tatuaggi, oggetti legati al personaggio)</label>
          <textarea id="abspec" rows={4} value={c.abilitaSpeciali ?? ''} onChange={(e) => set('abilitaSpeciali', e.target.value || undefined)} />
        </div>
      </fieldset>

      <fieldset className="fs">
        <legend>Note dei Master</legend>
        <div className="field">
          <label htmlFor="note">Visibili al giocatore</label>
          <textarea id="note" rows={3} value={c.note ?? ''} onChange={(e) => set('note', e.target.value || undefined)} />
        </div>
      </fieldset>

      <button className="btn ghost block" disabled={stampa} onClick={async () => {
        setStampa(true);
        try { const { stampaLibretto } = await import('../../print/libretto'); await stampaLibretto(c, catalog, spells); }
        catch (e) { setError(`Stampa non riuscita: ${(e as Error).message}`); }
        finally { setStampa(false); }
      }}>{stampa ? 'Preparo il PDF…' : 'Stampa libretto (PDF)'}</button>

      <div className="savebar">
        <button className="btn ghost" onClick={onCancel}>Annulla</button>
        <button className="btn primary" onClick={() => save()} disabled={saving}>{saving ? 'Salvo…' : 'Salva scheda'}</button>
      </div>
    </div>
  );
}
