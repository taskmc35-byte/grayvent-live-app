import { Component, type ReactNode } from 'react';

/** Se qualcosa si rompe mentre l'app disegna una schermata, mostra cosa è successo invece di una pagina vuota */
export class SchermataErrore extends Component<{ children: ReactNode }, { errore: Error | null }> {
  state = { errore: null as Error | null };
  static getDerivedStateFromError(errore: Error) { return { errore }; }
  componentDidCatch(e: Error) { console.error('Grayvent:', e); }
  render() {
    const e = this.state.errore;
    if (!e) return this.props.children;
    return (
      <div className="page" style={{ paddingTop: 'calc(40px + env(safe-area-inset-top, 0px))' }}>
        <h1 style={{ fontSize: '1.9rem' }}>Qualcosa non ha funzionato</h1>
        <p>L’app ha incontrato un errore. Prova a ricaricarla: se si ripete, manda allo staff una foto di questa schermata.</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', opacity: 0.8, border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>{e.message}{'\n'}{(e.stack ?? '').split('\n').slice(1, 4).join('\n')}</pre>
        <button className="btn primary block" onClick={() => location.reload()}>Ricarica l’app</button>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={async () => {
          try { for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); } catch { /* niente */ }
          location.reload();
        }}>Svuota la memoria dell’app e ricarica</button>
      </div>
    );
  }
}
