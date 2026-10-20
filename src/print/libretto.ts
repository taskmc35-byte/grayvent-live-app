import { jsPDF } from 'jspdf';
import type { Ability, Categoria, Character, Spell } from '../data/types';
import { RACES, raceLabel } from '../data/races';
import { effectiveRace } from '../rules';
import { salvaFile } from '../download';

/*
 * Libretto cartaceo del personaggio, sullo schema della scheda fisica attuale.
 * Pagine piccole (74 x 95 mm) impaginate 6 per foglio A4, con linee di taglio tratteggiate.
 * La colonna COD resta vuota (si compila a mano). Negli Addestramenti gli slot in corso sono già compilati,
 * quelli liberi restano vuoti per la matita.
 */

const PW = 74, PH = 95;          // pagina del libretto (mm)
const COLS = 2, ROWS = 3;         // pagine per foglio
const OX = (210 - COLS * PW) / 2, OY = (297 - ROWS * PH) / 2;
const M = 3;                      // margine interno
const W = PW - 2 * M;             // larghezza utile
const INK = 60;                   // grigio delle linee (come la stampa originale)

type Draw = (d: jsPDF, x: number, y: number) => void;

const pulisci = (t: string) => t.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/–|—/g, '-');

export async function stampaLibretto(pg: Character, catalog: Ability[], spells: Spell[]) {
  const doc = creaPdf(pg, catalog, spells);
  const nome = pulisci(`${pg.nome} ${pg.cognome}`.trim() || 'personaggio');
  await salvaFile(`Libretto - ${nome}.pdf`, doc.output('blob'));
}

export function creaPdf(pg: Character, catalog: Ability[], spells: Spell[]) {
  const pagine = costruisciPagine(pg, catalog, spells);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  pagine.forEach((draw, i) => {
    const k = i % (COLS * ROWS);
    if (i > 0 && k === 0) doc.addPage();
    const x = OX + (k % COLS) * PW, y = OY + Math.floor(k / COLS) * PH;
    taglio(doc, x, y);
    draw(doc, x + M, y + M);
  });
  return doc;
}

export function costruisciPagine(pg: Character, catalog: Ability[], spells: Spell[]): Draw[] {
  const out: Draw[] = [];
  out.push(paginaIdentita(pg));
  out.push(paginaRazza(pg));
  out.push(paginaRighe('ABILITÀ SPECIALI E NOTE', (pg.abilitaSpeciali ?? '').split('\n').map((s) => s.trim()).filter(Boolean), 'TdR:'));

  const nomeAb = (id: string) => catalog.find((a) => a.id === id)?.nome ?? id;
  const catAb = (id: string): Categoria => catalog.find((a) => a.id === id)?.categoria ?? 'mentale';
  const titoli: Record<Categoria, string> = { fisico: 'ABILITÀ FISICHE', mentale: 'ABILITÀ MENTALI', sovrannaturale: 'ABILITÀ SOVRANNATURALI' };
  for (const cat of ['fisico', 'mentale', 'sovrannaturale'] as Categoria[]) {
    const voci = pg.abilita.filter((id) => catAb(id) === cat).map(nomeAb);
    out.push(...paginaTabella(titoli[cat], 'Abilità', voci));
  }

  // incantesimi e miracoli, raggruppati come nel libretto: "Miracoli Minori Padre", "Incantesimi Minori Aria"...
  const gruppi = new Map<string, string[]>();
  for (const id of pg.incantesimi) {
    const s = spells.find((x) => x.id === id);
    if (!s) continue;
    const tipo = s.tipo === 'miracolo' ? 'Miracoli' : 'Incantesimi';
    const liv = s.livello === 'Minore' ? 'Minori' : s.livello === 'Maggiore' ? 'Maggiori' : s.livello;
    const scuola = s.scuola === 'Generico' ? 'Generici' : s.scuola === 'Sintesi' ? 'di Sintesi' : s.scuola;
    const k = `${tipo} ${liv} ${scuola}`;
    gruppi.set(k, [...(gruppi.get(k) ?? []), s.nome]);
  }
  for (const [k, voci] of gruppi) out.push(...paginaTabella('ABILITÀ SOVRANNATURALI', k, voci));

  out.push(paginaAddestramenti(pg, nomeAb));
  return out.map((d) => (doc: jsPDF, x: number, y: number) => { doc.setDrawColor(INK); doc.setTextColor(30); d(doc, x, y); });
}

/* ---------- pagine ---------- */

function paginaIdentita(pg: Character): Draw {
  return (d, x, y) => {
    const h = PH - 2 * M;
    d.setLineWidth(0.35); d.rect(x, y, W, h);
    let cy = y;
    cy = intestazione(d, x, cy, 'IDENTITÀ', 6.5);
    const LAB = 17;
    const riga = (lab: string, val: string, lw = LAB) => {
      const rh = 8;
      d.setLineWidth(0.25); d.line(x, cy + rh, x + W, cy + rh); d.line(x + lw, cy, x + lw, cy + rh);
      testo(d, lab, x + 1.2, cy + rh / 2 + 1.2, 7.5);
      riquadro(d, val, x + lw + 1, cy + 0.5, W - lw - 2, rh - 1, 8);
      cy += rh;
    };
    riga('Titolo:', pg.titolo ?? '');
    riga('Nome:', `${pg.nome} ${pg.cognome}`.trim());
    riga('Razza:', razzaTesto(pg));
    riga('Professione:', [pg.professione, pg.professioneAvanzata].filter(Boolean).join(', '), 23);
    // Varie
    const vh = 17;
    testo(d, 'Varie', x + 1.2, cy + 3.6, 7.5);
    riquadro(d, pg.varie ?? '', x + 1.2, cy + 4.6, W - 2.4, vh - 5.2, 8, { valign: 'top' });
    cy += vh; d.setLineWidth(0.35); d.line(x, cy, x + W, cy);
    cy = intestazione(d, x, cy, 'DATI GIOCATORE', 6, false);
    cy = intestazione(d, x, cy, 'Cognome e Nome', 5.5, false, 7.5);
    const gh = y + h - cy - 6;
    riquadro(d, pg.giocatore ?? '', x + 2, cy + 1, W - 4, gh - 2, 12, { align: 'center' });
    cy += gh; d.setLineWidth(0.25); d.line(x, cy, x + W, cy); d.line(x + 13, cy, x + 13, y + h);
    testo(d, 'Codice:', x + 1.2, cy + 4, 7.5);
  };
}

function paginaRazza(pg: Character): Draw {
  const { race, inherited } = effectiveRace(pg, RACES);
  const r = inherited ?? race;
  const bonus = r?.bonusNome ? [r.bonusNome] : [];
  const malus = r ? [`Malus ${raceLabel(r).replace(',', '')}`] : [];
  return (d, x, y) => {
    const h = PH - 2 * M;
    d.setLineWidth(0.35); d.rect(x, y, W, h);
    const meta = y + h * 0.5;
    righe(d, x, y, meta, 'BONUS RAZZIALI', bonus);
    righe(d, x, meta, y + h, 'MALUS RAZZIALI', malus);
  };
}

function paginaRighe(titolo: string, voci: string[], piede?: string): Draw {
  return (d, x, y) => {
    const h = PH - 2 * M;
    d.setLineWidth(0.35); d.rect(x, y, W, h);
    righe(d, x, y, y + h - (piede ? 5 : 0), titolo, voci);
    if (piede) { d.setLineWidth(0.25); d.line(x, y + h - 5, x + W, y + h - 5); testo(d, piede, x + W * 0.62, y + h - 1.5, 7.5); }
  };
}

const RH = 4.6;                   // altezza riga delle tabelle
const RIGHE_TAB = Math.floor((PH - 2 * M - 11) / RH);

function paginaTabella(titolo: string, colonna: string, voci: string[]): Draw[] {
  const pagine: Draw[] = [];
  const blocchi = voci.length ? Array.from({ length: Math.ceil(voci.length / RIGHE_TAB) }, (_, i) => voci.slice(i * RIGHE_TAB, (i + 1) * RIGHE_TAB)) : [[]];
  blocchi.forEach((b, i) => pagine.push((d, x, y) => {
    const h = PH - 2 * M;
    d.setLineWidth(0.35); d.rect(x, y, W, h);
    let cy = intestazione(d, x, y, i ? `${titolo} (segue)` : titolo, 5.5, false);
    const C = 18;
    d.setLineWidth(0.25); d.line(x, cy + 5.5, x + W, cy + 5.5);
    testo(d, 'COD', x + C / 2, cy + 4, 7.5, 'center', false);
    riquadro(d, colonna, x + C + 1, cy + 0.3, W - C - 2, 4.9, 7.5, { align: 'center' });
    cy += 5.5;
    d.line(x + C, y + 5.5, x + C, y + h);
    for (let r = 0; cy + RH <= y + h + 0.01; r++, cy += RH) {
      if (cy + RH < y + h - 0.1) d.line(x, cy + RH, x + W, cy + RH);
      if (b[r]) riquadro(d, b[r], x + C + 1.2, cy + 0.25, W - C - 2.4, RH - 0.5, 8);
    }
  }));
  return pagine;
}

function paginaAddestramenti(pg: Character, nomeAb: (id: string) => string): Draw {
  const sezioni: { cat: Categoria; nome: string }[] = [
    { cat: 'fisico', nome: 'FISICO' }, { cat: 'mentale', nome: 'MENTALE' }, { cat: 'sovrannaturale', nome: 'SOVRANNATURALE' },
  ];
  return (d, x, y) => {
    const h = PH - 2 * M;
    d.setLineWidth(0.35); d.rect(x, y, W, h);
    let cy = intestazione(d, x, y, 'ADDESTRAMENTI', 6);
    const SH = (h - 6 - 8) / 3;
    for (const s of sezioni) {
      const sl = pg.slot[s.cat];
      d.setLineWidth(0.25);
      // titolo sezione + eventi svolti/totali
      d.line(x, cy + 5, x + W, cy + 5); d.line(x + W - 16, cy, x + W - 16, cy + 5);
      testo(d, s.nome, x + 1.2, cy + 3.8, 8);
      if (sl) testo(d, `${sl.eventiSvolti} / ${sl.eventiTotali}`, x + W - 8, cy + 3.8, 8, 'center', false);
      else testo(d, '/', x + W - 8, cy + 3.8, 8, 'center', false);
      // abilità | maestro
      const bh = SH - 10;
      const mid = x + W * 0.52;
      d.line(mid, cy + 5, mid, cy + 5 + bh); d.line(x, cy + 5 + bh, x + W, cy + 5 + bh);
      testo(d, 'Abilità:', x + 1.2, cy + 8, 6.5, 'left', false);
      testo(d, 'Maestro IG/FG', mid + 1.2, cy + 8, 6.5, 'left', false);
      if (sl) {
        riquadro(d, nomeAb(sl.abilita), x + 1.2, cy + 9, mid - x - 2.4, bh - 4.5, 7.5, { valign: 'top' });
        riquadro(d, sl.insegnante, mid + 1.2, cy + 9, x + W - mid - 2.4, bh - 4.5, 7.5, { valign: 'top' });
      }
      // evento | talento
      const ey = cy + 5 + bh;
      d.line(x, ey + 5, x + W, ey + 5); d.line(mid, ey, mid, ey + 5); d.line(x + W - 5, ey, x + W - 5, ey + 5);
      testo(d, 'Evento n°', x + 1.2, ey + 3.6, 6.5, 'left', false);
      if (sl?.eventoInizio) riquadro(d, sl.eventoInizio, x + 13, ey + 0.3, mid - x - 14, 4.4, 6.5);
      testo(d, 'Talento', mid + 1.2, ey + 3.6, 6.5, 'left', false);
      cy += SH;
    }
    testo(d, 'Sephira corrente:', x + 1.5, y + h - 2.8, 7.5, 'left', false);
    testo(d, String(pg.sephire ?? ''), x + 26, y + h - 2.8, 9, 'left', false);
  };
}

/* ---------- elementi comuni ---------- */

/** riga d'intestazione centrata in grassetto, con filetto sotto; restituisce la nuova y */
function intestazione(d: jsPDF, x: number, y: number, t: string, h: number, maiuscolo = true, size = 8.5) {
  riquadro(d, maiuscolo ? t.toUpperCase() : t, x + 1, y + 0.3, W - 2, h - 0.6, size, { align: 'center', bold: true });
  d.setLineWidth(0.3); d.line(x, y + h, x + W, y + h);
  return y + h;
}

/** blocco di righe con titolo: le voci si scrivono sulle prime righe, le altre restano libere */
function righe(d: jsPDF, x: number, y0: number, y1: number, titolo: string, voci: string[]) {
  let cy = intestazione(d, x, y0, titolo, 5.5, true, 8);
  // una voce lunga continua sulle righe successive (come scritta a mano); se le righe non bastano, si rimpicciolisce
  const n = Math.floor((y1 - cy + 0.01) / RH);
  d.setFont('helvetica', 'normal'); d.setFontSize(8);
  const aCapo = voci.flatMap((v) => d.splitTextToSize(pulisci(v), W - 2.4) as string[]);
  if (aCapo.length <= n) voci = aCapo;
  d.setLineWidth(0.25);
  for (let r = 0; cy + RH <= y1 + 0.01; r++, cy += RH) {
    if (cy + RH < y1 - 0.1) d.line(x, cy + RH, x + W, cy + RH);
    if (voci[r]) riquadro(d, voci[r], x + 1.2, cy + 0.25, W - 2.4, RH - 0.5, 8);
  }
}

function testo(d: jsPDF, t: string, x: number, y: number, size: number, align: 'left' | 'center' = 'left', regular = false) {
  d.setFont('helvetica', regular ? 'normal' : 'normal'); d.setFontSize(size);
  d.text(pulisci(t), x, y, { align });
}

/**
 * Scrive il testo dentro una casella (x, y, larghezza, altezza in mm): prima prova a capo,
 * poi riduce il corpo finché tutto sta dentro; solo se non basta nemmeno il corpo minimo taglia con "...".
 */
export function riquadro(d: jsPDF, t: string, x: number, y: number, w: number, h: number, size: number,
  o: { align?: 'left' | 'center'; valign?: 'top' | 'middle'; bold?: boolean; min?: number } = {}) {
  const s = pulisci(t).trim();
  if (!s || w <= 0 || h <= 0) return;
  const LH = 1.15, PT = 0.3528, min = o.min ?? 4;
  d.setFont('helvetica', o.bold ? 'bold' : 'normal');
  let fs = size, righe: string[] = [];
  for (; fs >= min; fs -= 0.25) {
    d.setFontSize(fs);
    righe = d.splitTextToSize(s, w) as string[];
    if (righe.length * fs * PT * LH <= h + 0.01 && righe.every((r) => d.getTextWidth(r) <= w + 0.01)) break;
  }
  if (fs < min) {
    fs = min; d.setFontSize(fs);
    righe = d.splitTextToSize(s, w) as string[];
    const max = Math.max(1, Math.floor(h / (fs * PT * LH)));
    if (righe.length > max) {
      righe = righe.slice(0, max);
      let u = righe[max - 1];
      while (u && d.getTextWidth(u + '...') > w) u = u.slice(0, -1);
      righe[max - 1] = u.trimEnd() + '...';
    }
  }
  const lh = fs * PT * LH, tot = righe.length * lh;
  const top = o.valign === 'top' ? y : y + (h - tot) / 2;
  const base = top + lh / 2 + fs * PT * 0.35; // linea di base della prima riga, centrata nella sua interlinea
  d.text(righe, o.align === 'center' ? x + w / 2 : x, base, { align: o.align ?? 'left', lineHeightFactor: LH });
}

function taglio(d: jsPDF, x: number, y: number) {
  d.setDrawColor(170); d.setLineWidth(0.15);
  d.setLineDashPattern([1.2, 1.2], 0);
  d.rect(x, y, PW, PH);
  d.setLineDashPattern([], 0);
}

function razzaTesto(pg: Character) {
  const { race, inherited } = effectiveRace(pg, RACES);
  const base = raceLabel(race).replace(',', '');
  return inherited ? `${base} (sangue ${raceLabel(inherited).replace(',', '')})` : base;
}
