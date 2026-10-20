import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Manuale } from '../../data/types';
import { useManuali } from '../ManualiTab';

/** Fa imparare al chatbot il testo di un manuale (o lo toglie, se il manuale è nascosto) */
async function indicizza(m: Manuale, onStato: (t: string) => void) {
  if (m.nascosto) { await api.indexManual(m.id, []); return 0; }
  const { estraiParti } = await import('../../manuali/indicizza');
  const parti = await estraiParti(await api.manualUrl(m), m.id, m.nome, (n, t) => onStato(`Leggo ${m.nome}: pagina ${n} di ${t}`));
  onStato(`Salvo ${m.nome}…`);
  await api.indexManual(m.id, parti);
  return parti.length;
}

/** Staff: gestione dei manuali (aggiungere, sostituire, rinominare, nascondere) e testi del chatbot */
export function ChatbotPanel({ onToast }: { onToast: (t: string) => void }) {
  const { list, ricarica } = useManuali();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [stato, setStato] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mod, setMod] = useState<Manuale | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const ricaricaStats = (l: Manuale[]) => api.manualIndexStats(l.map((m) => m.id)).then(setStats).catch(() => setStats({}));
  useEffect(() => { if (list.length) ricaricaStats(list); }, [list]);

  const esegui = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); setStato(''); }
  };

  const aggiornaTutti = () => esegui(async () => {
    let tot = 0;
    for (const [i, m] of list.entries()) { setStato(`Leggo ${m.nome} (${i + 1} di ${list.length})…`); tot += await indicizza(m, setStato); }
    onToast(`Chatbot aggiornato: ${tot} passaggi`); await ricaricaStats(list);
  });

  const salva = () => esegui(async () => {
    if (!mod) return;
    if (!mod.nome.trim()) throw new Error('Scrivi il nome del manuale.');
    if (!mod.id && !file) throw new Error('Scegli il file PDF del manuale.');
    if (file && file.type && file.type !== 'application/pdf') throw new Error('Il file deve essere un PDF.');
    setStato(file ? 'Carico il PDF…' : 'Salvo…');
    const nascostoPrima = list.find((x) => x.id === mod.id)?.nascosto;
    const saved = await api.saveManual({ ...mod, nome: mod.nome.trim(), descrizione: mod.descrizione.trim(), sigla: mod.sigla.trim().slice(0, 2) }, file);
    // il chatbot impara il nuovo testo (o lo dimentica se il manuale è nascosto)
    if (file || nascostoPrima !== saved.nascosto || !mod.id) { setStato(`Aggiorno il chatbot con ${saved.nome}…`); await indicizza(saved, setStato); }
    setMod(null); setFile(null); onToast('Manuale salvato'); await ricarica();
  });

  const nuovo = (): Manuale => ({ id: '', nome: '', descrizione: '', sigla: '', ordine: 100 + list.length, nascosto: false, base: false });

  return (
    <section className="panel chatbot-panel">
      <h2 className="section-title">Manuali e chatbot</h2>
      <p className="hint">Aggiungi nuovi manuali (es. FAQ) o sostituisci il PDF di uno esistente: compare subito ai giocatori e il chatbot ne impara il testo.</p>

      <ul className="man-admin">
        {list.map((m) => (
          <li key={m.id} className={m.nascosto ? 'ended' : ''}>
            <div>
              <strong>{m.nome}</strong>
              <small>{[m.nascosto ? 'nascosto' : null, m.filePath ? 'PDF caricato dallo staff' : 'PDF di base', stats ? (stats[m.id] ? `chatbot: ${stats[m.id]} passaggi` : 'chatbot: non caricato') : null].filter(Boolean).join(' · ')}</small>
            </div>
            <button className="link" disabled={busy} onClick={() => { setErr(''); setFile(null); setMod(m); }}>Modifica</button>
          </li>
        ))}
      </ul>

      {mod ? (
        <div className="affl-form">
          <h3 style={{ margin: 0 }}>{mod.id ? `Modifica: ${mod.nome}` : 'Nuovo manuale'}</h3>
          <div className="field">
            <label htmlFor="man-file">{mod.id ? 'Sostituisci il PDF (facoltativo)' : 'File PDF'}</label>
            <input id="man-file" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="field"><label htmlFor="man-nome">Nome</label><input id="man-nome" value={mod.nome} onChange={(e) => setMod({ ...mod, nome: e.target.value })} placeholder="Es. FAQ del regolamento" /></div>
          <div className="field"><label htmlFor="man-desc">Descrizione</label><input id="man-desc" value={mod.descrizione} onChange={(e) => setMod({ ...mod, descrizione: e.target.value })} placeholder="Es. Domande frequenti e chiarimenti" /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="man-sigla">Sigla in copertina</label><input id="man-sigla" maxLength={2} value={mod.sigla} onChange={(e) => setMod({ ...mod, sigla: e.target.value })} placeholder="Es. F" /></div>
            <div className="field"><label htmlFor="man-ord">Posizione nell’elenco</label><input id="man-ord" type="number" value={mod.ordine} onChange={(e) => setMod({ ...mod, ordine: Number(e.target.value) || 0 })} /></div>
          </div>
          <label className="check"><input type="checkbox" checked={mod.nascosto} onChange={(e) => setMod({ ...mod, nascosto: e.target.checked })} /><span>Nascosto ai giocatori (anche il chatbot smette di usarlo)</span></label>
          {stato && <p className="hint" role="status">{stato}</p>}
          {err && <p className="error">{err}</p>}
          <div className="esito-btns">
            {mod.id && !mod.base && (
              <button className="btn ghost" disabled={busy} onClick={() => esegui(async () => {
                await api.deleteManual(mod); setMod(null); onToast('Manuale eliminato'); await ricarica();
              })}>Elimina</button>
            )}
            <button className="btn ghost" disabled={busy} onClick={() => { setMod(null); setFile(null); }}>Annulla</button>
            <button className="btn primary" disabled={busy} onClick={salva}>{busy ? 'Attendi…' : 'Salva'}</button>
          </div>
        </div>
      ) : (
        <>
          {stato && <p className="hint" role="status">{stato}</p>}
          {err && <p className="error">{err}</p>}
          <button className="btn primary block" disabled={busy} onClick={() => { setErr(''); setFile(null); setMod(nuovo()); }}>Aggiungi un manuale</button>
          <button className="btn ghost block" disabled={busy} onClick={aggiornaTutti}>{busy ? 'Aggiorno…' : 'Aggiorna il chatbot con tutti i manuali'}</button>
        </>
      )}
    </section>
  );
}
