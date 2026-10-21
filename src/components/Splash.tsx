import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import SIGILLO from '../../public/brand/sigillo.webp';
import LOGO from '../../public/brand/logo-light.webp';

/*
 * Apertura "rituale runico" (circa 3,6 secondi, un tocco la salta):
 *  1. buio con fumo e braci che salgono; un punto di luce rossa si accende al centro del sigillo
 *  2. linee di luce tracciano il cerchio rituale mentre otto rune ruotano attorno
 *  3. il sigillo vero emerge dalla luce, le rune convergono, lampo e onda d'urto
 *  4. compare la scritta Grayvent Live, attraversata da un riflesso dorato
 * Se nessuno ha fatto l'accesso, alla fine non sparisce: il logo sale, le braci continuano in loop
 * e sotto compare il riquadro di accesso / iscrizione (passato come children).
 * Tutto è disegnato nelle coordinate del logo (872 x 530), centro del sigillo in (567.5, 265).
 */
const LW = 872, LH = 530, CX = 567.5, CY = 265;
const USCITA = 3600, DISSOLVENZA = 600;

// rune dell'alfabeto antico disegnate a tratti (unità: altezza 40)
const RUNE: string[] = [
  'M0 0V40M0 8L14 0M0 20L14 12',            // fehu
  'M0 0V40M0 0L14 10L14 40',                 // uruz
  'M0 0V40M0 10L12 20L0 30',                 // thurisaz
  'M0 0V40M0 0L14 10L0 20L14 40',            // raido
  'M7 0V40M0 10L7 18L14 10',                 // algiz
  'M7 0V40M0 8L14 32',                       // nauthiz
  'M7 0V40M0 10L7 0L14 10',                  // tiwaz
  'M0 40L14 18L0 8L7 0L14 8L0 18L14 40',     // othala
];

type Brace = { x: number; y: number; vx: number; vy: number; r: number; vita: number; max: number; c: string };

export function Splash({ onFine, resta = false, gia = false, children }: {
  onFine: () => void; resta?: boolean; gia?: boolean; children?: ReactNode;
}) {
  const tela = useRef<HTMLCanvasElement>(null);
  const logo = useRef<HTMLDivElement>(null);
  const fermo = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // animazione finita (o saltata): da qui il logo è completo
  const [finita, setFinita] = useState(gia);
  const [saltata, setSaltata] = useState(gia);
  const uscita = finita && !resta;
  const conLogin = finita && resta;

  useEffect(() => { if (finita) return; const t = setTimeout(() => setFinita(true), fermo ? 1000 : USCITA); return () => clearTimeout(t); }, [fermo, finita]);
  useEffect(() => { if (!uscita) return; const t = setTimeout(onFine, DISSOLVENZA); return () => clearTimeout(t); }, [uscita, onFine]);

  // il logo sale al suo posto sopra il riquadro di accesso con un movimento fluido (FLIP)
  const prima = useRef<DOMRect | null>(null);
  const eraLogin = useRef(conLogin);
  if (logo.current) prima.current = logo.current.getBoundingClientRect(); // posizione prima di questo aggiornamento
  useLayoutEffect(() => {
    const el = logo.current, da = prima.current;
    const appena = conLogin && !eraLogin.current;
    eraLogin.current = conLogin;
    if (!el || !da || !appena || saltata) return;
    const a = el.getBoundingClientRect();
    if (!a.width) return;
    el.style.transition = 'none';
    el.style.transformOrigin = 'top left';
    el.style.transform = `translate(${da.left - a.left}px, ${da.top - a.top}px) scale(${da.width / a.width})`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform 0.9s cubic-bezier(.3,.1,.2,1)';
      el.style.transform = '';
    }));
  });

  const restaRif = useRef(resta);
  restaRif.current = resta;
  // braci che salgono su tutto lo schermo
  useEffect(() => {
    const cv = tela.current;
    if (!cv || fermo) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const misura = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    misura();
    const braci: Brace[] = [];
    const COL = ['255,120,60', '255,170,80', '220,40,30', '255,215,140'];
    let raf = 0, t0 = 0, last = 0;
    const nuova = (t: number): Brace => {
      // nella fase del lampo nascono attorno al sigillo, poi da tutto il fondo
      const w = cv.width, h = cv.height;
      const vicino = t > 1500 && t < 2100;
      const x = vicino ? w * (0.5 + (Math.random() - 0.5) * 0.5) : Math.random() * w;
      const y = vicino ? h * (0.47 + (Math.random() - 0.5) * 0.2) : h * (0.55 + Math.random() * 0.5);
      return { x, y, vx: (Math.random() - 0.5) * 0.03 * dpr, vy: -(0.02 + Math.random() * (vicino ? 0.12 : 0.05)) * dpr, r: (0.6 + Math.random() * 1.6) * dpr,
        vita: 0, max: 1400 + Math.random() * 1800, c: COL[(Math.random() * COL.length) | 0] };
    };
    const frame = (ora: number) => {
      if (!t0) { t0 = ora; last = ora; }
      const t = ora - t0, dt = Math.min(48, ora - last); last = ora;
      const quante = t < 400 ? 0 : t > 1500 && t < 2100 ? 3.5 : 1.1;
      for (let i = 0; i < quante + (Math.random() < quante % 1 ? 1 : 0); i++) braci.push(nuova(t));
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = braci.length - 1; i >= 0; i--) {
        const b = braci[i];
        b.vita += dt; if (b.vita > b.max) { braci.splice(i, 1); continue; }
        b.x += (b.vx + Math.sin((b.vita + i * 97) / 300) * 0.012 * dpr) * dt; b.y += b.vy * dt;
        const f = b.vita / b.max, a = f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 4);
        g.addColorStop(0, `rgba(${b.c},${0.9 * a})`); g.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 4, 0, Math.PI * 2); ctx.fill();
      }
      if (t < USCITA + DISSOLVENZA || restaRif.current) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    addEventListener('resize', misura);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', misura); };
  }, [fermo]);

  const nonagono = Array.from({ length: 9 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 9;
    return `${(CX + 262 * Math.cos(a)).toFixed(1)},${(CY + 262 * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const rombo = `${CX},${CY - 232} ${CX + 232},${CY} ${CX},${CY + 232} ${CX - 232},${CY}`;

  return (
    <div className={`splash${uscita ? ' esce' : ''}${fermo ? ' fermo' : ''}${saltata ? ' finito' : ''}${conLogin ? ' con-login' : ''}`}
      onClick={() => { if (!finita) { setSaltata(true); setFinita(true); } }} aria-hidden={conLogin ? undefined : true}>
      <div className="splash-fumo" />
      <canvas ref={tela} className="splash-braci" />
      <div className="splash-scena">
      <div className="splash-logo" ref={logo} style={{ aspectRatio: `${LW} / ${LH}` }}>
        <div className="splash-alone" />
        <img className="splash-sigillo" src={SIGILLO} alt="" />
        <svg className="splash-traccia" viewBox={`0 0 ${LW} ${LH}`}>
          <defs>
            <filter id="sp-luce" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g filter="url(#sp-luce)" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle className="tr tr1" cx={CX} cy={CY} r="236" pathLength="1" transform={`rotate(-90 ${CX} ${CY})`} />
            <polygon className="tr tr2" points={nonagono} pathLength="1" />
            <polygon className="tr tr3" points={rombo} pathLength="1" />
            <circle className="tr tr4" cx={CX} cy={CY} r="175" pathLength="1" transform={`rotate(90 ${CX} ${CY})`} />
          </g>
          <circle className="sp-onda" cx={CX} cy={CY} r="236" />
          <g className="sp-rune">
            {RUNE.map((d, i) => {
              const a = (i * 2 * Math.PI) / RUNE.length - Math.PI / 2;
              const x = CX + 318 * Math.cos(a), y = CY + 318 * Math.sin(a);
              return (
                <g key={i} transform={`translate(${x - 11} ${y - 32}) scale(1.6)`}>
                  <path className="runa" d={d} style={{ animationDelay: `${250 + i * 90}ms` }} />
                </g>
              );
            })}
          </g>
        </svg>
        <img className="splash-scritta" src={LOGO} alt="" width={LW} height={LH} />
        <div className="splash-riflesso" style={{ WebkitMaskImage: `url(${LOGO})`, maskImage: `url(${LOGO})` }} />
      </div>
      {conLogin && <p className="splash-motto">La scheda del tuo personaggio, anche tra un live e l’altro.</p>}
      </div>
      {conLogin && <div className="splash-login" onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}
