import { salvaFile } from '../../download';
import { useEffect, useState } from 'react';
import { api, type Profile } from '../../api';
import type { Evento, Iscrizione } from '../../data/types';
import { euro, periodo, totale } from '../EventiTab';

const vuoto = (): Evento => ({
  id: '', titolo: '', dataInizio: '', dataFine: '', luogo: '', descrizione: '', iscrizioniAperte: false,
  prezzi: { giorno1: null, giorno1Pernotto: null, giorni2: null, pernottoVenerdi: null, pernottoDomenica: null, pranzoSabato: null, cenaVenerdi: null, cenaDomenica: null },
  pagamento: { iban: '', intestatario: '', paypal: '', causale: '' },
});

export function StaffEventi({ profiles, onToast }: { profiles: Profile[]; onToast: (t: string) => void }) {
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [edit, setEdit] = useState<Evento | null>(null);
  const [iscritti, setIscritti] = useState<Evento | null>(null);
  const reload = async () => setEventi(await api.events());
  useEffect(() => { reload(); }, []);

  if (edit) return <EventoForm e={edit} onCancel={() => setEdit(null)}
    onSave={async (e) => { await api.saveEvent(e); await reload(); setEdit(null); onToast('Evento salvato'); }}
    onDelete={async (id) => { await api.deleteEvent(id); await reload(); setEdit(null); onToast('Evento eliminato'); }} />;
  if (iscritti) return <Iscritti e={iscritti} profiles={profiles} onBack={() => setIscritti(null)} onToast={onToast} />;

  const oggi = new Date().toISOString().slice(0, 10);
  return (
    <div className="page">
      <div className="list-head">
        <h1>Eventi</h1>
        <button className="btn primary" onClick={() => setEdit(vuoto())}>Nuovo evento</button>
      </div>
      {!eventi.length && <p className="hint">Nessun evento. Crea il prossimo live con “Nuovo evento”: i giocatori lo vedranno nella loro app.</p>}
      {eventi.map((e) => (
        <div key={e.id} className={`ev-row${(e.dataFine || e.dataInizio) < oggi ? ' past' : ''}`}>
          <div>
            <strong>{e.titolo}</strong>
            <small>{e.dataInizio ? periodo(e) : 'Data da definire'}, {e.iscrizioniAperte ? 'iscrizioni aperte' : 'iscrizioni chiuse'}</small>
          </div>
          <div className="ev-actions">
            <button className="btn ghost" onClick={() => setIscritti(e)}>Iscritti</button>
            <button className="btn ghost" onClick={() => setEdit(e)}>Modifica</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventoForm({ e: init, onCancel, onSave, onDelete }: { e: Evento; onCancel: () => void; onSave: (e: Evento) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [e, setE] = useState(init);
  const [err, setErr] = useState('');
  const [conferma, setConferma] = useState(false);
  const price = (k: keyof Evento['prezzi'], label: string) => (
    <div className="field"><label htmlFor={`p-${k}`}>{label} (€)</label>
      <input id={`p-${k}`} type="number" min={0} step="0.5" value={e.prezzi[k] ?? ''} onChange={(x) => setE({ ...e, prezzi: { ...e.prezzi, [k]: x.target.value === '' ? null : Number(x.target.value) } })} />
    </div>
  );
  const pay = (k: keyof Evento['pagamento'], label: string, ph = '') => (
    <div className="field"><label htmlFor={`pay-${k}`}>{label}</label><input id={`pay-${k}`} value={e.pagamento[k]} placeholder={ph} onChange={(x) => setE({ ...e, pagamento: { ...e.pagamento, [k]: x.target.value } })} /></div>
  );
  const save = async (x: React.FormEvent) => {
    x.preventDefault();
    if (!e.titolo.trim() || !e.dataInizio) { setErr('Servono almeno il titolo e la data di inizio.'); return; }
    try { await onSave({ ...e, dataFine: e.dataFine || e.dataInizio }); } catch (y) { setErr((y as Error).message); }
  };
  return (
    <form className="page form" onSubmit={save}>
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={onCancel}>Torna agli eventi</button>
      <h1>{init.id ? 'Modifica evento' : 'Nuovo evento'}</h1>
      <fieldset className="fs">
        <legend>Evento</legend>
        <div className="field"><label htmlFor="e-tit">Titolo</label><input id="e-tit" value={e.titolo} onChange={(x) => setE({ ...e, titolo: x.target.value })} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="e-da">Inizio</label><input id="e-da" type="date" value={e.dataInizio} onChange={(x) => setE({ ...e, dataInizio: x.target.value })} /></div>
          <div className="field"><label htmlFor="e-a">Fine</label><input id="e-a" type="date" value={e.dataFine} onChange={(x) => setE({ ...e, dataFine: x.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="e-luogo">Luogo</label><input id="e-luogo" value={e.luogo} onChange={(x) => setE({ ...e, luogo: x.target.value })} /></div>
        <div className="field"><label htmlFor="e-desc">Descrizione</label><textarea id="e-desc" rows={4} value={e.descrizione} onChange={(x) => setE({ ...e, descrizione: x.target.value })} /></div>
        <label className="check"><input type="checkbox" checked={e.iscrizioniAperte} onChange={(x) => setE({ ...e, iscrizioniAperte: x.target.checked })} /><span>Iscrizioni aperte</span></label>
      </fieldset>
      <fieldset className="fs">
        <legend>Prezzi</legend>
        <p className="hint">Lascia vuoto un prezzo per non mostrarlo: i pasti senza prezzo non compaiono né nell’annuncio né nell’iscrizione. Il totale compare al giocatore solo quando tutte le voci che ha scelto hanno un prezzo.</p>
        <div className="grid2">
          {price('giorno1', 'Biglietto 1 giorno')}{price('giorno1Pernotto', '1 giorno + pernotto')}{price('giorni2', '2 giorni')}
          {price('pernottoVenerdi', 'Pernotto extra venerdì')}{price('pernottoDomenica', 'Pernotto extra domenica')}{price('cenaVenerdi', 'Cena del venerdì')}{price('pranzoSabato', 'Pranzo del sabato')}{price('cenaDomenica', 'Cena della domenica')}
        </div>
      </fieldset>
      <fieldset className="fs">
        <legend>Pagamento</legend>
        <p className="hint">Questi dati li vede solo chi si è iscritto, in base al metodo scelto.</p>
        {pay('iban', 'IBAN')}{pay('intestatario', 'Intestatario del conto')}{pay('paypal', 'Indirizzo PayPal')}{pay('causale', 'Causale', 'Es. nome del PG ed evento')}
      </fieldset>
      {err && <p className="error">{err}</p>}
      <button className="btn primary block">Salva evento</button>
      {init.id && (conferma
        ? <div className="sheet-actions"><button type="button" className="btn ghost" onClick={() => setConferma(false)}>Annulla</button><button type="button" className="btn danger" onClick={() => onDelete(init.id)}>Elimina evento e iscrizioni</button></div>
        : <button type="button" className="btn ghost block" onClick={() => setConferma(true)}>Elimina evento</button>)}
    </form>
  );
}

const SN = (b: boolean) => (b ? 'Sì' : 'No');
function csv(e: Evento, list: Iscrizione[]) {
  const head = ['Nome', 'Cognome', 'Nome PG', 'Nuovo giocatore', 'Associazione', 'Email', 'Biglietto', 'Pernotto extra venerdì', 'Pernotto extra domenica', 'Cena venerdì', 'Pranzo sabato', 'Cena domenica', 'Metodo di pagamento', 'Totale', 'Pagato', 'Note', 'Iscritto il'];
  const rows = list.map((i) => {
    const d = i.dati; const t = totale(e, d);
    return [d.nome, d.cognome, d.nomePg, SN(d.nuovoGiocatore), d.associato ? 'Associato' : 'Non ancora associato', d.email, d.biglietto,
      SN(d.pernottoVenerdi), SN(d.pernottoDomenica), SN(!!d.cenaVenerdi), SN(d.pranzoSabato), SN(!!d.cenaDomenica), d.pagamento, t != null ? t.toFixed(2).replace('.', ',') : '', SN(i.pagata), d.note ?? '',
      new Date(i.creata).toLocaleDateString('it-IT')];
  });
  return '﻿' + [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

function Iscritti({ e, onBack, onToast }: { e: Evento; profiles: Profile[]; onBack: () => void; onToast: (t: string) => void }) {
  const [list, setList] = useState<Iscrizione[] | null>(null);
  const reload = async () => setList(await api.registrations(e.id));
  useEffect(() => { reload(); }, []);
  const scarica = async () => {
    const blob = new Blob([csv(e, list ?? [])], { type: 'text/csv;charset=utf-8' });
    try { await salvaFile(`iscritti-${e.titolo.replace(/\W+/g, '-').toLowerCase()}.csv`, blob); }
    catch (x) { onToast(`Download non riuscito: ${(x as Error).message}`); }
  };
  const n = list?.length ?? 0;
  const pernottiVen = list?.filter((i) => i.dati.pernottoVenerdi).length ?? 0;
  const pranzi = list?.filter((i) => i.dati.pranzoSabato).length ?? 0;
  const ceneVen = list?.filter((i) => i.dati.cenaVenerdi).length ?? 0;
  const ceneDom = list?.filter((i) => i.dati.cenaDomenica).length ?? 0;
  const nuovi = list?.filter((i) => i.dati.nuovoGiocatore).length ?? 0;
  return (
    <div className="page">
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>Torna agli eventi</button>
      <h1>{e.titolo}</h1>
      <p className="hint">{periodo(e)}</p>
      <div className="stats">
        <div><strong>{n}</strong><span>iscritti</span></div>
        <div><strong>{nuovi}</strong><span>nuovi giocatori</span></div>
        <div><strong>{pernottiVen}</strong><span>pernotti venerdì</span></div>
        {(e.prezzi.cenaVenerdi != null || ceneVen > 0) && <div><strong>{ceneVen}</strong><span>cene venerdì</span></div>}
        <div><strong>{pranzi}</strong><span>pranzi sabato</span></div>
        {(e.prezzi.cenaDomenica != null || ceneDom > 0) && <div><strong>{ceneDom}</strong><span>cene domenica</span></div>}
      </div>
      <button className="btn ghost" disabled={!n} onClick={scarica}>Scarica elenco per Excel</button>
      {list && !n && <p className="hint">Ancora nessun iscritto.</p>}
      <div>
        {list?.map((i) => {
          const d = i.dati; const t = totale(e, d);
          return (
            <div key={i.id} className="isc-row">
              <div>
                <strong>{d.nome} {d.cognome}</strong>
                <small>{d.nomePg}, {d.biglietto}{d.pernottoVenerdi ? ', pernotto ven.' : ''}{d.pernottoDomenica ? ', pernotto dom.' : ''}{d.cenaVenerdi ? ', cena ven.' : ''}{d.pranzoSabato ? ', pranzo sab.' : ''}{d.cenaDomenica ? ', cena dom.' : ''}</small>
                <small>{d.email}, {d.associato ? 'associato' : 'non associato'}{d.nuovoGiocatore ? ', nuovo giocatore' : ''}, {d.pagamento}{t != null ? `, ${euro(t)}` : ''}</small>
                {d.note && <small>Note: {d.note}</small>}
              </div>
              <label className="mini-check"><input type="checkbox" checked={i.pagata} onChange={async (x) => { await api.setPaid(i.id, x.target.checked); await reload(); onToast(x.target.checked ? 'Segnato come pagato' : 'Pagamento tolto'); }} /> Pagato</label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
