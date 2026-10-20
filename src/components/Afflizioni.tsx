import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Afflizione } from '../data/types';
import { BottomSheet } from './Sheet';

export function useAfflizioni(personaggioId?: string) {
  const [list, setList] = useState<Afflizione[]>([]);
  const ricarica = () => { if (personaggioId) api.afflictions(personaggioId).then(setList).catch(() => setList([])); };
  useEffect(ricarica, [personaggioId]);
  return { list, ricarica };
}

const plurale = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`;

/** Riga compatta per la Scheda: tocca per vedere il dettaglio */
export function AfflizioniRiga({ personaggioId }: { personaggioId: string }) {
  const { list } = useAfflizioni(personaggioId);
  const [aperta, setAperta] = useState(false);
  const ben = list.filter((a) => a.tipo === 'benedizione').length;
  const mal = list.filter((a) => a.tipo === 'maledizione').length;
  if (!list.length) return null;
  return (
    <>
      <button className="affl-riga" onClick={() => setAperta(true)} aria-label="Benedizioni e maledizioni: apri il dettaglio">
        {ben > 0 && <span className="affl-b"><i aria-hidden="true">✦</i> {plurale(ben, 'Benedizione', 'Benedizioni')}</span>}
        {mal > 0 && <span className="affl-m"><i aria-hidden="true">✸</i> {plurale(mal, 'Maledizione', 'Maledizioni')}</span>}
      </button>
      {aperta && (
        <BottomSheet onClose={() => setAperta(false)} label="Benedizioni e maledizioni">
          <h2>Benedizioni e maledizioni</h2>
          <AfflizioniLista list={list} />
          <button className="btn block" onClick={() => setAperta(false)}>Chiudi</button>
        </BottomSheet>
      )}
    </>
  );
}

export function AfflizioniLista({ list }: { list: Afflizione[] }) {
  const ordinate = [...list].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'benedizione' ? -1 : 1));
  return (
    <div className="affl-list">
      {ordinate.map((a) => (
        <div key={a.id} className={`affl-card ${a.tipo}`}>
          <span className="tag">{a.tipo === 'benedizione' ? '✦ Benedizione' : '✸ Maledizione'}</span>
          <strong>{a.nome}</strong>
          {a.effetto && <p>{a.effetto}</p>}
          {(a.origine || a.durata) && (
            <dl className="facts">
              {a.origine && (<><dt>Origine</dt><dd>{a.origine}</dd></>)}
              {a.durata && (<><dt>Durata</dt><dd>{a.durata}</dd></>)}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}

/** Sezione per la linguetta Personaggio */
export function AfflizioniSezione({ personaggioId }: { personaggioId: string }) {
  const { list } = useAfflizioni(personaggioId);
  if (!list.length) return null;
  return (
    <section className="race-card">
      <h2 className="section-title" style={{ marginBottom: 0 }}>Benedizioni e maledizioni</h2>
      <AfflizioniLista list={list} />
    </section>
  );
}

const VUOTA = (personaggioId: string): Afflizione => ({ id: '', personaggioId, tipo: 'benedizione', nome: '', effetto: '', origine: '', durata: '', nascosta: false, terminata: false });

/** Staff: gestione nella scheda del personaggio (si salva subito, indipendentemente da "Salva scheda") */
export function AfflizioniEditor({ personaggioId, onToast }: { personaggioId?: string; onToast?: (t: string) => void }) {
  const { list, ricarica } = useAfflizioni(personaggioId);
  const [mod, setMod] = useState<Afflizione | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!personaggioId) return (
    <fieldset className="fs"><legend>Benedizioni e maledizioni</legend>
      <p className="hint">Salva prima la scheda: poi potrai aggiungere benedizioni e maledizioni.</p>
    </fieldset>
  );

  const salva = async () => {
    if (!mod) return;
    if (!mod.nome.trim()) { setErr('Scrivi il nome.'); return; }
    setBusy(true); setErr('');
    try { await api.saveAffliction({ ...mod, nome: mod.nome.trim(), effetto: mod.effetto.trim() }); setMod(null); ricarica(); onToast?.('Salvato'); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const set = <K extends keyof Afflizione>(k: K, v: Afflizione[K]) => setMod((m) => (m ? { ...m, [k]: v } : m));

  return (
    <fieldset className="fs">
      <legend>Benedizioni e maledizioni</legend>
      <p className="hint">Si salvano subito. Quelle nascoste o terminate il giocatore non le vede.</p>
      {list.map((a) => (
        <div key={a.id} className={`affl-row${a.terminata ? ' ended' : ''}`}>
          <div>
            <strong>{a.tipo === 'benedizione' ? '✦' : '✸'} {a.nome}</strong>
            <small>{[a.tipo === 'benedizione' ? 'Benedizione' : 'Maledizione', a.durata, a.nascosta && 'nascosta', a.terminata && 'terminata'].filter(Boolean).join(', ')}</small>
          </div>
          <button className="link" onClick={() => { setErr(''); setMod({ ...a, origine: a.origine ?? '', durata: a.durata ?? '' }); }}>Modifica</button>
        </div>
      ))}
      {!list.length && !mod && <p className="hint">Nessuna benedizione o maledizione.</p>}

      {mod ? (
        <div className="affl-form">
          <div className="seg" role="radiogroup" aria-label="Tipo">
            <button type="button" role="radio" aria-checked={mod.tipo === 'benedizione'} aria-selected={mod.tipo === 'benedizione'} onClick={() => set('tipo', 'benedizione')}>✦ Benedizione</button>
            <button type="button" role="radio" aria-checked={mod.tipo === 'maledizione'} aria-selected={mod.tipo === 'maledizione'} onClick={() => set('tipo', 'maledizione')}>✸ Maledizione</button>
          </div>
          <div className="field"><label htmlFor="af-nome">Nome</label><input id="af-nome" value={mod.nome} onChange={(e) => set('nome', e.target.value)} /></div>
          <div className="field"><label htmlFor="af-eff">Effetto</label><textarea id="af-eff" rows={3} value={mod.effetto} onChange={(e) => set('effetto', e.target.value)} /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="af-or">Origine</label><input id="af-or" value={mod.origine} onChange={(e) => set('origine', e.target.value)} placeholder="Es. Loky, un PNG, un luogo" /></div>
            <div className="field"><label htmlFor="af-dur">Durata</label><input id="af-dur" value={mod.durata} onChange={(e) => set('durata', e.target.value)} placeholder="Es. Permanente, fino al prossimo live" /></div>
          </div>
          <label className="check"><input type="checkbox" checked={mod.nascosta} onChange={(e) => set('nascosta', e.target.checked)} /><span>Nascosta al giocatore</span></label>
          <label className="check"><input type="checkbox" checked={mod.terminata} onChange={(e) => set('terminata', e.target.checked)} /><span>Terminata (resta nello storico, il giocatore non la vede più)</span></label>
          {err && <p className="error">{err}</p>}
          <div className="esito-btns">
            {mod.id && <button type="button" className="btn ghost" disabled={busy} onClick={async () => {
              setBusy(true);
              try { await api.deleteAffliction(mod.id); setMod(null); ricarica(); onToast?.('Eliminata'); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
            }}>Elimina</button>}
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setMod(null)}>Annulla</button>
            <button type="button" className="btn primary" disabled={busy} onClick={salva}>{busy ? 'Salvo…' : 'Salva'}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn ghost block" onClick={() => { setErr(''); setMod(VUOTA(personaggioId)); }}>Aggiungi benedizione o maledizione</button>
      )}
    </fieldset>
  );
}
