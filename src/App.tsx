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
import { AvvisoScelta, SceltaIncantesimi } from './components/SceltaIncantesimi';
import { scelteDovute } from './scelte';
import { ChatPopup } from './components/ChatPopup';
import { ManualiTab } from './components/ManualiTab';
import { StaffApp } from './components/staff/StaffApp';
import { CreaPersonaggio, nuovaScheda } from './components/CreaPersonaggio';
import { EventiTab } from './components/EventiTab';
import { MissiveTab, daLeggere } from './components/MissiveTab';
import { TaccuinoTab } from './components/TaccuinoTab';
import { useIndietro, useIndietroBase } from './indietro';
import { InterruttoreNotifiche, InvitoNotifiche } from './components/NotifichePush';
import { riallineaPush } from './push';
import { Splash } from './components/Splash';

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
    if (u) riallineaPush();
    if (!u) return;
    try {
      const [c, cat] = await Promise.all([api.myCharacters(), api.catalog()]);
      setPgs(c); setCatalog(cat); setLoadError('');
    } catch (e) { setLoadError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); } }, [toast]);

  const approvati = pgs.filter((p) => !p.stato || p.stato === 'approvato');
  // con più personaggi (es. uno staffer che ne ha diversi a suo nome) si sceglie quale vedere; la scelta resta salvata
  const [pgScelto, setPgScelto] = useState<string>(() => { try { return localStorage.getItem('gv-pg-scelto') ?? ''; } catch { return ''; } });
  const scegliPg = (id: string) => { try { localStorage.setItem('gv-pg-scelto', id); } catch { /* niente */ } setPgScelto(id); setSceltaVista(false); };
  const pg = approvati.find((p) => p.id === pgScelto) ?? approvati[0];
  const inAttesa = pgs.find((p) => p.stato === 'in_approvazione' || p.stato === 'da_rivedere');
  const calc = useMemo(() => (pg && catalog.length ? compute(pg, catalog, RACES) : null), [pg, catalog]);
  const dovute = useMemo(() => (pg ? scelteDovute(pg, SPELLS, (id) => catalog.find((a) => a.id === id)?.nome ?? id) : null), [pg, catalog]);
  const daScegliere = !!dovute && dovute.gruppi.length > 0;
  const [sceltaAperta, setSceltaAperta] = useState(false);
  const [impostazioni, setImpostazioni] = useState(false);
  // uno staffer con un proprio personaggio può vedere la sua scheda come la vede un giocatore
  const [vistaGiocatore, setVistaGiocatore] = useState(() => { try { return sessionStorage.getItem('gv-vista-giocatore') === '1'; } catch { return false; } });
  const cambiaVista = (v: boolean) => { try { sessionStorage.setItem('gv-vista-giocatore', v ? '1' : '0'); } catch { /* niente */ } setVistaGiocatore(v); setTab('scheda'); setSub('scheda'); window.scrollTo(0, 0); };
  const pannelloStaff = user?.ruolo === 'staff' && !vistaGiocatore;
  // animazione d'apertura: una volta per sessione; se non c'è nessuno collegato resta come sfondo dell'accesso
  const [aperturaVista, setAperturaVista] = useState(() => { try { return sessionStorage.getItem('gv-splash') === '1'; } catch { return false; } });
  const [aperturaFinita, setAperturaFinita] = useState(aperturaVista);
  const fineApertura = useCallback(() => { try { sessionStorage.setItem('gv-splash', '1'); } catch { /* niente */ } setAperturaFinita(true); }, []);
  const [missiveNuove, setMissiveNuove] = useState(0);
  // puntino rosso su Missive: risposte e lettere dello staff non ancora lette
  const contaMissive = useCallback(() => {
    if (!user || pannelloStaff) return;
    Promise.all([api.myLetters(), api.myStaffLetters()]).then(([a, b]) => setMissiveNuove(daLeggere(a, b))).catch(() => {});
  }, [user, pannelloStaff]);
  useEffect(() => {
    contaMissive();
    const vis = () => { if (document.visibilityState === 'visible') contaMissive(); };
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(contaMissive, 120000); // anche con l'app aperta, ogni due minuti
    return () => { document.removeEventListener('visibilitychange', vis); clearInterval(t); };
  }, [contaMissive]);
  const [sceltaVista, setSceltaVista] = useState(false);
  useIndietroBase(setToast);
  useIndietro(!!user && !pannelloStaff && tab !== 'scheda', () => { setTab('scheda'); window.scrollTo(0, 0); });
  useIndietro(!!user && !pannelloStaff && tab === 'scheda' && sub !== 'scheda' && !crea, () => setSub('scheda'));
  useIndietro(sceltaAperta && daScegliere, () => setSceltaAperta(false));
  useIndietro(impostazioni, () => setImpostazioni(false));
  // la schermata si apre da sola la prima volta che ci sono poteri da scegliere; poi resta l'avviso
  useEffect(() => { if (daScegliere && !sceltaVista && !pannelloStaff) { setSceltaAperta(true); setSceltaVista(true); } }, [daScegliere, sceltaVista, pannelloStaff]);

  const apertura = (user === null || !aperturaFinita) && (
    <Splash key="apertura" resta={user === null} gia={aperturaVista || aperturaFinita} onFine={fineApertura}>
      {user === null && <Login senzaLogo onLogin={async () => { setAperturaVista(true); await load(); }} />}
    </Splash>
  );
  if (user === undefined) return <>{apertura || <div className="center">Caricamento…</div>}</>;
  if (!user) return <>{apertura}</>;
  if (pannelloStaff) return (
    <>
      <StaffApp user={user} spells={SPELLS} onToast={setToast} onLogout={async () => { await api.signOut(); setUser(null); }}
        onMiaScheda={pgs.some((p) => !p.stato || p.stato === 'approvato') ? () => cambiaVista(true) : undefined} />
      {apertura}
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
  const logout = async () => { await api.signOut(); try { sessionStorage.removeItem('gv-vista-giocatore'); } catch { /* niente */ } setVistaGiocatore(false); setPgs([]); setTab('scheda'); setSub('scheda'); setCrea(null); setUser(null); };
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
        {approvati.length > 1 && (
          <div className="scegli-pg">
            <label htmlFor="scegli-pg">Personaggio</label>
            <select id="scegli-pg" value={pg.id} onChange={(e) => { scegliPg(e.target.value); setSub('scheda'); }}>
              {approvati.map((p) => <option key={p.id} value={p.id}>{`${p.nome} ${p.cognome}`.trim()}</option>)}
            </select>
          </div>
        )}
        <div className="subnav-wrap con-ingranaggio">
          <div className="seg subnav" role="tablist" aria-label="Scheda">
            <button role="tab" aria-selected={activeSub === 'scheda'} onClick={() => setSub('scheda')}>Scheda</button>
            <button role="tab" aria-selected={activeSub === 'personaggio'} onClick={() => setSub('personaggio')}>Personaggio</button>
            <button role="tab" aria-selected={activeSub === 'abilita'} onClick={() => setSub('abilita')}>Abilità</button>
            {hasPoteri && <button role="tab" aria-selected={activeSub === 'poteri'} onClick={() => setSub('poteri')}>Poteri</button>}
          </div>
          <BottoneImpostazioni onClick={() => setImpostazioni(true)} />
        </div>
        {inAttesa && <div className="page" style={{ paddingBottom: 0 }}><StatoCard c={inAttesa} onEdit={() => setCrea(inAttesa)} compatto /></div>}
        {activeSub === 'scheda' && daScegliere && dovute && <div className="page" style={{ paddingBottom: 0 }}><AvvisoScelta dovute={dovute} onApri={() => setSceltaAperta(true)} /></div>}
        {activeSub === 'scheda' && !daScegliere && <div className="page push-wrap" style={{ paddingBottom: 0 }}><InvitoNotifiche onToast={setToast} /></div>}
        {activeSub === 'scheda' && <SchedaTab pg={pg} calc={calc} races={RACES} catalog={catalog} onSaveEq={saveEq} onPoteri={hasPoteri ? () => setSub('poteri') : undefined} />}
        {activeSub === 'personaggio' && <PersonaggioTab pg={pg} races={RACES} />}
        {activeSub === 'abilita' && <AbilitaTab pg={pg} catalog={catalog} />}
        {activeSub === 'poteri' && <PoteriTab pg={pg} calc={calc} spells={SPELLS} avviso={dovute && <AvvisoScelta dovute={dovute} onApri={() => setSceltaAperta(true)} />} />}
        {sceltaAperta && daScegliere && dovute && <SceltaIncantesimi pg={pg} dovute={dovute} onChiudi={() => setSceltaAperta(false)}
          onConferma={async (ids) => {
            await api.chooseSpells(pg.id, ids);
            setPgs((list) => list.map((c) => (c.id === pg.id ? { ...c, incantesimi: [...c.incantesimi, ...ids.filter((x) => !c.incantesimi.includes(x))] } : c)));
            setSceltaAperta(false); setSub('poteri'); setToast('Scelta salvata'); window.scrollTo(0, 0);
          }} />}
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
      {apertura}
      {user.ruolo === 'staff' && (
        <p className="vista-staff">La tua scheda da giocatore. <button className="link" onClick={() => cambiaVista(false)}>Torna al pannello staff</button></p>
      )}
      {api.demo && <p className="demo-banner">Versione di prova con personaggi di esempio. <button className="link" onClick={logout}>Cambia utente</button></p>}
      {loadError && <div className="page"><div className="notice">Non riesco a caricare la scheda: {loadError}</div></div>}
      <div key={`${tab}-${sub}-${crea ? 'c' : ''}`} className="view">
        {tab === 'scheda' && schedaView}
        {tab === 'eventi' && <EventiTab user={user} pg={pg ?? inAttesa} onToast={setToast} />}
        {tab === 'missive' && <MissiveTab pgs={approvati} onToast={setToast} onCount={contaMissive} />}
        {tab === 'taccuino' && <TaccuinoTab onToast={setToast} />}
        {tab === 'manuali' && <ManualiTab />}
      </div>
      {tab === 'scheda' && !crea && !(pg && calc) && (
        <div className="page" style={{ paddingTop: 0 }}>
          <button className="btn ghost block" onClick={() => setImpostazioni(true)}>Impostazioni</button>
        </div>
      )}
      {impostazioni && <Impostazioni user={user} onClose={() => setImpostazioni(false)} onToast={setToast} onLogout={() => { setImpostazioni(false); logout(); }} />}

      <nav className="tabbar" aria-label="Sezioni">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <span className="tab-ico">{ICONS[t.id]}{t.id === 'missive' && missiveNuove > 0 && <span className="badge-dot" aria-label={`${missiveNuove} da leggere`}>{missiveNuove}</span>}</span><span>{t.nome}</span>
            </button>
          ))}
        </div>
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
      <ChatPopup />
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

function BottoneImpostazioni({ onClick }: { onClick: () => void }) {
  return (
    <button className="ingranaggio" onClick={onClick} aria-label="Impostazioni">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    </button>
  );
}

/** Impostazioni del giocatore: notifiche, password, uscita */
function Impostazioni({ user, onClose, onToast, onLogout }: { user: User; onClose: () => void; onToast: (t: string) => void; onLogout: () => void }) {
  return (
    <div className="impostazioni" role="dialog" aria-modal="true" aria-label="Impostazioni">
      <div className="page">
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onClose}>Torna alla scheda</button>
        <h1 style={{ fontSize: '2rem' }}>Impostazioni</h1>
        <section className="imp-gruppo">
          <h2 className="section-title">Account</h2>
          <div className="imp-account">
            <strong>{user.nome || 'Giocatore'}</strong>
            {user.email && user.email !== 'demo' && <span>{user.email}</span>}
          </div>
        </section>
        <section className="imp-gruppo">
          <h2 className="section-title">Notifiche</h2>
          <InterruttoreNotifiche onToast={onToast} />
        </section>
        {!api.demo && (
          <section className="imp-gruppo">
            <h2 className="section-title">Password</h2>
            <PasswordForm onDone={() => onToast('Password salvata')} />
          </section>
        )}
        <button className="btn ghost block" onClick={onLogout}>{api.demo ? 'Cambia utente' : 'Esci'}</button>
      </div>
    </div>
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
