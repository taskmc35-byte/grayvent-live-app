import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Manuale } from '../../data/types';
import { ApriManuale, Libro, useManuali } from '../ManualiTab';
import { BottomSheet } from '../Sheet';

/** Fa imparare al chatbot il testo di un manuale (o lo toglie, se il manuale è nascosto) */
async function indicizza(m: Manuale, onStato: (t: string) => void) {
  // nascosti e riservati allo staff: il chatbot (che rispondono anche ai giocatori) non li usa
  if (m.nascosto || m.soloStaff) { await api.indexManual(m.id, []); return 0; }
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
    const prima = list.find((x) => x.id === mod.id);
    const nascostoPrima = prima?.nascosto || prima?.soloStaff;
    const saved = await api.saveManual({ ...mod, nome: mod.nome.trim(), descrizione: mod.descrizione.trim(), sigla: mod.sigla.trim().slice(0, 2) }, file);
    // il chatbot impara il nuovo testo (o lo dimentica se il manuale è nascosto)
    if (file || !!nascostoPrima !== (saved.nascosto || !!saved.soloStaff) || !mod.id) { setStato(`Aggiorno il chatbot con ${saved.nome}…`); await indicizza(saved, setStato); }
    setMod(null); setFile(null); onToast('Manuale salvato'); await ricarica();
  });

  const nuovo = (): Manuale => ({ id: '', nome: '', descrizione: '', sigla: '', ordine: 100 + list.length, nascosto: false, base: false });
  const [apri, setApri] = useState<Manuale | null>(null);
  const perChatbot = list.filter((m) => !m.nascosto && !m.soloStaff);
  const caricati = stats ? perChatbot.filter((m) => stats[m.id]).length : 0;
  const daCaricare = stats ? perChatbot.filter((m) => !stats[m.id]).length : 0;
  const passaggi = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;
  const chiudi = () => { if (!busy) { setMod(null); setFile(null); setErr(''); } };

  return (
    <div className="page man-staff">
      <div className="list-head">
        <h1>Manuali</h1>
        <button className="btn primary" disabled={busy} onClick={() => { setErr(''); setFile(null); setMod(nuovo()); }}>Aggiungi</button>
      </div>

      <section className={`bot-stato${daCaricare ? ' attenzione' : ''}`}>
        <div className="bot-stato-head">
          <span className="chat-sigillo" aria-hidden="true">?</span>
          <div>
            <h2>Chatbot dei manuali</h2>
            <p>{stats === null ? 'Controllo…' : daCaricare
              ? `${daCaricare} ${daCaricare === 1 ? 'manuale non ancora letto' : 'manuali non ancora letti'} dal chatbot`
              : `Conosce ${caricati} ${caricati === 1 ? 'manuale' : 'manuali'} (${passaggi} passaggi)`}</p>
          </div>
        </div>
        {stato && !mod && <p className="bot-progresso" role="status"><span className="spinner" aria-hidden="true" />{stato}</p>}
        {err && !mod && <p className="error">{err}</p>}
        <button className="btn ghost block" disabled={busy} onClick={aggiornaTutti}>{busy && !mod ? 'Aggiorno…' : 'Aggiorna il chatbot con tutti i manuali'}</button>
        <p className="hint">Serve solo se hai cambiato i PDF fuori dall’app: quando aggiungi o sostituisci un manuale da qui, il chatbot si aggiorna da solo.</p>
      </section>

      <section>
        <h2 className="section-title">Biblioteca</h2>
        <div className="libri">
          {list.map((m, i) => (
            <div key={m.id} className={`libro-staff${m.nascosto ? ' nascosto' : ''}`}>
              <Libro m={m} i={i}>
                <span className="libro-tag">
                  {m.soloStaff && <em className="tag-x nasc">Solo staff</em>}
                  {m.nascosto && <em className="tag-x nasc">Nascosto</em>}
                  <em className="tag-x">{m.filePath ? 'Caricato dallo staff' : 'Di base'}</em>
                  {stats && !m.nascosto && !m.soloStaff && (stats[m.id]
                    ? <em className="tag-x ok">Chatbot ✓</em>
                    : <em className="tag-x warn">Chatbot: da leggere</em>)}
                </span>
              </Libro>
              <div className="libro-azioni">
                <button className="btn ghost" onClick={() => setApri(m)}>Apri</button>
                <button className="btn ghost" disabled={busy} onClick={() => { setErr(''); setFile(null); setMod(m); }}>Modifica</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {mod && (
        <BottomSheet onClose={chiudi} label={mod.id ? `Modifica ${mod.nome}` : 'Nuovo manuale'}>
          <h2>{mod.id ? 'Modifica manuale' : 'Nuovo manuale'}</h2>
          <div className="form man-form">
            <label className={`file-drop${file ? ' scelto' : ''}`}>
              <input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" /></svg>
              <span>
                <strong>{file ? file.name : mod.id ? 'Sostituisci il PDF' : 'Scegli il file PDF'}</strong>
                <small>{file ? `${(file.size / 1048576).toFixed(1)} MB, pronto da caricare` : mod.id ? 'Facoltativo: lascia vuoto per tenere quello attuale' : 'Tocca per scegliere dal telefono o dal computer'}</small>
              </span>
            </label>
            <div className="field"><label htmlFor="man-nome">Nome</label><input id="man-nome" value={mod.nome} onChange={(e) => setMod({ ...mod, nome: e.target.value })} placeholder="Es. FAQ del regolamento" /></div>
            <div className="field"><label htmlFor="man-desc">Descrizione</label><input id="man-desc" value={mod.descrizione} onChange={(e) => setMod({ ...mod, descrizione: e.target.value })} placeholder="Es. Domande frequenti e chiarimenti" /></div>
            <div className="grid2">
              <div className="field"><label htmlFor="man-sigla">Sigla sul dorso</label><input id="man-sigla" maxLength={2} value={mod.sigla} onChange={(e) => setMod({ ...mod, sigla: e.target.value })} placeholder="Es. F" /></div>
              <div className="field"><label htmlFor="man-ord">Posizione</label><input id="man-ord" type="number" value={mod.ordine} onChange={(e) => setMod({ ...mod, ordine: Number(e.target.value) || 0 })} /></div>
            </div>
            <label className="check"><input type="checkbox" checked={mod.nascosto} onChange={(e) => setMod({ ...mod, nascosto: e.target.checked })} /><span>Nascosto ai giocatori (anche il chatbot smette di usarlo)</span></label>
            {!mod.base && <label className="check"><input type="checkbox" checked={!!mod.soloStaff} onChange={(e) => setMod({ ...mod, soloStaff: e.target.checked })} /><span>Riservato allo staff (es. le Leggi): i giocatori non lo vedono e non possono aprirlo, il chatbot non lo usa</span></label>}
            {stato && <p className="bot-progresso" role="status"><span className="spinner" aria-hidden="true" />{stato}</p>}
            {err && <p className="error">{err}</p>}
            <div className="sheet-actions">
              <button type="button" className="btn ghost" disabled={busy} onClick={chiudi}>Annulla</button>
              <button type="button" className="btn primary" disabled={busy} onClick={salva}>{busy ? 'Attendi…' : 'Salva'}</button>
            </div>
            {mod.id && !mod.base && (
              <button type="button" className="btn ghost block danger-text" disabled={busy} onClick={() => esegui(async () => {
                await api.deleteManual(mod); setMod(null); onToast('Manuale eliminato'); await ricarica();
              })}>Elimina manuale</button>
            )}
          </div>
        </BottomSheet>
      )}
      {apri && <ApriManuale m={apri} onClose={() => setApri(null)} />}
    </div>
  );
}
