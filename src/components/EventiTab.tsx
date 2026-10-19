import { useEffect, useState } from 'react';
import { api, type User } from '../api';
import type { Biglietto, Character, DatiIscrizione, Evento, Iscrizione } from '../data/types';

export const dataLunga = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const periodo = (e: Evento) => (e.dataFine && e.dataFine !== e.dataInizio ? `dal ${dataLunga(e.dataInizio)} al ${dataLunga(e.dataFine)}` : dataLunga(e.dataInizio));
export const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const PREZZO_BIGLIETTO: Record<Biglietto, keyof Evento['prezzi']> = { '1 giorno': 'giorno1', '1 giorno + pernotto': 'giorno1Pernotto', '2 giorni': 'giorni2' };

/** Totale dovuto, se lo staff ha inserito tutti i prezzi che servono */
export function totale(e: Evento, d: DatiIscrizione): number | null {
  const voci: (number | null)[] = [e.prezzi[PREZZO_BIGLIETTO[d.biglietto]]];
  if (d.pernottoVenerdi) voci.push(e.prezzi.pernottoVenerdi);
  if (d.pernottoDomenica) voci.push(e.prezzi.pernottoDomenica);
  if (d.pranzoSabato) voci.push(e.prezzi.pranzoSabato);
  if (voci.some((v) => v == null)) return null;
  return (voci as number[]).reduce((a, b) => a + b, 0);
}

export function EventiTab({ user, pg, onToast }: { user: User; pg?: Character; onToast: (t: string) => void }) {
  const [eventi, setEventi] = useState<Evento[] | null>(null);
  const [mie, setMie] = useState<Iscrizione[]>([]);
  const [form, setForm] = useState<Evento | null>(null);
  const [err, setErr] = useState('');
  const reload = async () => {
    try { const [e, m] = await Promise.all([api.events(), api.myRegistrations()]); setEventi(e); setMie(m); }
    catch (x) { setErr((x as Error).message); }
  };
  useEffect(() => { reload(); }, []);

  const oggi = new Date().toISOString().slice(0, 10);
  const futuri = (eventi ?? []).filter((e) => (e.dataFine || e.dataInizio) >= oggi);
  const prossimo = futuri[0];
  const altri = futuri.slice(1);

  if (form) {
    const esistente = mie.find((i) => i.eventoId === form.id);
    return <Iscrizione evento={form} user={user} pg={pg} esistente={esistente}
      onCancel={() => setForm(null)}
      onDone={async () => { await reload(); setForm(null); onToast(esistente ? 'Iscrizione aggiornata' : 'Iscrizione inviata'); window.scrollTo(0, 0); }} />;
  }

  return (
    <div className="page">
      <h1 style={{ fontSize: '2rem' }}>Eventi</h1>
      {err && <div className="notice">{err}</div>}
      {eventi === null && !err && <p className="hint">Carico gli eventi…</p>}
      {eventi && !prossimo && <p className="hint">Non ci sono eventi in programma. Quando lo staff pubblica il prossimo live lo trovi qui.</p>}
      {prossimo && (
        <EventoCard e={prossimo} grande isc={mie.find((i) => i.eventoId === prossimo.id)} onIscriviti={() => setForm(prossimo)} />
      )}
      {altri.length > 0 && (
        <section>
          <h2 className="section-title">Più avanti</h2>
          <div className="ev-list">
            {altri.map((e) => <EventoCard key={e.id} e={e} isc={mie.find((i) => i.eventoId === e.id)} onIscriviti={() => setForm(e)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function EventoCard({ e, grande, isc, onIscriviti }: { e: Evento; grande?: boolean; isc?: Iscrizione; onIscriviti: () => void }) {
  const tot = isc ? totale(e, isc.dati) : null;
  return (
    <article className={`ev-card${grande ? ' big' : ''}`}>
      {grande && <span className="tag">Prossimo evento</span>}
      <h2>{e.titolo}</h2>
      <p className="ev-when">{periodo(e)}</p>
      {e.luogo && <p className="hint">{e.luogo}</p>}
      {grande && e.descrizione && <p className="ev-desc">{e.descrizione}</p>}
      {isc ? (
        <div className="ev-status">
          <span className={`pill ${isc.pagata ? 'ok' : 'wait'}`}>{isc.pagata ? 'Iscritto, pagamento ricevuto' : 'Iscritto, in attesa di pagamento'}</span>
          <p className="hint">Biglietto {isc.dati.biglietto}, pagamento con {isc.dati.pagamento}{tot != null ? `, totale ${euro(tot)}` : ''}.</p>
          {!isc.pagata && <Pagamento e={e} d={isc.dati} />}
          {e.iscrizioniAperte && !isc.pagata && <button className="btn ghost" onClick={onIscriviti}>Modifica iscrizione</button>}
        </div>
      ) : e.iscrizioniAperte
        ? <button className="btn primary" onClick={onIscriviti}>Iscriviti</button>
        : <p className="hint">Iscrizioni non ancora aperte.</p>}
    </article>
  );
}

function Pagamento({ e, d }: { e: Evento; d: DatiIscrizione }) {
  const p = e.pagamento;
  if (d.pagamento === 'Bonifico' && p.iban) return (
    <dl className="facts pay"><dt>IBAN</dt><dd className="sel">{p.iban}</dd>{p.intestatario && (<><dt>Intestato a</dt><dd>{p.intestatario}</dd></>)}{p.causale && (<><dt>Causale</dt><dd>{p.causale}</dd></>)}</dl>
  );
  if (d.pagamento === 'PayPal' && p.paypal) return (
    <dl className="facts pay"><dt>PayPal</dt><dd className="sel">{p.paypal}</dd>{p.causale && (<><dt>Causale</dt><dd>{p.causale}</dd></>)}</dl>
  );
  return <p className="hint">I dati per il pagamento te li comunica lo staff.</p>;
}

function Iscrizione({ evento, user, pg, esistente, onCancel, onDone }: {
  evento: Evento; user: User; pg?: Character; esistente?: Iscrizione; onCancel: () => void; onDone: () => Promise<void>;
}) {
  const [nomeG, ...cognomeG] = (user.nome ?? '').split(' ');
  const [d, setD] = useState<DatiIscrizione>(esistente?.dati ?? {
    nome: nomeG ?? '', cognome: cognomeG.join(' '), nomePg: pg ? `${pg.nome} ${pg.cognome}`.trim() : '',
    nuovoGiocatore: !pg || pg.stato !== 'approvato', associato: false, email: user.email === 'demo' ? '' : user.email,
    biglietto: '2 giorni', pernottoVenerdi: false, pernottoDomenica: false, pranzoSabato: false, pagamento: 'Bonifico',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof DatiIscrizione>(k: K, v: DatiIscrizione[K]) => setD((x) => ({ ...x, [k]: v }));
  const tot = totale(evento, d);
  const pr = evento.prezzi;
  const prezzo = (v: number | null) => (v != null ? ` (${euro(v)})` : '');

  const yesNo = (id: string, label: string, val: boolean, on: (v: boolean) => void, yes = 'Sì', no = 'No') => (
    <div className="field" role="radiogroup" aria-labelledby={`${id}-l`}>
      <span id={`${id}-l`} className="flabel">{label}</span>
      <div className="seg">
        <button type="button" aria-pressed={val} className={val ? 'on' : ''} onClick={() => on(true)}>{yes}</button>
        <button type="button" aria-pressed={!val} className={!val ? 'on' : ''} onClick={() => on(false)}>{no}</button>
      </div>
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.nome.trim() || !d.cognome.trim() || !d.nomePg.trim() || !d.email.trim()) { setErr('Compila nome, cognome, nome del personaggio ed email.'); return; }
    setBusy(true); setErr('');
    try { await api.register(evento.id, d); await onDone(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <form className="page form" onSubmit={submit}>
      <button type="button" className="link" onClick={onCancel} style={{ alignSelf: 'flex-start' }}>Torna agli eventi</button>
      <h1 style={{ fontSize: '1.9rem' }}>Iscrizione a {evento.titolo}</h1>
      <p className="hint">{periodo(evento)}</p>
      <div className="grid2">
        <div className="field"><label htmlFor="i-nome">Nome completo</label><input id="i-nome" value={d.nome} onChange={(e) => set('nome', e.target.value)} /></div>
        <div className="field"><label htmlFor="i-cognome">Cognome completo</label><input id="i-cognome" value={d.cognome} onChange={(e) => set('cognome', e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="i-pg">Nome completo del PG</label><input id="i-pg" value={d.nomePg} onChange={(e) => set('nomePg', e.target.value)} /></div>
      <div className="field"><label htmlFor="i-email">Email personale</label><input id="i-email" type="email" value={d.email} onChange={(e) => set('email', e.target.value)} /></div>
      {yesNo('i-nuovo', 'Nuovo giocatore?', d.nuovoGiocatore, (v) => set('nuovoGiocatore', v))}
      {yesNo('i-ass', 'Associazione', d.associato, (v) => set('associato', v), 'Associato', 'Non ancora associato')}
      <div className="field">
        <label htmlFor="i-big">Biglietto</label>
        <select id="i-big" value={d.biglietto} onChange={(e) => set('biglietto', e.target.value as Biglietto)}>
          <option value="1 giorno">1 giorno{prezzo(pr.giorno1)}</option>
          <option value="1 giorno + pernotto">1 giorno + pernotto{prezzo(pr.giorno1Pernotto)}</option>
          <option value="2 giorni">2 giorni{prezzo(pr.giorni2)}</option>
        </select>
      </div>
      {yesNo('i-ven', `Pernotto extra venerdì?${prezzo(pr.pernottoVenerdi)}`, d.pernottoVenerdi, (v) => set('pernottoVenerdi', v))}
      {yesNo('i-dom', `Pernotto extra domenica?${prezzo(pr.pernottoDomenica)}`, d.pernottoDomenica, (v) => set('pernottoDomenica', v))}
      {yesNo('i-pranzo', `Pranzo del sabato?${prezzo(pr.pranzoSabato)}`, d.pranzoSabato, (v) => set('pranzoSabato', v))}
      {yesNo('i-pag', 'Metodo di pagamento', d.pagamento === 'PayPal', (v) => set('pagamento', v ? 'PayPal' : 'Bonifico'), 'PayPal', 'Bonifico')}
      <div className="field"><label htmlFor="i-note">Note per lo staff (facoltative)</label><textarea id="i-note" rows={2} value={d.note ?? ''} onChange={(e) => set('note', e.target.value || undefined)} /></div>
      {tot != null && <p className="total">Totale: <strong>{euro(tot)}</strong></p>}
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" disabled={busy}>{busy ? 'Invio…' : esistente ? 'Aggiorna iscrizione' : 'Invia iscrizione'}</button>
    </form>
  );
}
