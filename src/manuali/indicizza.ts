import * as pdfjs from 'pdfjs-dist';
import type { ParteManuale } from '../data/types';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;

const MAX = 1400; // caratteri per passaggio: abbastanza per il contesto, abbastanza piccolo per una ricerca precisa

/** Estrae il testo di un manuale PDF e lo divide in passaggi (con il numero di pagina) per il chatbot */
export async function estraiParti(file: string, titolo: string, onPagina?: (n: number, tot: number) => void): Promise<ParteManuale[]> {
  const doc = await pdfjs.getDocument(`manuali/${file}`).promise;
  const out: ParteManuale[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      let t = '';
      for (const it of tc.items) if ('str' in it) t += it.str + (it.hasEOL ? '\n' : ' ');
      t = pulisci(t);
      for (const pezzo of dividi(t)) if (pezzo.length >= 30) out.push({ manuale: file, titolo, pagina: n, testo: pezzo });
      onPagina?.(n, doc.numPages);
    }
  } finally {
    await doc.destroy();
  }
  return out;
}

export function pulisci(t: string) {
  return t
    .replace(/(\w)-\n(\w)/g, '$1$2')      // parole spezzate a fine riga
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Divide il testo di una pagina in passaggi di al massimo MAX caratteri, preferendo i confini di paragrafo e di frase */
export function dividi(t: string): string[] {
  if (t.length <= MAX) return [t];
  const out: string[] = [];
  let resto = t;
  while (resto.length > MAX) {
    const fin = resto.slice(0, MAX);
    let cut = fin.lastIndexOf('\n\n');
    if (cut < MAX * 0.5) cut = Math.max(fin.lastIndexOf('. '), fin.lastIndexOf('.\n'));
    if (cut < MAX * 0.5) cut = fin.lastIndexOf(' ');
    if (cut <= 0) cut = MAX;
    out.push(resto.slice(0, cut + 1).trim());
    resto = resto.slice(cut + 1);
  }
  if (resto.trim()) out.push(resto.trim());
  return out;
}
