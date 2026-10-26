import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { api } from '../api';
import type { Manuale } from '../data/types';
import { useIndietro } from '../indietro';
import { IconaFoto } from './Cartellino';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;

/** Elenco dei manuali (di base + caricati dallo staff), sempre aggiornato */
export function useManuali() {
  const [list, setList] = useState<Manuale[]>([]);
  const ricarica = () => api.manuals().then(setList).catch(() => setList([]));
  useEffect(() => { ricarica(); }, []);
  return { list, ricarica };
}

/** Apre un manuale (risolve l'indirizzo del PDF, anche per quelli caricati nell'archivio) */
export function ApriManuale({ m, pagina, onClose }: { m: Manuale; pagina?: number; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.manualUrl(m).then(setUrl).catch((e) => setErr((e as Error).message)); }, [m.id, m.filePath]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <div className="viewer" role="dialog"><div className="viewer-bar"><button className="icon-btn" onClick={onClose} aria-label="Chiudi">✕</button><span className="title">{m.nome}</span></div><p className="error" style={{ padding: 16 }}>{err}</p></div>;
  if (!url) return null;
  return <PdfViewer url={url} title={m.nome} pagina={pagina} onClose={onClose} />;
}

export function ManualiTab() {
  const { list } = useManuali();
  const [open, setOpen] = useState<Manuale | null>(null);
  const visibili = list.filter((m) => !m.nascosto && !m.soloStaff);
  // arrivano solo a chi è dello staff: l'archivio non li consegna ai giocatori
  const riservati = list.filter((m) => !m.nascosto && m.soloStaff);
  return (
    <div className="page">
      <div>
        <h1 style={{ fontSize: '2rem' }}>Manuali</h1>
        <p className="hint" style={{ margin: '4px 0 0' }}>La biblioteca di Grayvent: regolamento, poteri e mondo di gioco.</p>
      </div>
      <button className="chiedi-card" onClick={() => window.dispatchEvent(new Event('grayvent:apri-cartellino'))}>
        <span className="chat-sigillo grande cart-sigillo" aria-hidden="true"><IconaFoto /></span>
        <span className="chiedi-testo">
          <strong>Leggi un cartellino</strong>
          <span>Fotografa o scrivi il codice di un’abilità, un incantesimo o un oggetto per vederne gli effetti</span>
        </span>
      </button>
      <button className="chiedi-card" onClick={() => window.dispatchEvent(new Event('grayvent:apri-chat'))}>
        <span className="chat-sigillo grande" aria-hidden="true">?</span>
        <span className="chiedi-testo">
          <strong>Hai un dubbio sulle regole?</strong>
          <span>Chiedilo ai manuali: la risposta arriva con manuale e pagina.</span>
        </span>
        <svg className="chiedi-freccia" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <section>
        <h2 className="section-title">Biblioteca</h2>
        <div className="libri">
          {visibili.map((m, i) => <Libro key={m.id} m={m} i={i} onApri={() => setOpen(m)} />)}
        </div>
      </section>
      {riservati.length > 0 && (
        <section>
          <h2 className="section-title">Riservati allo staff</h2>
          <p className="hint" style={{ margin: '-4px 0 10px' }}>I giocatori non vedono questi volumi.</p>
          <div className="libri">
            {riservati.map((m, i) => <Libro key={m.id} m={m} i={visibili.length + i} onApri={() => setOpen(m)} />)}
          </div>
        </section>
      )}
      {open && <ApriManuale m={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const TINTE = ['#5a2a20', '#2f3b2a', '#2a3346', '#4a3a1c', '#3e2440', '#23393a'];

/** Un manuale come volume in libreria: dorso colorato con sigla, titolo e descrizione */
export function Libro({ m, i, onApri, children }: { m: Manuale; i: number; onApri?: () => void; children?: React.ReactNode }) {
  const corpo = (
    <>
      <span className="libro-dorso" style={{ ['--tinta' as string]: TINTE[i % TINTE.length] }} aria-hidden="true">
        <span>{m.sigla || m.nome.charAt(0)}</span>
      </span>
      <span className="libro-testo">
        <strong>{m.nome}</strong>
        {m.descrizione && <span>{m.descrizione}</span>}
        {children}
      </span>
    </>
  );
  return onApri
    ? <button className="libro" onClick={onApri}>{corpo}<svg className="libro-freccia" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
    : <div className="libro">{corpo}</div>;
}

export function PdfViewer({ url, title, pagina, onClose }: { url: string; title: string; pagina?: number; onClose: () => void }) {
  useIndietro(true, onClose);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [ratio, setRatio] = useState(1.414);
  const [current, setCurrent] = useState(1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument(url);
    task.promise.then(async (d) => {
      if (cancelled) return;
      const p1 = await d.getPage(1);
      const vp = p1.getViewport({ scale: 1 });
      setRatio(vp.height / vp.width);
      setDoc(d);
    }).catch(() => !cancelled && setError('Non riesco ad aprire il manuale. Controlla la connessione e riprova.'));
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => { cancelled = true; task.destroy(); window.removeEventListener('keydown', k); };
  }, [url, onClose]);

  const width = Math.min(window.innerWidth - 16, 900) * zoom;

  // aperto da una fonte del chatbot: va alla pagina citata
  useEffect(() => {
    if (!doc || !pagina || pagina < 2) return;
    setCurrent(pagina);
    const t = setTimeout(() => box.current?.querySelector(`[aria-label="Pagina ${pagina}"]`)?.scrollIntoView({ block: 'start' }), 50);
    return () => clearTimeout(t);
  }, [doc, pagina]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="viewer-bar">
        <button className="icon-btn" onClick={onClose} aria-label="Chiudi manuale">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="title">{title}</span>
        {doc && <span className="page-count">{current}/{doc.numPages}</span>}
        <button className="icon-btn" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Riduci" disabled={zoom <= 1}>−</button>
        <button className="icon-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} aria-label="Ingrandisci">+</button>
      </div>
      <div className="viewer-pages" ref={box} style={{ alignItems: zoom > 1 ? 'flex-start' : 'center' }}
        onScroll={(e) => {
          // pagina corrente: l'ultima pagina il cui inizio è sopra il primo terzo dello schermo
          if (!doc) return;
          const el = e.currentTarget;
          const y = el.scrollTop + el.clientHeight / 3;
          const pagine = el.querySelectorAll<HTMLElement>('.pdf-page');
          let lo = 0, hi = pagine.length - 1;
          while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (pagine[mid].offsetTop - el.offsetTop <= y) lo = mid; else hi = mid - 1; }
          setCurrent(el.scrollTop + el.clientHeight >= el.scrollHeight - 4 ? pagine.length : lo + 1);
        }}>
        {error && <p className="error">{error}</p>}
        {!doc && !error && <p className="hint">Apro il manuale…</p>}
        {doc && Array.from({ length: doc.numPages }, (_, i) => (
          <PdfPage key={i} doc={doc} n={i + 1} width={width} ratio={ratio} root={box} />
        ))}
      </div>
    </div>
  );
}

function PdfPage({ doc, n, width, ratio, root }: {
  doc: PDFDocumentProxy; n: number; width: number; ratio: number; root: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const renderedAt = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.isIntersecting) setNear(true);
      }
    }, { root: root.current, rootMargin: '600px 0px', threshold: [0, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, [n, root]);

  useEffect(() => {
    if (!near || renderedAt.current === width) return;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null = null;
    let cancelled = false;
    doc.getPage(n).then((page) => {
      if (cancelled || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const vp = page.getViewport({ scale: (width / base.width) * dpr });
      const c = canvas.current;
      c.width = vp.width; c.height = vp.height;
      task = page.render({ canvasContext: c.getContext('2d')!, viewport: vp });
      task.promise.then(() => { renderedAt.current = width; }).catch(() => {});
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [near, width, doc, n]);

  return (
    <div ref={ref} className="pdf-page" style={{ width, height: width * ratio }} aria-label={`Pagina ${n}`}>
      <canvas ref={canvas} />
    </div>
  );
}
