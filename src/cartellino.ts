// Riconoscimento dei codici stampati sui cartellini di gioco (abilità, poteri, righe delle tabelle speciali)
import type { Ability, Spell } from './data/types';
import type { TabellaSpeciale } from './data/abilities';

export type Voce =
  | { tipo: 'abilita'; codice: string; abilita: Ability }
  | { tipo: 'potere'; codice: string; potere: Spell }
  | { tipo: 'tabella'; codice: string; tabella: TabellaSpeciale; riga: string[]; intestazione: string[] | null; sezione?: string;
      /** codici scritti in una riga "Codice" sotto le colonne (es. Robustezza Arcana): vale la colonna, non la riga */
      colonna?: number };

const RE_CODICE = /^[A-Z0-9]{4}(\.[A-Z0-9]{2,3})?$/;
/** forma del codice senza punto, maiuscola */
export const pulisci = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Lettere e cifre che l'OCR scambia spesso tra loro: stessa classe */
const SIMILI: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6', A: '4' };
const canonico = (s: string) => [...s].map((c) => SIMILI[c] ?? c).join('');
/** Secondo livello, più largo, per la scrittura a mano: 8/S/5/B e 0/O/D/Q/U si confondono facilmente */
const LARGHI: Record<string, string> = { '5': '8', '6': '8', '0': '0', U: '0', V: '0', '7': '1', '4': '4', H: '4', N: 'M', W: 'M' };
const largo = (s: string) => [...canonico(s)].map((c) => LARGHI[c] ?? c).join('');

export interface Indice { esatto: Map<string, Voce[]>; simile: Map<string, Voce[]>; larghi: Map<string, Voce[]>; tutte: Voce[] }

export function creaIndice(catalog: Ability[], spells: Spell[], tabelle: TabellaSpeciale[]): Indice {
  const tutte: Voce[] = [];
  for (const a of catalog) if (a.codice) tutte.push({ tipo: 'abilita', codice: a.codice.toUpperCase(), abilita: a });
  for (const p of spells) if (p.codice) tutte.push({ tipo: 'potere', codice: p.codice.toUpperCase(), potere: p });
  for (const t of tabelle) {
    const intest = t.righe[0]?.filter(Boolean).length > 1 ? t.righe[0] : null;
    let sezione: string | undefined;
    for (const r of t.righe) {
      const piene = r.filter(Boolean);
      if (piene.length === 1) sezione = piene[0];
      const rigaCodici = /^codic/i.test(r[0] ?? '');
      r.forEach((c, j) => {
        const v = c.trim().toUpperCase();
        if (RE_CODICE.test(v) && /\d/.test(v)) tutte.push({ tipo: 'tabella', codice: v, tabella: t, riga: r, intestazione: intest, sezione, ...(rigaCodici ? { colonna: j } : {}) });
      });
    }
  }
  const esatto = new Map<string, Voce[]>(), simile = new Map<string, Voce[]>(), larghi = new Map<string, Voce[]>();
  for (const v of tutte) {
    const k = pulisci(v.codice);
    esatto.set(k, [...(esatto.get(k) ?? []), v]);
    simile.set(canonico(k), [...(simile.get(canonico(k)) ?? []), v]);
    larghi.set(largo(k), [...(larghi.get(largo(k)) ?? []), v]);
  }
  return { esatto, simile, larghi, tutte };
}

/** Voci per un codice letto o scritto (tollera minuscole, punto mancante, O/0, I/1, S/5…) */
export function cercaCodice(idx: Indice, testo: string): Voce[] {
  const k = pulisci(testo);
  if (k.length !== 4 && k.length !== 6 && k.length !== 7) return [];
  const es = idx.esatto.get(k);
  if (es) return es;
  // con lo scambio di caratteri accetto solo se il risultato è uno solo (niente indovinelli)
  const unico = (l: Voce[]) => (new Set(l.map((v) => v.codice)).size === 1 ? l : []);
  const sim = unico(idx.simile.get(canonico(k)) ?? []);
  return sim.length ? sim : unico(idx.larghi.get(largo(k)) ?? []);
}

const CIFRA_DA_LETTERA: Record<string, string[]> = { S: ['5', '8'], B: ['8'], Z: ['2'], G: ['6'], O: ['0'], Q: ['0'], I: ['1'], T: ['7'] };
/** Tutte le versioni di una parola con almeno una lettera "a forma di cifra" cambiata in cifra */
function variantiCifre(p: string): string[] {
  let out = [''];
  for (const c of p) out = out.flatMap((s) => [s + c, ...(CIFRA_DA_LETTERA[c] ?? []).map((d) => s + d)]);
  return out.filter((v) => /\d/.test(v));
}

/** Tutti i codici riconoscibili nel testo letto da una foto */
export function trovaNelTesto(idx: Indice, testo: string): Voce[] {
  // pezzi di lettere e cifre nell'ordine in cui compaiono: "Codice: R4CF . WCV" -> CODICE, R4CF, WCV
  const originali = testo.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const pezzi = originali.map((p) => p.toUpperCase());
  const visti = new Map<string, Voce>();
  const prova = (s: string) => { const r = cercaCodice(idx, s); for (const v of r) visti.set(`${v.tipo}|${v.codice}`, v); return r.length > 0; };
  pezzi.forEach((p, i) => {
    if (!/\d/.test(largo(p)) && !/^[A-Z]{4}$/.test(originali[i])) return; // i codici hanno sempre almeno una cifra (anche letta come lettera: RACF = R4CF)
    const cifraVera = /\d/.test(p);
    // codice spezzato dall'OCR (R4CF WCV): ha la precedenza, perché le prime 4 lettere da sole sono il codice dell'abilità
    // madre (R4CF = Incantesimo) e non vanno mostrate come risultato a parte
    const dopo = pezzi[i + 1];
    if (p.length === 4 && dopo && [2, 3].includes(dopo.length) && prova(p + dopo)) return;
    // parola maiuscola di 4 lettere senza cifre: può essere un codice scritto a mano con la cifra letta come lettera
    // (SWEA = 8WEA). Provo solo a cambiare le lettere che somigliano a una cifra, e solo con corrispondenza esatta e unica.
    if (p.length === 4 && !cifraVera && /^[A-Z]{4}$/.test(originali[i])) {
      const trovate = new Map<string, Voce[]>();
      for (const variante of variantiCifre(p)) { const v = idx.esatto.get(variante); if (v) trovate.set(variante, v); }
      if (trovate.size === 1) for (const v of [...trovate.values()][0]) visti.set(`${v.tipo}|${v.codice}`, v);
      return;
    }
    // codice intero, anche se l'OCR ha perso il punto; una parola di 4 lettere senza cifre (es. ALLA) non è un codice
    if (p.length === 4 ? cifraVera : [6, 7].includes(p.length)) prova(p);
  });
  // nessun codice leggibile: provo con il nome stampato (una riga uguale al nome di un'abilità o di un potere)
  if (!visti.size) {
    const righe = new Set(testo.split(/\n+/).map(normNome).filter((r) => r.length >= 4));
    const perNome = idx.tutte.filter((v) => v.tipo !== 'tabella' && righe.has(normNome(nomeVoce(v))));
    // stesso nome in più scuole o livelli (es. Inguz di Odino e di Surtur): tengo quelli il cui tipo, scuola e livello
    // compaiono nel resto del cartellino ("Runa 3^ Aett Odino")
    const tutto = ` ${normNome(testo.replace(/\d\s*[\^”"'°º]\s*/g, (m) => `${m.trim()[0]}^ `))} `;
    const punti = (v: Voce) => {
      if (v.tipo !== 'potere') return 0;
      const p = v.potere;
      const parole = [{ incantesimo: 'incantesimo', miracolo: 'miracolo', runa: 'runa', cerchio: 'cerchio' }[p.tipo], p.scuola, ...p.livello.replace('^', '').split(' ')];
      return parole.filter((w) => w && tutto.includes(` ${normNome(w)} `)).length;
    };
    const max = Math.max(0, ...perNome.map(punti));
    for (const v of perNome) if (punti(v) === max) visti.set(`${v.tipo}|${v.codice}`, v);
  }
  return [...visti.values()];
}

const normNome = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Ricerca scritta: codice (anche iniziale) o nome */
export function cercaScritto(idx: Indice, q: string, max = 20): Voce[] {
  const k = pulisci(q);
  if (!k) return [];
  const nome = q.trim().toLowerCase();
  const out = new Map<string, Voce>();
  for (const v of cercaCodice(idx, q)) out.set(`${v.tipo}|${v.codice}`, v);
  for (const v of idx.tutte) {
    if (out.size >= max) break;
    const n = v.tipo === 'abilita' ? v.abilita.nome : v.tipo === 'potere' ? v.potere.nome : '';
    if (pulisci(v.codice).startsWith(k) || (nome.length >= 3 && n.toLowerCase().includes(nome))) out.set(`${v.tipo}|${v.codice}`, v);
  }
  return [...out.values()];
}

export const nomeVoce = (v: Voce) => (v.tipo === 'abilita' ? v.abilita.nome : v.tipo === 'potere' ? v.potere.nome : `${v.tabella.nome}${v.sezione ? `, ${v.sezione}` : ''}`);
