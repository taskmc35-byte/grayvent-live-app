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
      adatta(d, val, x + lw + 1.2, cy + rh / 2 + 1.2, W - lw - 2.4, 8);
      cy += rh;
    };
    riga('Titolo:', pg.titolo ?? '');
    riga('Nome:', `${pg.nome} ${pg.cognome}`.trim());
    riga('Razza:', razzaTesto(pg));
    riga('Professione:', [pg.professione, pg.professioneAvanzata].filter(Boolean).join(', '), 23);
    // Varie
    const vh = 17;
    testo(d, 'Varie', x + 1.2, cy + 3.6, 7.5);
    d.setFontSize(8); d.setFont('helvetica', 'normal');
    d.text(d.splitTextToSize(pulisci(pg.varie ?? ''), W - 2.4).slice(0, 3), x + 1.2, cy + 7.6);
    cy += vh; d.setLineWidth(0.35); d.line(x, cy, x + W, cy);
    cy = intestazione(d, x, cy, 'DATI GIOCATORE', 6, false);
    cy = intestazione(d, x, cy, 'Cognome e Nome', 5.5, false, 7.5);
    const gh = y + h - cy - 6;
    d.setFont('helvetica', 'normal'); adatta(d, pg.giocatore ?? '', x + W / 2, cy + gh / 2 + 1.8, W - 4, 12, 'center');
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
    adatta(d, colonna, x + C + (W - C) / 2, cy + 4, W - C - 2, 7.5, 'center');
    cy += 5.5;
    d.line(x + C, y + 5.5, x + C, y + h);
    for (let r = 0; cy + RH <= y + h + 0.01; r++, cy += RH) {
      if (cy + RH < y + h - 0.1) d.line(x, cy + RH, x + W, cy + RH);
      if (b[r]) adatta(d, b[r], x + C + 1.2, cy + RH - 1.2, W - C - 2.4, 8);
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
        d.setFont('helvetica', 'normal'); d.setFontSize(7.5);
        d.text(d.splitTextToSize(pulisci(nomeAb(sl.abilita)), mid - x - 2.4).slice(0, 2), x + 1.2, cy + 11.5);
        d.text(d.splitTextToSize(pulisci(sl.insegnante), x + W - mid - 2.4).slice(0, 2), mid + 1.2, cy + 11.5);
      }
      // evento | talento
      const ey = cy + 5 + bh;
      d.line(x, ey + 5, x + W, ey + 5); d.line(mid, ey, mid, ey + 5); d.line(x + W - 5, ey, x + W - 5, ey + 5);
      testo(d, 'Evento n°', x + 1.2, ey + 3.6, 6.5, 'left', false);
      if (sl?.eventoInizio) adatta(d, sl.eventoInizio, x + 13, ey + 3.6, mid - x - 14, 6.5);
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
  d.setFont('helvetica', 'bold'); d.setFontSize(size);
  d.text(pulisci(maiuscolo ? t.toUpperCase() : t), x + W / 2, y + h / 2 + size * 0.13, { align: 'center' });
  d.setLineWidth(0.3); d.line(x, y + h, x + W, y + h);
  return y + h;
}

/** blocco di righe con titolo: le voci si scrivono sulle prime righe, le altre restano libere */
function righe(d: jsPDF, x: number, y0: number, y1: number, titolo: string, voci: string[]) {
  let cy = intestazione(d, x, y0, titolo, 5.5, true, 8);
  d.setLineWidth(0.25);
  for (let r = 0; cy + RH <= y1 + 0.01; r++, cy += RH) {
    if (cy + RH < y1 - 0.1) d.line(x, cy + RH, x + W, cy + RH);
    if (voci[r]) adatta(d, voci[r], x + 1.2, cy + RH - 1.2, W - 2.4, 8);
  }
}

function testo(d: jsPDF, t: string, x: number, y: number, size: number, align: 'left' | 'center' = 'left', regular = false) {
  d.setFont('helvetica', regular ? 'normal' : 'normal'); d.setFontSize(size);
  d.text(pulisci(t), x, y, { align });
}

/** scrive su una riga riducendo il corpo finché il testo entra nella larghezza */
function adatta(d: jsPDF, t: string, x: number, y: number, maxW: number, size: number, align: 'left' | 'center' = 'left') {
  const s = pulisci(t);
  d.setFont('helvetica', 'normal');
  let fs = size;
  d.setFontSize(fs);
  while (fs > 5 && d.getTextWidth(s) > maxW) { fs -= 0.25; d.setFontSize(fs); }
  d.text(s, x, y, { align });
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
