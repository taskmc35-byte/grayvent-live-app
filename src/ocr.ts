// Lettura del testo da una foto (sul telefono, senza servizi a pagamento): Tesseract.js caricato solo quando serve.
// Il motore (~5 MB la prima volta) arriva dal CDN jsDelivr e poi resta nella cache del browser.
import type { Worker } from 'tesseract.js';

let worker: Promise<Worker> | null = null;
let avanzamento: ((p: number) => void) | undefined;

function preparaWorker() {
  if (!worker) {
    worker = import('tesseract.js').then(async ({ createWorker }) => {
      const w = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') avanzamento?.(m.progress); },
      });
      // lettura normale (non solo codici): se il codice non si legge, l'app riconosce il nome stampato
      return w;
    }).catch((e) => { worker = null; throw e; });
  }
  return worker;
}

/** Ridimensiona e porta in scala di grigi ad alto contrasto: l'OCR legge meglio */
export type Regione = { x: number; y: number; w: number; h: number }; // frazioni della foto (0-1)
const bitmap = new WeakMap<Blob, Promise<ImageBitmap>>();

async function prepara(file: Blob, gradi: 0 | 90 | 180 | 270, bn: boolean, reg?: Regione, riduci?: number): Promise<HTMLCanvasElement> {
  if (!bitmap.has(file)) bitmap.set(file, createImageBitmap(file));
  const img = await bitmap.get(file)!;
  // pezzo della foto (tutta, una porzione automatica o il punto toccato)
  const r = reg ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.max(0, r.x * img.width), sy = Math.max(0, r.y * img.height);
  const sw = Math.min(img.width - sx, r.w * img.width), sh = Math.min(img.height - sy, r.h * img.height);
  // le foto grandi si riducono, i pezzi piccoli si ingrandiscono: l'OCR vuole lettere di 20-40 px
  const lato = Math.max(sw, sh);
  const k = riduci ? Math.min(1, riduci / lato) : reg ? Math.min(4, Math.max(1.5, 1800 / lato)) : lato > 3200 ? 3200 / lato : lato < 1200 ? Math.min(3, 1200 / lato) : 1;
  const w = Math.round(sw * k), h = Math.round(sh * k);
  // riduzione a metà per volta: fa la media dei pixel e cancella la griglia dei pixel di uno schermo fotografato (moiré)
  let sorgente: CanvasImageSource = img, ssx = sx, ssy = sy, ssw = sw, ssh = sh;
  if (riduci) {
    while (ssw / 2 > w * 1.2) {
      const c2 = document.createElement('canvas');
      c2.width = Math.round(ssw / 2); c2.height = Math.round(ssh / 2);
      const x2 = c2.getContext('2d')!; x2.imageSmoothingQuality = 'high';
      x2.drawImage(sorgente, ssx, ssy, ssw, ssh, 0, 0, c2.width, c2.height);
      sorgente = c2; ssx = 0; ssy = 0; ssw = c2.width; ssh = c2.height;
    }
  }
  const cv = document.createElement('canvas');
  const girata = gradi === 90 || gradi === 270;
  cv.width = girata ? h : w; cv.height = girata ? w : h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(cv.width / 2, cv.height / 2); ctx.rotate((gradi * Math.PI) / 180);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sorgente, ssx, ssy, ssw, ssh, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height);
  let min = 255, max = 0;
  const g = new Uint8ClampedArray(d.width * d.height);
  for (let i = 0; i < g.length; i++) {
    const v = 0.299 * d.data[i * 4] + 0.587 * d.data[i * 4 + 1] + 0.114 * d.data[i * 4 + 2];
    g[i] = v; if (v < min) min = v; if (v > max) max = v;
  }
  const span = Math.max(1, max - min);
  // bianco e nero netto (soglia di Otsu): aiuta con le foto di uno schermo o con poca luce
  let soglia = -1;
  if (bn) {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < g.length; i++) hist[Math.round(((g[i] - min) / span) * 255)]++;
    let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sB = 0, wB = 0, best = 0;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = g.length - wB; if (!wF) break;
      sB += t * hist[t];
      const m = sB / wB - (sum - sB) / wF;
      const v = wB * wF * m * m;
      if (v > best) { best = v; soglia = t; }
    }
  }
  for (let i = 0; i < g.length; i++) {
    let v = ((g[i] - min) / span) * 255;
    if (soglia >= 0) v = v > soglia ? 255 : 0;
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  return cv;
}

export type Passata = { gradi: 0 | 90 | 180 | 270; modo: 'normale' | 'codici' | 'bn'; regione?: Regione; riduci?: number };

/** Tentativi in ordine: lettura normale, solo codici, bianco e nero; poi la foto girata.
 * Se il codice è piccolo nella foto (es. lo schermo del PC) si legge toccandolo: passateZona */
export const PASSATE: Passata[] = [
  { gradi: 0, modo: 'normale' },
  // foto di uno schermo: rimpicciolita la griglia dei pixel sparisce e il codice grande resta leggibile (ed è veloce)
  { gradi: 0, modo: 'normale', riduci: 400 }, { gradi: 0, modo: 'normale', riduci: 700 },
  { gradi: 0, modo: 'codici' },
  { gradi: 0, modo: 'bn' },
  { gradi: 90, modo: 'normale' }, { gradi: 270, modo: 'normale' }, { gradi: 180, modo: 'normale' },
];
/** Tentativi sul punto toccato dal giocatore */
export const passateZona = (cx: number, cy: number): Passata[] => {
  const out: Passata[] = [];
  for (const [w, h] of [[0.22, 0.08], [0.35, 0.12], [0.5, 0.18]]) {
    const regione = { x: cx - w / 2, y: cy - h / 2, w, h };
    out.push({ gradi: 0, modo: 'normale', regione }, { gradi: 0, modo: 'codici', regione });
  }
  return out;
};

/** Soglia di sicurezza (0-100) di una parola letta: sotto, la parola vale solo per i suggerimenti */
const SICURA = 65;

/** Testo letto dalla foto (la lettura avviene tutta sul telefono): tutto, e solo le parole lette con sicurezza */
export async function leggiFoto(file: Blob, onProgresso?: (p: number) => void, passata: Passata = PASSATE[0]): Promise<{ testo: string; sicuro: string }> {
  avanzamento = onProgresso;
  const [w, cv] = await Promise.all([preparaWorker(), prepara(file, passata.gradi, passata.modo === 'bn', passata.regione, passata.riduci)]);
  await w.setParameters(passata.modo === 'codici'
    ? { tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.', tessedit_pageseg_mode: '11' as never }
    : { tessedit_char_whitelist: '', tessedit_pageseg_mode: (passata.modo === 'bn' || passata.regione || passata.riduci ? '11' : '3') as never });
  const r = await w.recognize(cv, {}, { text: true, blocks: true });
  const righe = (r.data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
    .map((l) => l.words.filter((x) => x.confidence >= SICURA).map((x) => x.text).join(' ')).filter(Boolean);
  return { testo: r.data.text, sicuro: righe.join('\n') };
}
