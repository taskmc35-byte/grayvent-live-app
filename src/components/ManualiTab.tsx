import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;

export const MANUALI = [
  { file: 'manuale-giocatore.pdf', nome: 'Manuale del Giocatore', desc: 'Regolamento, combattimento e chiamate', sigla: 'G' },
  { file: 'creazione-personaggio.pdf', nome: 'Creazione del Personaggio', desc: 'Razze, abilità di base e apprendimento', sigla: 'C' },
  { file: 'manuale-misteri.pdf', nome: 'Manuale dei Misteri', desc: 'Magia, miracoli, alchimia e rune', sigla: 'M' },
  { file: 'incantesimi-miracoli.pdf', nome: 'Incantesimi e Miracoli', desc: 'Dispense dei poteri minori', sigla: 'I' },
  { file: 'manuale-ambientazione.pdf', nome: 'Manuale di Ambientazione', desc: 'Storia, regni, leggi e religioni', sigla: 'A' },
];

export function ManualiTab() {
  const [open, setOpen] = useState<(typeof MANUALI)[number] | null>(null);
  return (
    <div className="page">
      <h1 style={{ fontSize: '2rem' }}>Manuali</h1>
      <div className="manual-list">
        {MANUALI.map((m) => (
          <button key={m.file} className="manual" onClick={() => setOpen(m)}>
            <span className="cover" aria-hidden="true">{m.sigla}</span>
            <span><strong>{m.nome}</strong><span>{m.desc}</span></span>
          </button>
        ))}
      </div>
      {open && <PdfViewer file={open.file} title={open.nome} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function PdfViewer({ file, title, pagina, onClose }: { file: string; title: string; pagina?: number; onClose: () => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [ratio, setRatio] = useState(1.414);
  const [current, setCurrent] = useState(1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument(`manuali/${file}`);
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
  }, [file, onClose]);

  const width = Math.min(window.innerWidth - 16, 900) * zoom;

  // aperto da una fonte del chatbot: va alla pagina citata
  useEffect(() => {
    if (!doc || !pagina || pagina < 2) return;
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
      <div className="viewer-pages" ref={box} style={{ alignItems: zoom > 1 ? 'flex-start' : 'center' }}>
        {error && <p className="error">{error}</p>}
        {!doc && !error && <p className="hint">Apro il manuale…</p>}
        {doc && Array.from({ length: doc.numPages }, (_, i) => (
          <PdfPage key={i} doc={doc} n={i + 1} width={width} ratio={ratio} root={box} onVisible={setCurrent} />
        ))}
      </div>
    </div>
  );
}

function PdfPage({ doc, n, width, ratio, root, onVisible }: {
  doc: PDFDocumentProxy; n: number; width: number; ratio: number; root: React.RefObject<HTMLDivElement | null>; onVisible: (n: number) => void;
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
        if (e.intersectionRatio > 0.5) onVisible(n);
      }
    }, { root: root.current, rootMargin: '600px 0px', threshold: [0, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, [n, root, onVisible]);

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
