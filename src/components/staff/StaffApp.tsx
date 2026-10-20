import { useCallback, useEffect, useState } from 'react';
import { api, type Profile, type StaffCharacter, type User } from '../../api';
import type { Ability, Spell } from '../../data/types';
import { raceById, raceLabel } from '../../data/races';
import { CharacterEditor, emptyCharacter } from './CharacterEditor';
import { CatalogEditor } from './CatalogEditor';
import { ManualiTab } from '../ManualiTab';
import { ChatbotPanel } from './ChatbotPanel';
import { ChatPopup } from '../ChatPopup';
import { StaffEventi } from './StaffEventi';
import { ImpostazioniMissive, StaffMissive } from './StaffMissive';
import { Seal } from '../Seal';

type Tab = 'personaggi' | 'eventi' | 'missive' | 'altro';
type Altro = 'abilita' | 'account' | 'impostazioni' | 'manuali';
type Lista = 'approvare' | 'gioco' | 'archivio';
const ICONS: Record<Tab, JSX.Element> = {
  personaggi: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4a3 3 0 010 6M18 14c2 .8 3 3 3 6" /></svg>,
  eventi: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  missive: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16v12H4z" /><path d="M4 6l8 7 8-7" /><circle cx="12" cy="15.5" r="1.6" /></svg>,
  altro: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>,
};

export function StaffApp({ user, spells, onLogout, onToast }: { user: User; spells: Spell[]; onLogout: () => void; onToast: (t: string) => void }) {
  const [tab, setTab] = useState<Tab>('personaggi');
  const [altro, setAltro] = useState<Altro>('abilita');
  const [pgs, setPgs] = useState<StaffCharacter[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [catalog, setCatalog] = useState<Ability[]>([]);
  const [editing, setEditing] = useState<StaffCharacter | null>(null);
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<Lista | null>(null);
  const [nuoveMissive, setNuoveMissive] = useState(0);
  const [err, setErr] = useState('');
  const [sigillo, setSigillo] = useState('');

  const reload = useCallback(async () => {
    try {
      const [a, b, c, m, q] = await Promise.all([api.allCharacters(), api.profiles(), api.catalog(), api.allLetters(), api.allQuestions().catch(() => [])]);
      setPgs(a); setProfiles(b); setCatalog(c); setNuoveMissive(m.filter((x) => x.stato === 'inviata').length + q.filter((x) => x.stato === 'aperta').length); setErr('');
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const go = (t: Tab) => { setTab(t); setEditing(null); window.scrollTo(0, 0); };
  const f = q.trim().toLowerCase();
  const owner = (id: string | null) => profiles.find((p) => p.id === id);
  const daApprovare = pgs.filter((c) => c.stato === 'in_approvazione');
  const daRivedere = pgs.filter((c) => c.stato === 'da_rivedere');
  const curLista: Lista = lista ?? (daApprovare.length ? 'approvare' : 'gioco');
  const visible = pgs
    .filter((c) => curLista === 'approvare' ? c.stato === 'in_approvazione' || c.stato === 'da_rivedere'
      : (!c.stato || c.stato === 'approvato') && c.attivo === (curLista === 'gioco'))
    .filter((c) => !f || `${c.nome} ${c.cognome} ${owner(c.proprietario)?.nome ?? ''} ${owner(c.proprietario)?.email ?? ''}`.toLowerCase().includes(f))
    .sort((a, b) => curLista === 'approvare' ? (a.aggiornato ?? '').localeCompare(b.aggiornato ?? '') : a.nome.localeCompare(b.nome));

  return (
    <div className="app">
      {api.demo && <p className="demo-banner">Pannello staff di prova: le modifiche restano solo su questo dispositivo. <button className="link" onClick={onLogout}>Cambia utente</button></p>}
      {err && <div className="page"><div className="notice">Errore di caricamento: {err}</div></div>}
      {sigillo && <Seal label={sigillo} onDone={() => setSigillo('')} />}

      <div key={`${tab}-${altro}-${editing ? editing.id || 'nuovo' : ''}`} className="view">
      {tab === 'personaggi' && editing && (
        <CharacterEditor
          key={editing.id || 'nuovo'}
          initial={editing} catalog={catalog} spells={spells} profiles={profiles}
          onCancel={() => { setEditing(null); window.scrollTo(0, 0); }}
          onSave={async (c) => {
            await api.saveCharacter(c); await reload(); setEditing(null);
            if (c.stato === 'approvato' && editing.stato !== 'approvato' && editing.id) setSigillo('Scheda approvata');
            else onToast(c.stato === 'da_rivedere' && editing.stato !== 'da_rivedere' ? 'Scheda rimandata al giocatore' : 'Scheda salvata');
            window.scrollTo(0, 0);
          }}
        />
      )}

      {tab === 'personaggi' && !editing && (
        <div className="page">
          <div className="list-head">
            <h1>Personaggi</h1>
            <button className="btn primary" onClick={() => setEditing(emptyCharacter())}>Nuova scheda</button>
          </div>
          <input className="search" type="search" placeholder="Cerca per personaggio o giocatore" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca personaggi" />
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={curLista === 'approvare'} onClick={() => setLista('approvare')}>Da approvare ({daApprovare.length + daRivedere.length})</button>
            <button role="tab" aria-selected={curLista === 'gioco'} onClick={() => setLista('gioco')}>In gioco</button>
            <button role="tab" aria-selected={curLista === 'archivio'} onClick={() => setLista('archivio')}>Archivio</button>
          </div>
          <div>
            {visible.map((c) => (
              <button key={c.id} className="row-btn" onClick={() => setEditing(c)}>
                <span>{c.nome} {c.cognome}{c.stato === 'in_approvazione' && <em> da approvare</em>}{c.stato === 'da_rivedere' && <em> rimandata al giocatore</em>}</span>
                <small>{raceLabel(raceById(c.razza))}, {owner(c.proprietario)?.nome ?? <b className="bad">nessun account</b>}</small>
              </button>
            ))}
            {!visible.length && <p className="hint">{f ? 'Nessun personaggio trovato.' : curLista === 'approvare' ? 'Nessuna scheda in attesa di approvazione.' : curLista === 'archivio' ? 'L’archivio è vuoto.' : 'Ancora nessuna scheda. Crea la prima con “Nuova scheda”.'}</p>}
          </div>
        </div>
      )}

      {tab === 'eventi' && <StaffEventi profiles={profiles} onToast={onToast} />}
      {tab === 'missive' && <StaffMissive onToast={onToast} onCount={setNuoveMissive} />}

      {tab === 'altro' && (
        <>
          <div className="subnav-wrap">
            <div className="seg subnav" role="tablist" aria-label="Altro">
              <button role="tab" aria-selected={altro === 'abilita'} onClick={() => setAltro('abilita')}>Abilità</button>
              <button role="tab" aria-selected={altro === 'account'} onClick={() => setAltro('account')}>Account</button>
              <button role="tab" aria-selected={altro === 'impostazioni'} onClick={() => setAltro('impostazioni')}>Missive</button>
              <button role="tab" aria-selected={altro === 'manuali'} onClick={() => setAltro('manuali')}>Manuali</button>
            </div>
          </div>
          {altro === 'abilita' && (
            <CatalogEditor
              catalog={catalog}
              onSave={async (a) => { await api.saveAbility(a); await reload(); onToast('Abilità salvata'); }}
              onDelete={async (id) => { await api.deleteAbility(id); await reload(); onToast('Fatto'); }}
            />
          )}
          {altro === 'account' && <Accounts me={user} profiles={profiles} pgs={pgs} onChange={reload} onToast={onToast} onLogout={onLogout} />}
          {altro === 'impostazioni' && <div className="page"><h1>Tipi di missiva</h1><ImpostazioniMissive onToast={onToast} /></div>}
          {altro === 'manuali' && <><div className="page" style={{ paddingBottom: 0 }}><ChatbotPanel onToast={onToast} /></div><ManualiTab /></>}
        </>
      )}

      </div>
      <ChatPopup />
      <nav className="tabbar" aria-label="Sezioni staff">
        <div className="tabbar-inner">
          {(['personaggi', 'eventi', 'missive', 'altro'] as Tab[]).map((t) => {
            const badge = t === 'personaggi' ? daApprovare.length : t === 'missive' ? nuoveMissive : 0;
            return (
              <button key={t} className="tab" aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
                <span className="tab-ico">{ICONS[t]}{badge > 0 && <span className="badge-dot" aria-label={`${badge} nuove`}>{badge}</span>}</span>
                <span>{{ personaggi: 'Personaggi', eventi: 'Eventi', missive: 'Missive', altro: 'Altro' }[t]}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Accounts({ me, profiles, pgs, onChange, onToast, onLogout }: {
  me: User; profiles: Profile[]; pgs: StaffCharacter[]; onChange: () => Promise<void>; onToast: (t: string) => void; onLogout: () => void;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await api.invite(email.trim().toLowerCase(), nome.trim()); setNome(''); setEmail(''); await onChange(); onToast(api.demo ? 'Account creato' : 'Invito inviato'); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <h1>Account</h1>
      <form className="form fs" onSubmit={invite}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Invita un giocatore</h2>
        <p className="hint">Il giocatore riceve un’email con il link per entrare. Poi colleghi la sua scheda dalla sezione Personaggi.</p>
        <div className="field"><label htmlFor="inv-nome">Nome e cognome del giocatore</label><input id="inv-nome" required value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="field"><label htmlFor="inv-email">Email</label><input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {err && <p className="error">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Invio…' : 'Manda l’invito'}</button>
      </form>

      <div>
        <h2 className="section-title">Tutti gli account ({profiles.length})</h2>
        {profiles.map((p) => {
          const n = pgs.filter((c) => c.proprietario === p.id && c.attivo).length;
          return (
            <div key={p.id} className="acc-row">
              <div><strong>{p.nome ?? p.email}</strong><small>{p.email}, {n === 0 ? 'nessuna scheda' : n === 1 ? '1 scheda' : `${n} schede`}</small></div>
              <select aria-label={`Ruolo di ${p.nome ?? p.email}`} value={p.ruolo} disabled={p.id === me.id}
                onChange={async (e) => { await api.setRole(p.id, e.target.value as Profile['ruolo']); await onChange(); onToast('Ruolo aggiornato'); }}>
                <option value="giocatore">Giocatore</option><option value="staff">Staff</option>
              </select>
            </div>
          );
        })}
      </div>
      <button className="btn ghost block" onClick={onLogout}>Esci</button>
    </div>
  );
}

