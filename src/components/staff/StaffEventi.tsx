import { salvaFile } from '../../download';
import { useEffect, useState } from 'react';
import { api, type Profile } from '../../api';
import type { Evento, Iscrizione } from '../../data/types';
import { EventoBanner, IconaLuogo, euro, periodo, totale } from '../EventiTab';
import { ridimensiona } from '../../immagine';
import { useIndietro } from '../../indietro';

const vuoto = (): Evento => ({
  id: '', titolo: '', dataInizio: '', dataFine: '', luogo: '', descrizione: '', iscrizioniAperte: false,
  prezzi: { giorno1: null, giorno1Pernotto: null, giorni2: null, pernottoVenerdi: null, pernottoDomenica: null, pranzoSabato: null, cenaVenerdi: null, cenaDomenica: null },
  pagamento: { iban: '', intestatario: '', paypal: '', causale: '' },
});

export function StaffEventi({ profiles, onToast }: { profiles: Profile[]; onToast: (t: string) => void }) {
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [edit, setEdit] = useState<Evento | null>(null);
  const [iscritti, setIscritti] = useState<Evento | null>(null);
  useIndietro(!!edit, () => setEdit(null));
  useIndietro(!!iscritti, () => setIscritti(null));
  const [conti, setConti] = useState<Record<string, { n: number; pagati: number }>>({});
  const reload = async () => {
    const ev = await api.events(); setEventi(ev);
    const c: Record<string, { n: number; pagati: number }> = {};
    await Promise.all(ev.map(async (e) => { const l = await api.registrations(e.id).catch(() => []); c[e.id] = { n: l.length, pagati: l.filter((i) => i.pagata).length }; }));
    setConti(c);
  };
  useEffect(() => { reload(); }, []);

  if (edit) return <EventoForm e={edit} onCancel={() => setEdit(null)}
    onSave={async (e) => { await api.saveEvent(e); await reload(); setEdit(null); onToast('Evento salvato'); }}
    onDelete={async (id) => { await api.deleteEvent(id); await reload(); setEdit(null); onToast('Evento eliminato'); }} />;
  if (iscritti) return <Iscritti e={iscritti} profiles={profiles} onBack={() => setIscritti(null)} onToast={onToast} />;

  const oggi = new Date().toISOString().slice(0, 10);
  const futuri = eventi.filter((e) => (e.dataFine || e.dataInizio) >= oggi || !e.dataInizio);
  const passati = eventi.filter((e) => !futuri.includes(e)).reverse();
  return (
    <div className="page">
      <div className="list-head">
        <h1>Eventi</h1>
        <button className="btn primary" onClick={() => setEdit(vuoto())}>Nuovo evento</button>
      </div>
      {!eventi.length && (
        <div className="sev-vuoto">
          <p>Nessun evento in programma.</p>
          <p className="hint">Crea il prossimo live con “Nuovo evento”: i giocatori lo vedranno nella loro app e riceveranno un’email.</p>
        </div>
      )}
      {futuri.length > 0 && (
        <div className="sev-list">
          {futuri.map((e) => <SevCard key={e.id} e={e} conti={conti[e.id]} onIscritti={() => setIscritti(e)} onModifica={() => setEdit(e)} />)}
        </div>
      )}
      {passati.length > 0 && (
        <details className="sev-passati">
          <summary>Eventi passati ({passati.length})</summary>
          <div className="sev-list">
            {passati.map((e) => <SevCard key={e.id} e={e} passato conti={conti[e.id]} onIscritti={() => setIscritti(e)} onModifica={() => setEdit(e)} />)}
          </div>
        </details>
      )}
    </div>
  );
}

function SevCard({ e, passato, conti, onIscritti, onModifica }: {
  e: Evento; passato?: boolean; conti?: { n: number; pagati: number }; onIscritti: () => void; onModifica: () => void;
}) {
  const stato = passato ? { t: 'Concluso', c: 'fine' } : e.iscrizioniAperte ? { t: 'Iscrizioni aperte', c: 'aperte' } : { t: 'Iscrizioni chiuse', c: 'chiuse' };
  return (
    <article className={`sev-card${passato ? ' passato' : ''}`}>
      <EventoBanner e={e} compatto={passato}>
        <span className={`sev-stato ${stato.c}`}>{stato.t}</span>
      </EventoBanner>
      <div className="sev-body">
        <h2>{e.titolo || 'Senza titolo'}</h2>
        <p className="sev-quando">{e.dataInizio ? periodo(e) : 'Data da definire'}</p>
        {e.luogo && <p className="sev-luogo"><IconaLuogo /> {e.luogo}</p>}
        {conti && (
          <div className="sev-conti">
            <span><strong>{conti.n}</strong> {conti.n === 1 ? 'iscritto' : 'iscritti'}</span>
            <span><strong>{conti.pagati}</strong> {conti.pagati === 1 ? 'ha pagato' : 'hanno pagato'}</span>
          </div>
        )}
        <div className="sev-azioni">
          <button className="btn ghost" onClick={onIscritti}>Iscritti</button>
          <button className="btn ghost" onClick={onModifica}>Modifica</button>
        </div>
      </div>
    </article>
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
        <BannerField url={e.banner} onChange={(banner) => setE({ ...e, banner })} />
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

/** Immagine banner: si sceglie una foto, si rimpicciolisce e si carica subito; anteprima come la vedranno i giocatori */
function BannerField({ url, onChange }: { url?: string; onChange: (u: string | undefined) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const scegli = async (f?: File | null) => {
    if (!f) return;
    setBusy(true); setErr('');
    try { onChange(await api.uploadEventBanner(await ridimensiona(f))); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="field">
      <span className="flabel">Immagine banner (facoltativa)</span>
      <div className={`banner-pick${url ? ' piena' : ''}`}>
        {url ? <img src={url} alt="Anteprima del banner" /> : <span className="hint">{busy ? 'Carico l’immagine…' : 'Nessuna immagine: si vedrà il fondo decorativo.'}</span>}
      </div>
      <div className="banner-azioni">
        <label className="btn ghost">
          {busy ? 'Carico…' : url ? 'Cambia immagine' : 'Scegli immagine'}
          <input type="file" accept="image/*" hidden disabled={busy} onChange={(x) => { scegli(x.target.files?.[0]); x.target.value = ''; }} />
        </label>
        {url && !busy && <button type="button" className="btn ghost" onClick={() => onChange(undefined)}>Togli</button>}
      </div>
      <span className="hint">Meglio un’immagine orizzontale: viene tagliata in formato panoramico.</span>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
