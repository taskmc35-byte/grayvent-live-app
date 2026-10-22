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
async function prepara(file: Blob, gradi: 0 | 90 | 180 | 270): Promise<HTMLCanvasElement> {
  const img = await createImageBitmap(file);
  const lato = 1800;
  const k = Math.min(1, lato / Math.max(img.width, img.height)) || 1;
  const w = Math.round(img.width * k), h = Math.round(img.height * k);
  const cv = document.createElement('canvas');
  const girata = gradi === 90 || gradi === 270;
  cv.width = girata ? h : w; cv.height = girata ? w : h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(cv.width / 2, cv.height / 2); ctx.rotate((gradi * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height);
  let min = 255, max = 0;
  const g = new Uint8ClampedArray(d.width * d.height);
  for (let i = 0; i < g.length; i++) {
    const v = 0.299 * d.data[i * 4] + 0.587 * d.data[i * 4 + 1] + 0.114 * d.data[i * 4 + 2];
    g[i] = v; if (v < min) min = v; if (v > max) max = v;
  }
  const span = Math.max(1, max - min);
  for (let i = 0; i < g.length; i++) {
    const v = ((g[i] - min) / span) * 255;
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  return cv;
}

/** Testo letto dalla foto (la lettura avviene tutta sul telefono) */
export async function leggiFoto(file: Blob, onProgresso?: (p: number) => void, gradi: 0 | 90 | 180 | 270 = 0): Promise<string> {
  avanzamento = onProgresso;
  const [w, cv] = await Promise.all([preparaWorker(), prepara(file, gradi)]);
  const r = await w.recognize(cv);
  return r.data.text;
}
