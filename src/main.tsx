import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Splash } from './components/Splash';
import { avviaInchiostro } from './inchiostro';
import './styles.css';

// L'animazione d'apertura si vede una volta per sessione (riaprendo l'app), non a ogni ricarica della pagina
function Apertura() {
  const [vista, setVista] = React.useState(() => { try { return sessionStorage.getItem('gv-splash') === '1'; } catch { return false; } });
  if (vista) return null;
  return <Splash onFine={() => { try { sessionStorage.setItem('gv-splash', '1'); } catch { /* niente */ } setVista(true); }} />;
}

type Hot = { ready?: (start: () => void) => void };
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
const start = () => {
  const el = document.getElementById('root')!;
  const w = el as HTMLElement & { _gvRoot?: ReactDOM.Root };
  w._gvRoot ??= ReactDOM.createRoot(el);
  w._gvRoot.render(<React.StrictMode><App /><Apertura /></React.StrictMode>);
};
// Nell'anteprima pubblicata la pagina può essere aggiornata mentre è aperta: avvia l'app quando il visualizzatore è pronto
if (hot?.ready) hot.ready(start); else start();
avviaInchiostro();

// Offline: registra il service worker solo sul sito vero (non nelle anteprime)
// toccando una notifica con l'app già aperta, il service worker chiede di ricaricarla per mostrare le novità
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.tipo === 'gv-ricarica') location.reload(); });
}
if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.MODE !== 'artifact') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
