import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Nota } from '../data/types';
import { dataOra } from './MissiveTab';

const CATEGORIE = ['Oggetti', 'Lettere', 'Personaggi', 'Luoghi', 'Indizi', 'Altro'];

export function TaccuinoTab({ onToast }: { onToast: (t: string) => void }) {
  const [note, setNote] = useState<Nota[] | null>(null);
  const [edit, setEdit] = useState<Nota | null>(null);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const reload = async () => setNote(await api.notes());
  useEffect(() => { reload().catch(() => setNote([])); }, []);

  if (edit) return <Editor n={edit} onCancel={() => setEdit(null)}
    onSave={async (n) => { await api.saveNote(n); await reload(); setEdit(null); onToast('Nota salvata'); }}
    onDelete={async (id) => { await api.deleteNote(id); await reload(); setEdit(null); onToast('Nota eliminata'); }} />;

  const f = q.trim().toLowerCase();
  const vis = (note ?? []).filter((n) => (!cat || n.categoria === cat) && (!f || `${n.titolo} ${n.testo}`.toLowerCase().includes(f)));

  return (
    <div className="page">
      <div className="list-head">
        <h1>Taccuino</h1>
        <button className="btn primary" onClick={() => setEdit({ id: '', titolo: '', testo: '', categoria: cat || 'Altro', aggiornata: '' })}>Nuova nota</button>
      </div>
      <p className="hint">Appunti tuoi: oggetti, lettere ricevute, nomi da ricordare. Li vedi solo tu.</p>
      {(note?.length ?? 0) > 0 && (
        <>
          <input className="search" type="search" placeholder="Cerca nelle note" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca nelle note" />
          <div className="chips">
            <button className={`chip${!cat ? ' on' : ''}`} aria-pressed={!cat} onClick={() => setCat('')}>Tutte</button>
            {CATEGORIE.map((c) => <button key={c} className={`chip${cat === c ? ' on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        </>
      )}
      {note?.length === 0 && <p className="hint">Il taccuino è vuoto. Aggiungi la prima nota con “Nuova nota”.</p>}
      <div className="note-list">
        {vis.map((n) => (
          <button key={n.id} className="note-card" onClick={() => setEdit(n)}>
            <span className="tag">{n.categoria}, {dataOra(n.aggiornata)}</span>
            <strong>{n.titolo || 'Senza titolo'}</strong>
            <span className="note-prev">{n.testo}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Editor({ n: init, onCancel, onSave, onDelete }: { n: Nota; onCancel: () => void; onSave: (n: Nota) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [n, setN] = useState(init);
  const [conferma, setConferma] = useState(false);
  return (
    <form className="page form" onSubmit={(e) => { e.preventDefault(); onSave(n); }}>
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={onCancel}>Torna al taccuino</button>
      <div className="field"><label htmlFor="n-tit">Titolo</label><input id="n-tit" value={n.titolo} onChange={(e) => setN({ ...n, titolo: e.target.value })} /></div>
      <div className="field"><label htmlFor="n-cat">Categoria</label>
        <select id="n-cat" value={n.categoria} onChange={(e) => setN({ ...n, categoria: e.target.value })}>{CATEGORIE.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="field"><label htmlFor="n-txt">Testo</label><textarea id="n-txt" rows={12} value={n.testo} onChange={(e) => setN({ ...n, testo: e.target.value })} /></div>
      <button className="btn primary block">Salva nota</button>
      {init.id && (conferma
        ? <div className="sheet-actions"><button type="button" className="btn ghost" onClick={() => setConferma(false)}>Annulla</button><button type="button" className="btn danger" onClick={() => onDelete(init.id)}>Elimina davvero</button></div>
        : <button type="button" className="btn ghost block" onClick={() => setConferma(true)}>Elimina nota</button>)}
    </form>
  );
}
