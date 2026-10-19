import { useState } from 'react';
import { api } from '../api';
import { DEMO_CHARACTERS } from '../data/demo';
import { raceById, raceLabel } from '../data/races';
import LOGO from '../../public/brand/logo-ink.png';

type Modo = 'accedi' | 'registrati';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [modo, setModo] = useState<Modo>('accedi');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const sendLink = async () => {
    if (!email.trim()) { setError('Scrivi la tua email, poi tocca “Mandami un link di accesso”.'); return; }
    setBusy(true);
    try { await api.sendLoginLink(email.trim()); setInfo('Controlla la posta: ti abbiamo mandato un link per entrare.'); setError(''); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const accedi = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!password) { await sendLink(); return; }
    setBusy(true);
    try { await api.signIn(email.trim(), password); onLogin(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const registrati = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!nome.trim()) { setError('Scrivi il tuo nome e cognome.'); return; }
    if (password.length < 8) { setError('La password deve avere almeno 8 caratteri.'); return; }
    setBusy(true);
    try {
      const r = await api.signUp(email.trim().toLowerCase(), password, nome.trim());
      if (r.confermaEmail) setInfo('Ti abbiamo mandato un’email: apri il link per confermare l’account, poi accedi.');
      else onLogin();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  const tabs = (
    <div className="seg" role="tablist" aria-label="Accesso">
      <button role="tab" aria-selected={modo === 'accedi'} onClick={() => { setModo('accedi'); setError(''); setInfo(''); }}>Accedi</button>
      <button role="tab" aria-selected={modo === 'registrati'} onClick={() => { setModo('registrati'); setError(''); setInfo(''); }}>Nuovo giocatore</button>
    </div>
  );

  const formRegistrati = (
    <form className="form" onSubmit={registrati}>
      <p className="hint">Crea il tuo account, poi compili la scheda del personaggio direttamente nell’app.</p>
      <div className="field"><label htmlFor="r-nome">Nome e cognome</label><input id="r-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
      <div className="field"><label htmlFor="r-email">Email</label><input id="r-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="r-pw">Password (almeno 8 caratteri)</label><input id="r-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {error && <p className="error" role="alert">{error}</p>}
      {info && <p className="hint" role="status">{info}</p>}
      <button className="btn primary block" disabled={busy}>{busy ? 'Creo l’account…' : 'Crea l’account'}</button>
    </form>
  );

  return (
    <main className="login">
      <div className="brand login-card">
        <img src={LOGO} alt="Grayvent Live" width={872} height={530} />
        <p>La scheda del tuo personaggio, anche tra un live e l’altro.</p>
      </div>
      {tabs}
      {modo === 'registrati' ? formRegistrati : api.demo ? (
        <div className="demo-list">
          <p className="hint">Versione di prova: scegli un personaggio di esempio, oppure prova la registrazione da “Nuovo giocatore”.</p>
          {DEMO_CHARACTERS.map((c, i) => (
            <button key={c.id} className="demo-pick" onClick={async () => { await api.signIn(`p${i + 1}`, ''); onLogin(); }}>
              <strong>{c.nome} {c.cognome}</strong>
              <span>{raceLabel(raceById(c.razza))}{c.professione ? `, ${c.professione}` : ''}</span>
            </button>
          ))}
          <button className="demo-pick staff" onClick={async () => { await api.signIn('staff-demo', ''); onLogin(); }}>
            <strong>Pannello staff</strong>
            <span>Approva le schede, gestisci eventi, missive, abilità e account</span>
          </button>
        </div>
      ) : (
        <form className="form" onSubmit={accedi}>
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <p className="error" role="alert">{error}</p>}
          {info && <p className="hint" role="status">{info}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Accesso…' : 'Accedi'}</button>
          <button type="button" className="btn ghost block" onClick={sendLink} disabled={busy}>Mandami un link di accesso</button>
          <p className="hint">Password dimenticata o account creato dallo staff? Usa il link via email.</p>
        </form>
      )}
    </main>
  );
}
