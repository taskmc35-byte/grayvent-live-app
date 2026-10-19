import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type StaffCharacter, type User } from './api';
import type { Ability, Character } from './data/types';
import { RACES, raceById, raceLabel } from './data/races';
import spellsJson from './data/spells.json';
import type { Spell } from './data/types';
import { compute } from './rules';
import { Login } from './components/Login';
import { PersonaggioTab, SchedaTab } from './components/SchedaTab';
import { AbilitaTab } from './components/AbilitaTab';
import { PoteriTab } from './components/PoteriTab';
import { ManualiTab } from './components/ManualiTab';
import { StaffApp } from './components/staff/StaffApp';
import { CreaPersonaggio, nuovaScheda } from './components/CreaPersonaggio';
import { EventiTab } from './components/EventiTab';
import { MissiveTab } from './components/MissiveTab';
import { TaccuinoTab } from './components/TaccuinoTab';

const SPELLS = spellsJson as Spell[];
type Tab = 'scheda' | 'eventi' | 'missive' | 'taccuino' | 'manuali';
type Sub = 'scheda' | 'personaggio' | 'abilita' | 'poteri';

const ICONS: Record<Tab, JSX.Element> = {
  scheda: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="5" r="2.5" /><path d="M8 9h8l1 7h-3v6h-4v-6H7z" /></svg>,
  eventi: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  missive: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16v12H4z" /><path d="M4 6l8 7 8-7" /><circle cx="12" cy="15.5" r="1.6" /></svg>,
  taccuino: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h11a2 2 0 012 2v16H8a2 2 0 01-2-2z" /><path d="M6 3v16M10 8h6M10 12h6" /></svg>,
  manuali: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7" /></svg>,
};
const TABS: { id: Tab; nome: string }[] = [
  { id: 'scheda', nome: 'Scheda' }, { id: 'eventi', nome: 'Eventi' }, { id: 'missive', nome: 'Missive' }, { id: 'taccuino', nome: 'Taccuino' }, { id: 'manuali', nome: 'Manuali' },
];

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [pgs, setPgs] = useState<StaffCharacter[]>([]);
  const [catalog, setCatalog] = useState<Ability[]>([]);
  const [tab, setTab] = useState<Tab>('scheda');
  const [sub, setSub] = useState<Sub>('scheda');
  const [crea, setCrea] = useState<Character | null>(null);
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    const u = await api.currentUser();
    setUser(u);
    if (!u) return;
    try {
      const [c, cat] = await Promise.all([api.myCharacters(), api.catalog()]);
      setPgs(c); setCatalog(cat); setLoadError('');
    } catch (e) { setLoadError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); } }, [toast]);

  const approvati = pgs.filter((p) => !p.stato || p.stato === 'approvato');
  const pg = approvati[0];
  const inAttesa = pgs.find((p) => p.stato === 'in_approvazione' || p.stato === 'da_rivedere');
  const calc = useMemo(() => (pg && catalog.length ? compute(pg, catalog, RACES) : null), [pg, catalog]);

  if (user === undefined) return <div className="center">Caricamento…</div>;
  if (!user) return <Login onLogin={load} />;
  if (user.ruolo === 'staff') return (
    <>
      <StaffApp user={user} spells={SPELLS} onToast={setToast} onLogout={async () => { await api.signOut(); setUser(null); }} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );

  const saveEq = async (eq: Character['equipaggiamento']) => {
    if (!pg) return;
    try {
      await api.saveEquipment(pg.id, eq);
      setPgs((list) => list.map((c) => (c.id === pg.id ? { ...c, equipaggiamento: eq } : c)));
      setToast('Equipaggiamento salvato');
    } catch (e) { setToast(`Non salvato: ${(e as Error).message}`); }
  };
  const logout = async () => { await api.signOut(); setPgs([]); setTab('scheda'); setSub('scheda'); setCrea(null); setUser(null); };
  const go = (t: Tab) => { setTab(t); setCrea(null); window.scrollTo(0, 0); };

  const hasPoteri = !!pg && (pg.incantesimi.length > 0 || (calc?.potere.length ?? 0) > 0);
  const activeSub: Sub = sub === 'poteri' && !hasPoteri ? 'scheda' : sub;

  let schedaView: JSX.Element;
  if (crea) {
    schedaView = <CreaPersonaggio initial={crea} catalog={catalog} notaStaff={inAttesa?.id === crea.id ? inAttesa?.notaStaff : undefined}
      onCancel={() => setCrea(null)}
      onSubmit={async (c, file) => { await api.submitCharacter(c, file); await load(); setCrea(null); setToast('Scheda inviata ai Master'); window.scrollTo(0, 0); }} />;
  } else if (pg && calc) {
    schedaView = (
      <>
        <div className="subnav-wrap">
          <div className="seg subnav" role="tablist" aria-label="Scheda">
            <button role="tab" aria-selected={activeSub === 'scheda'} onClick={() => setSub('scheda')}>Scheda</button>
            <button role="tab" aria-selected={activeSub === 'personaggio'} onClick={() => setSub('personaggio')}>Personaggio</button>
            <button role="tab" aria-selected={activeSub === 'abilita'} onClick={() => setSub('abilita')}>Abilità</button>
            {hasPoteri && <button role="tab" aria-selected={activeSub === 'poteri'} onClick={() => setSub('poteri')}>Poteri</button>}
          </div>
        </div>
        {inAttesa && <div className="page" style={{ paddingBottom: 0 }}><StatoCard c={inAttesa} onEdit={() => setCrea(inAttesa)} compatto /></div>}
        {activeSub === 'scheda' && <SchedaTab pg={pg} calc={calc} races={RACES} catalog={catalog} onSaveEq={saveEq} onPoteri={hasPoteri ? () => setSub('poteri') : undefined} />}
        {activeSub === 'personaggio' && <PersonaggioTab pg={pg} races={RACES} />}
        {activeSub === 'abilita' && <AbilitaTab pg={pg} catalog={catalog} />}
        {activeSub === 'poteri' && <PoteriTab pg={pg} calc={calc} spells={SPELLS} />}
      </>
    );
  } else if (inAttesa) {
    schedaView = <div className="page"><StatoCard c={inAttesa} onEdit={() => setCrea(inAttesa)} /></div>;
  } else {
    schedaView = (
      <div className="page">
        <div className="welcome">
          <h1>Benvenuto tra i Fyrd{user.nome ? `, ${user.nome.split(' ')[0]}` : ''}</h1>
          <p>Non hai ancora un personaggio. Crealo qui con i 25 Punti Creazione e le abilità di base: i Master lo controllano e lo approvano prima del tuo primo evento.</p>
          <button className="btn primary" onClick={() => setCrea(nuovaScheda())}>Crea il tuo personaggio</button>
          <p className="hint">Hai già giocato a Grayvent? La tua scheda la collega lo staff al tuo account: non serve ricrearla.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {api.demo && <p className="demo-banner">Versione di prova con personaggi di esempio. <button className="link" onClick={logout}>Cambia utente</button></p>}
      {loadError && <div className="page"><div className="notice">Non riesco a caricare la scheda: {loadError}</div></div>}
      <div key={`${tab}-${sub}-${crea ? 'c' : ''}`} className="view">
        {tab === 'scheda' && schedaView}
        {tab === 'eventi' && <EventiTab user={user} pg={pg ?? inAttesa} onToast={setToast} />}
        {tab === 'missive' && <MissiveTab pgs={approvati} onToast={setToast} />}
        {tab === 'taccuino' && <TaccuinoTab onToast={setToast} />}
        {tab === 'manuali' && <ManualiTab />}
      </div>
      {!api.demo && tab === 'scheda' && !crea && (
        <div className="page" style={{ paddingTop: 0 }}>
          <PasswordForm onDone={() => setToast('Password salvata')} />
          <button className="btn ghost block" onClick={logout}>Esci</button>
        </div>
      )}

      <nav className="tabbar" aria-label="Sezioni">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              {ICONS[t.id]}<span>{t.nome}</span>
            </button>
          ))}
        </div>
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function StatoCard({ c, onEdit, compatto }: { c: Character; onEdit: () => void; compatto?: boolean }) {
  const rivedere = c.stato === 'da_rivedere';
  return (
    <section className={`stato-card ${rivedere ? 'rev' : 'wait'}`}>
      <span className={`pill ${rivedere ? 'warn' : 'wait'}`}>{rivedere ? 'Da rivedere' : 'In approvazione'}</span>
      <h2>{c.nome} {c.cognome}</h2>
      {!compatto && <p className="hint">{raceLabel(raceById(c.razza))}{c.provenienza && !raceLabel(raceById(c.razza)).includes(c.provenienza) ? `, ${c.provenienza}` : ''}</p>}
      {rivedere
        ? <p>I Master chiedono qualche modifica prima di approvare la scheda.{c.notaStaff ? '' : ' Controlla le loro indicazioni via email.'}</p>
        : <p>La scheda è stata inviata. I Master la controllano e la approvano prima del prossimo evento.</p>}
      {rivedere && c.notaStaff && <blockquote className="staff-note">{c.notaStaff}</blockquote>}
      <button className={`btn ${rivedere ? 'primary' : 'ghost'}`} onClick={onEdit}>{rivedere ? 'Modifica e reinvia' : 'Modifica la scheda inviata'}</button>
    </section>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  if (!open) return <button className="link" onClick={() => setOpen(true)}>Cambia la password</button>;
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      if (pw.length < 8) { setErr('Usa almeno 8 caratteri.'); return; }
      try { await api.setPassword(pw); setOpen(false); setPw(''); onDone(); } catch (x) { setErr((x as Error).message); }
    }}>
      <div className="field"><label htmlFor="newpw">Nuova password</label><input id="newpw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      {err && <p className="error">{err}</p>}
      <button className="btn primary">Salva password</button>
    </form>
  );
}
