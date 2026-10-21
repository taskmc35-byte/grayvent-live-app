import { useEffect, useState } from 'react';
import { api, IMPOSTAZIONI_DEFAULT } from '../api';
import type { Character, Impostazioni, Missiva, MissivaStaff, TipoMissiva } from '../data/types';
import { Seal } from './Seal';
import { useIndietro } from '../indietro';

export const TIPI: { id: TipoMissiva; nome: string }[] = [
  { id: 'normale', nome: 'Posta semplice' }, { id: 'assicurata', nome: 'Posta assicurata' },
  { id: 'rapida', nome: 'Assicurata e rapida' }, { id: 'runica', nome: 'Assicurata e runica' },
];
export const dataOra = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const STATO: Record<Missiva['stato'], string> = { inviata: 'Inviata', letta: 'Ricevuta dallo staff', risposta: 'Risposta arrivata' };

/** missive da leggere: lettere dello staff non aperte e risposte arrivate e non ancora lette */
export const daLeggere = (inviate: Missiva[], ricevute: MissivaStaff[]) =>
  ricevute.filter((m) => !m.letta).length + inviate.filter((m) => m.risposta && !m.rispostaLetta).length;

export function MissiveTab({ pgs, onToast, onCount }: { pgs: Character[]; onToast: (t: string) => void; onCount?: () => void }) {
  const [list, setList] = useState<Missiva[] | null>(null);
  const [imp, setImp] = useState<Impostazioni>(IMPOSTAZIONI_DEFAULT);
  const [scrivi, setScrivi] = useState(false);
  const [aperta, setAperta] = useState<Missiva | null>(null);
  const [sigillo, setSigillo] = useState(false);
  const [ricevute, setRicevute] = useState<MissivaStaff[]>([]);
  const [vista, setVista] = useState<'ricevute' | 'inviate'>('inviate');
  const [apertaR, setApertaR] = useState<MissivaStaff | null>(null);
  useIndietro(scrivi, () => setScrivi(false));
  useIndietro(!!aperta, () => setAperta(null));
  useIndietro(!!apertaR, () => setApertaR(null));
  const approvati = pgs.filter((p) => p.stato === 'approvato' || !p.stato);
  const reload = async () => { const [l, s] = await Promise.all([api.myLetters(), api.settings()]); setList(l); setImp(s); };
  useEffect(() => { reload().catch(() => setList([])); }, []);
  const reloadR = () => api.myStaffLetters().then((r) => { setRicevute(r); if (r.some((m) => !m.letta)) setVista('ricevute'); }).catch(() => setRicevute([]));
  useEffect(() => { reloadR(); }, []);
  const nuove = ricevute.filter((m) => !m.letta).length;
  const risposteNuove = (list ?? []).filter((m) => m.risposta && !m.rispostaLetta).length;
  const apri = (m: Missiva) => {
    if (m.risposta && !m.rispostaLetta) {
      setList((l) => l?.map((x) => (x.id === m.id ? { ...x, rispostaLetta: new Date().toISOString() } : x)) ?? l);
      api.markReplyRead(m.id).then(() => onCount?.()).catch(() => {});
    }
    setAperta(m);
  };

  if (apertaR) return (
    <div className="page">
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => { setApertaR(null); api.myStaffLetters().then(setRicevute).catch(() => {}); }}>Torna alle missive</button>
      <article className="letter">
        <span className="tag">Ricevuta il {dataOra(apertaR.inviata)}</span>
        <h2>A {apertaR.destinatario}</h2>
        <p className="letter-body">{apertaR.testo}</p>
        <p className="letter-sign">{apertaR.mittente}</p>
      </article>
      <p className="hint">A questa missiva non si risponde dall’app.</p>
    </div>
  );

  if (scrivi) return <Componi pgs={approvati} imp={imp} onCancel={() => setScrivi(false)}
    onSent={async () => { await reload(); setScrivi(false); setSigillo(true); window.scrollTo(0, 0); }} />;

  if (aperta) return (
    <div className="page">
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setAperta(null)}>Torna alle missive</button>
      <article className="letter">
        <span className="tag">{TIPI.find((t) => t.id === aperta.tipo)?.nome}, {dataOra(aperta.inviata)}</span>
        <h2>A {aperta.destinatario}</h2>
        <p className="letter-body">{aperta.testo}</p>
        <p className="letter-sign">{aperta.mittente}</p>
      </article>
      {aperta.risposta && (
        <article className="letter reply">
          <span className="tag">Risposta, {aperta.rispostaIl ? dataOra(aperta.rispostaIl) : ''}</span>
          <h2>Da {aperta.destinatario}</h2>
          <p className="letter-body">{aperta.risposta}</p>
        </article>
      )}
    </div>
  );

  return (
    <div className="page">
      {sigillo && <Seal label="Missiva spedita" onDone={() => { setSigillo(false); onToast('Missiva spedita'); }} />}
      <div className="list-head">
        <h1>Missive</h1>
        <button className="btn primary" disabled={!approvati.length} onClick={() => setScrivi(true)}>Scrivi</button>
      </div>
      {ricevute.length > 0 && (
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={vista === 'ricevute'} onClick={() => setVista('ricevute')}>Ricevute{nuove ? ` (${nuove} ${nuove === 1 ? 'nuova' : 'nuove'})` : ''}</button>
          <button role="tab" aria-selected={vista === 'inviate'} onClick={() => setVista('inviate')}>Inviate{risposteNuove ? ` (${risposteNuove} ${risposteNuove === 1 ? 'risposta' : 'risposte'})` : ''}</button>
        </div>
      )}
      {vista === 'ricevute' && ricevute.length > 0 ? (
        <div>
          {ricevute.map((m) => (
            <button key={m.id} className="row-btn" onClick={() => {
              if (!m.letta) { setRicevute((r) => r.map((x) => (x.id === m.id ? { ...x, letta: new Date().toISOString() } : x))); api.markStaffLetterRead(m.id).then(() => onCount?.()).catch(() => {}); }
              setApertaR(m);
            }}>
              <span>Da {m.mittente}</span>
              <small>A {m.destinatario}, {dataOra(m.inviata)}{!m.letta && <>, <b className="gold">nuova</b></>}</small>
            </button>
          ))}
        </div>
      ) : (<>
      <p className="hint">Scrivi ai personaggi tra un evento e l’altro. Le lettere arrivano allo staff; il costo in Astri d’Argento viene scalato all’inizio dell’evento successivo.</p>
      {!approvati.length && <p className="hint">Potrai scrivere quando la tua scheda sarà approvata.</p>}
      {list?.length === 0 && approvati.length > 0 && <p className="hint">Non hai ancora spedito missive.</p>}
      <div>
        {list?.map((m) => (
          <button key={m.id} className={`row-btn${m.risposta && !m.rispostaLetta ? ' da-leggere' : ''}`} onClick={() => apri(m)}>
            <span>A {m.destinatario}</span>
            <small>{TIPI.find((t) => t.id === m.tipo)?.nome}, {dataOra(m.inviata)}, <b className={m.stato === 'risposta' ? 'gold' : ''}>{m.risposta && !m.rispostaLetta ? 'Risposta da leggere' : STATO[m.stato]}</b></small>
          </button>
        ))}
      </div>
      </>)}
    </div>
  );
}

function Componi({ pgs, imp, onCancel, onSent }: { pgs: Character[]; imp: Impostazioni; onCancel: () => void; onSent: () => Promise<void> }) {
  const [pgId, setPgId] = useState(pgs[0]?.id ?? '');
  const [tipo, setTipo] = useState<TipoMissiva>('normale');
  const [dest, setDest] = useState('');
  const [testo, setTesto] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pg = pgs.find((p) => p.id === pgId);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dest.trim() || !testo.trim()) { setErr('Scrivi il destinatario e il testo della lettera.'); return; }
    setBusy(true); setErr('');
    try { await api.sendLetter({ personaggioId: pgId || null, mittente: pg ? `${pg.nome} ${pg.cognome}`.trim() : '', tipo, destinatario: dest.trim(), testo: testo.trim() }); await onSent(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <form className="page form" onSubmit={send}>
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={onCancel}>Annulla</button>
      <h1 style={{ fontSize: '1.9rem' }}>Nuova missiva</h1>
      {pgs.length > 1 && (
        <div className="field"><label htmlFor="m-pg">Mittente</label>
          <select id="m-pg" value={pgId} onChange={(e) => setPgId(e.target.value)}>{pgs.map((p) => <option key={p.id} value={p.id}>{p.nome} {p.cognome}</option>)}</select>
        </div>
      )}
      <div className="field" role="radiogroup" aria-label="Tipo di lettera">
        <span className="flabel">Tipo di lettera</span>
        <div className="armor-opts">
          {TIPI.map((t) => (
            <label key={t.id} className="armor-opt">
              <input type="radio" name="tipo" checked={tipo === t.id} onChange={() => setTipo(t.id)} />
              <span>{t.nome}{imp.missive[t.id].descrizione && <small>{imp.missive[t.id].descrizione}</small>}</span>
              {imp.missive[t.id].costo > 0 && <span className="pa-val">{imp.missive[t.id].costo.toLocaleString('it-IT')} AA</span>}
            </label>
          ))}
        </div>
      </div>
      <div className="field"><label htmlFor="m-dest">Destinatario</label><input id="m-dest" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Nome del personaggio" /></div>
      <div className="field"><label htmlFor="m-testo">Testo</label><textarea id="m-testo" rows={10} value={testo} onChange={(e) => setTesto(e.target.value)} /></div>
      {pg && <p className="hint">Firmata da {pg.nome} {pg.cognome}.</p>}
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" disabled={busy}>{busy ? 'Spedisco…' : 'Spedisci'}</button>
    </form>
  );
}
