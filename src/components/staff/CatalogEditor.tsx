import { useState } from 'react';
import type { Ability, ArmorType, Categoria, ViaPotere } from '../../data/types';
import { ALL_ABILITIES } from '../../data/abilities';
import { ARMOR, POWER_TABLE } from '../../rules';
import { BottomSheet } from '../Sheet';

const CAT: { id: Categoria; nome: string }[] = [
  { id: 'fisico', nome: 'Fisiche e di combattimento' }, { id: 'mentale', nome: 'Mentali e di conoscenza' }, { id: 'sovrannaturale', nome: 'Sovrannaturali' },
];
const LIVELLI = ['Minore', 'Maggiore', 'Estremo', 'Assoluto'];
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function CatalogEditor({ catalog, onSave, onDelete }: {
  catalog: Ability[]; onSave: (a: Ability) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState<Ability | null>(null);
  const [q, setQ] = useState('');
  const f = q.trim().toLowerCase();
  const original = new Map(ALL_ABILITIES.map((a) => [a.id, a]));

  return (
    <div className="page">
      <div className="list-head">
        <h1>Catalogo abilità</h1>
        <button className="btn primary" onClick={() => setEdit({ id: '', nome: '', categoria: 'fisico', tipo: 'avanzata', descrizione: '', pc: null, tda: null })}>Nuova abilità</button>
      </div>
      <p className="hint">Qui si aggiungono le abilità avanzate delle professioni. Gli effetti che indichi (PF, armature, Punti Potere) entrano nei calcoli di tutte le schede.</p>
      <input className="search" type="search" placeholder="Cerca" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca abilità" />
      {CAT.map((c) => {
        const list = catalog.filter((a) => a.categoria === c.id && (!f || a.nome.toLowerCase().includes(f)));
        if (!list.length) return null;
        return (
          <div key={c.id}>
            <h3 className="group-title">{c.nome}</h3>
            {list.map((a) => (
              <button key={a.id} className="row-btn" onClick={() => setEdit(a)}>
                <span>{a.nome}{a.tipo === 'avanzata' && <em> avanzata</em>}</span>
                <small>{[a.pc != null ? `${a.pc} PC` : null, a.tda != null ? `TdA ${a.tda}` : 'TdA da inserire'].filter(Boolean).join(', ')}</small>
              </button>
            ))}
          </div>
        );
      })}
      {edit && (
        <AbilityForm
          a={edit}
          isBase={original.has(edit.id)}
          modified={original.has(edit.id) && JSON.stringify(original.get(edit.id)) !== JSON.stringify(edit)}
          taken={new Set(catalog.map((x) => x.id))}
          onClose={() => setEdit(null)}
          onSave={async (a) => { await onSave(a); setEdit(null); }}
          onDelete={async (id) => { await onDelete(id); setEdit(null); }}
        />
      )}
    </div>
  );
}

function AbilityForm({ a: init, isBase, modified, taken, onClose, onSave, onDelete }: {
  a: Ability; isBase: boolean; modified: boolean; taken: Set<string>;
  onClose: () => void; onSave: (a: Ability) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const [a, setA] = useState<Ability>(init);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const eff = a.effetti ?? {};
  const setEff = (v: Ability['effetti']) => setA({ ...a, effetti: { ...eff, ...v } });

  const save = async () => {
    if (!a.nome.trim()) { setErr('Il nome è obbligatorio.'); return; }
    let id = a.id || slug(a.nome);
    if (!a.id) { let n = 2; while (taken.has(id)) id = `${slug(a.nome)}-${n++}`; }
    // pulisci gli effetti vuoti
    const e = { ...eff };
    (Object.keys(e) as (keyof typeof e)[]).forEach((k) => { if (!e[k]) delete e[k]; });
    setBusy(true);
    try { await onSave({ ...a, id, nome: a.nome.trim(), effetti: Object.keys(e).length ? e : undefined }); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <BottomSheet onClose={onClose} label="Abilità">
      <h2>{init.id ? init.nome : 'Nuova abilità'}</h2>
      {err && <p className="error">{err}</p>}
      <div className="field"><label htmlFor="ab-nome">Nome</label><input id="ab-nome" value={a.nome} onChange={(e) => setA({ ...a, nome: e.target.value })} /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="ab-cat">Categoria (slot)</label>
          <select id="ab-cat" value={a.categoria} onChange={(e) => setA({ ...a, categoria: e.target.value as Categoria })}>
            <option value="fisico">Fisico</option><option value="mentale">Mentale</option><option value="sovrannaturale">Sovrannaturale</option>
          </select>
        </div>
        <div className="field"><label htmlFor="ab-tipo">Tipo</label>
          <select id="ab-tipo" value={a.tipo} onChange={(e) => setA({ ...a, tipo: e.target.value as Ability['tipo'] })}>
            <option value="base">Base</option><option value="avanzata">Avanzata</option>
          </select>
        </div>
        <div className="field"><label htmlFor="ab-pc">PC</label><input id="ab-pc" type="number" min={0} value={a.pc ?? ''} onChange={(e) => setA({ ...a, pc: e.target.value === '' ? null : Number(e.target.value) })} /></div>
        <div className="field"><label htmlFor="ab-tda">TdA (eventi)</label><input id="ab-tda" type="number" min={0} value={a.tda ?? ''} onChange={(e) => setA({ ...a, tda: e.target.value === '' ? null : Number(e.target.value) })} /></div>
      </div>
      <div className="field"><label htmlFor="ab-pre">Prerequisiti</label><input id="ab-pre" value={a.prerequisiti ?? ''} onChange={(e) => setA({ ...a, prerequisiti: e.target.value || undefined })} placeholder="Nomi delle abilità separati da virgola" /></div>
      <div className="field"><label htmlFor="ab-desc">Descrizione</label><textarea id="ab-desc" rows={5} value={a.descrizione} onChange={(e) => setA({ ...a, descrizione: e.target.value })} /></div>

      <fieldset className="fs">
        <legend>Effetti sui calcoli</legend>
        <div className="grid2">
          <div className="field"><label htmlFor="ab-pf">PF in più per locazione</label><input id="ab-pf" type="number" min={0} value={eff.pf ?? ''} onChange={(e) => setEff({ pf: e.target.value ? Number(e.target.value) : undefined })} /></div>
          <div className="field"><label htmlFor="ab-arm">Permette l’armatura</label>
            <select id="ab-arm" value={eff.armatura ?? ''} onChange={(e) => setEff({ armatura: (e.target.value || undefined) as ArmorType | undefined })}>
              <option value="">Nessuna</option>
              {(['cuoio', 'cuoioLavorato', 'anelli', 'piastre'] as ArmorType[]).map((t) => <option key={t} value={t}>{ARMOR[t].nome}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="ab-via">Potere sovrannaturale</label>
            <select id="ab-via" value={eff.potere?.via ?? ''} onChange={(e) => setEff({ potere: e.target.value ? { via: e.target.value as ViaPotere, livello: eff.potere?.livello ?? 1 } : undefined })}>
              <option value="">Nessuno</option>
              {(Object.keys(POWER_TABLE) as ViaPotere[]).map((v) => <option key={v} value={v}>{POWER_TABLE[v].nome}</option>)}
            </select>
          </div>
          {eff.potere && (
            <div className="field"><label htmlFor="ab-liv">Livello</label>
              <select id="ab-liv" value={eff.potere.livello} onChange={(e) => setEff({ potere: { ...eff.potere!, livello: Number(e.target.value) as 1 | 2 | 3 | 4 } })}>
                {LIVELLI.slice(0, POWER_TABLE[eff.potere.via].valori.length).map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
              </select>
            </div>
          )}
        </div>
        <label className="check"><input type="checkbox" checked={!!eff.completa} onChange={(e) => setEff({ completa: e.target.checked || undefined })} /><span>Funziona come Armatura Completa (+1 PA in tutte le locazioni se l’armatura copre l’80% del corpo)</span></label>
      </fieldset>

      <div className="sheet-actions">
        {init.id && (isBase ? modified && <button className="btn ghost" onClick={() => onDelete(init.id)}>Ripristina dal manuale</button>
          : <button className="btn ghost" onClick={() => onDelete(init.id)}>Elimina</button>)}
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</button>
      </div>
    </BottomSheet>
  );
}
