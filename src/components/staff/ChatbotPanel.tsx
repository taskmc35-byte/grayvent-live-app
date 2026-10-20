import { useEffect, useState } from 'react';
import { api } from '../../api';
import { MANUALI } from '../ManualiTab';

/** Staff: carica i testi dei manuali nel chatbot (da rifare quando un manuale cambia o se ne aggiunge uno) */
export function ChatbotPanel({ onToast }: { onToast: (t: string) => void }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [stato, setStato] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const files = MANUALI.map((m) => m.file);
  const ricarica = () => api.manualIndexStats(files).then(setStats).catch(() => setStats({}));
  useEffect(() => { ricarica(); }, []);

  const aggiorna = async () => {
    setBusy(true); setErr('');
    try {
      const { estraiParti } = await import('../../manuali/indicizza');
      let tot = 0;
      for (const [i, m] of MANUALI.entries()) {
        setStato(`Leggo ${m.nome} (${i + 1} di ${MANUALI.length})…`);
        const parti = await estraiParti(m.file, m.nome, (n, t) => setStato(`Leggo ${m.nome}: pagina ${n} di ${t}`));
        setStato(`Salvo ${m.nome}…`);
        await api.indexManual(m.file, parti);
        tot += parti.length;
      }
      setStato(''); onToast(`Chatbot aggiornato: ${tot} passaggi`); await ricarica();
    } catch (e) {
      setErr((e as Error).message); setStato('');
    } finally { setBusy(false); }
  };

  const vuoto = stats !== null && files.every((f) => !stats[f]);
  return (
    <section className="panel chatbot-panel">
      <h2 className="section-title">Chatbot dei manuali</h2>
      <p className="hint">Il chatbot risponde usando il testo dei manuali. Premi il pulsante la prima volta e ogni volta che un manuale viene aggiornato o aggiunto.</p>
      {stats && !vuoto && (
        <ul className="idx-list">
          {MANUALI.map((m) => <li key={m.file}><span>{m.nome}</span><b>{stats[m.file] ? `${stats[m.file]} passaggi` : 'non caricato'}</b></li>)}
        </ul>
      )}
      {vuoto && <p className="notice">I manuali non sono ancora stati caricati nel chatbot.</p>}
      {stato && <p className="hint" role="status">{stato}</p>}
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" disabled={busy} onClick={aggiorna}>{busy ? 'Aggiorno…' : 'Aggiorna il chatbot'}</button>
    </section>
  );
}
