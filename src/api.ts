// Livello dati: modalità demo (tutto nel browser) oppure Supabase (account reali).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Ability, Character, DatiIscrizione, Evento, Impostazioni, Iscrizione, Missiva, Nota, StatoScheda, Afflizione, DomandaStaff, Manuale, MissivaStaff, ParteManuale, RispostaChat } from './data/types';
import { unisciManuali } from './manuali/base';
import { DEMO_CHARACTERS } from './data/demo';
import { ALL_ABILITIES } from './data/abilities';
import { blobToDataUrl, ridimensiona } from './immagine';

export interface User { id: string; email: string; ruolo: 'giocatore' | 'staff'; nome?: string }
export interface Profile { id: string; email: string; nome?: string; ruolo: 'giocatore' | 'staff' }
/** Personaggio come lo vede lo staff: con il proprietario e lo stato */
export interface StaffCharacter extends Character { proprietario: string | null; attivo: boolean }

export const IMPOSTAZIONI_DEFAULT: Impostazioni = {
  missive: {
    normale: { costo: 2, rispostaApp: false, descrizione: 'Spedita grazie ai viaggiatori. Probabilmente ricevi risposta al Time in del prossimo evento a cui partecipi, in busta.' },
    assicurata: { costo: 5, rispostaApp: false, descrizione: 'Spedita tramite i Cortesi. Ricevi sicuramente risposta al Time in del prossimo evento a cui partecipi, in busta.' },
    rapida: { costo: 10, rispostaApp: true, descrizione: 'Spedita tramite i Cortesi. Ricevi sicuramente risposta prima dell’evento.' },
    runica: { costo: 1000, rispostaApp: true, descrizione: 'Spedita tramite i Cortesi. Ricevi sicuramente risposta entro qualche giorno (sanità mentale permettendo).' },
  },
};

export interface Api {
  demo: boolean;
  currentUser(): Promise<User | null>;
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string, nome: string): Promise<{ confermaEmail: boolean }>;
  sendLoginLink(email: string): Promise<void>;
  /** rimanda l'email di conferma dell'account */
  resendConfirmation(email: string): Promise<void>;
  signOut(): Promise<void>;
  setPassword(password: string): Promise<void>;
  myCharacters(): Promise<StaffCharacter[]>;
  saveEquipment(id: string, eq: Character['equipaggiamento']): Promise<void>;
  /** il giocatore conferma (una volta sola) gli incantesimi o miracoli scelti */
  chooseSpells(id: string, ids: string[]): Promise<void>;
  /** il giocatore invia (o reinvia) la scheda creata con la creazione guidata */
  submitCharacter(c: Character, bgFile?: File | null): Promise<void>;
  catalog(): Promise<Ability[]>;
  bgFileUrl(path: string): Promise<string>;
  // eventi
  events(): Promise<Evento[]>;
  myRegistrations(): Promise<Iscrizione[]>;
  register(eventoId: string, dati: DatiIscrizione): Promise<void>;
  // taccuino
  notes(): Promise<Nota[]>;
  saveNote(n: Nota): Promise<Nota>;
  deleteNote(id: string): Promise<void>;
  // missive
  myLetters(): Promise<Missiva[]>;
  sendLetter(m: Omit<Missiva, 'id' | 'utente' | 'inviata' | 'stato'>): Promise<void>;
  settings(): Promise<Impostazioni>;
  // staff
  allCharacters(): Promise<StaffCharacter[]>;
  saveCharacter(c: StaffCharacter): Promise<StaffCharacter>;
  profiles(): Promise<Profile[]>;
  invite(email: string, nome: string): Promise<void>;
  setRole(id: string, ruolo: Profile['ruolo']): Promise<void>;
  saveAbility(a: Ability): Promise<void>;
  deleteAbility(id: string): Promise<void>;
  saveEvent(e: Evento): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  /** carica l'immagine banner di un evento e ne restituisce l'indirizzo */
  uploadEventBanner(img: Blob): Promise<string>;
  registrations(eventoId: string): Promise<Iscrizione[]>;
  setPaid(id: string, pagata: boolean): Promise<void>;
  allLetters(): Promise<Missiva[]>;
  markLetterRead(id: string): Promise<void>;
  replyLetter(id: string, testo: string): Promise<void>;
  saveSettings(s: Impostazioni): Promise<void>;
  // chatbot "Chiedi ai manuali"
  /** onTesto riceve i pezzi della risposta man mano che arrivano (se il servizio lo permette) */
  chiedi(domanda: string, storia: { ruolo: 'utente' | 'bot'; testo: string }[], onTesto?: (pezzo: string) => void): Promise<RispostaChat>;
  myQuestions(): Promise<DomandaStaff[]>;
  askStaff(d: { domanda: string; rispostaBot?: string; messaggio?: string }): Promise<void>;
  allQuestions(): Promise<DomandaStaff[]>;
  replyQuestion(id: string, testo: string): Promise<void>;
  /** staff: sostituisce i testi di un manuale usati dal chatbot */
  indexManual(manuale: string, parti: ParteManuale[]): Promise<void>;
  /** staff: quanti passaggi ha il chatbot per ogni manuale */
  manualIndexStats(files: string[]): Promise<Record<string, number>>;
  // benedizioni e maledizioni (il giocatore riceve solo quelle visibili e attive)
  afflictions(personaggioId: string): Promise<Afflizione[]>;
  // manuali: quelli di base più quelli aggiunti o modificati dallo staff
  manuals(): Promise<Manuale[]>;
  // missive dallo staff ai personaggi
  myStaffLetters(): Promise<MissivaStaff[]>;
  markStaffLetterRead(id: string): Promise<void>;
  allStaffLetters(): Promise<MissivaStaff[]>;
  sendStaffLetter(mittente: string, testo: string, destinatari: { id: string; nome: string }[]): Promise<void>;
  manualUrl(m: Manuale): Promise<string>;
  saveManual(m: Manuale, file?: File | null): Promise<Manuale>;
  deleteManual(m: Manuale): Promise<void>;
  saveAffliction(a: Afflizione): Promise<void>;
  deleteAffliction(id: string): Promise<void>;
}

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function safeGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage non disponibile */ } }
/** messaggio mostrato quando l'account esiste ma l'email non è ancora stata confermata */
export const NON_CONFERMATO = 'Il tuo account non è ancora confermato: apri il link nell’email che ti abbiamo mandato. Se il link non funziona o l’email non è arrivata, fattela rimandare qui sotto.';
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const now = () => new Date().toISOString();

/** Impostazioni salvate + valori predefiniti per i tipi aggiunti dopo */
export function mergeSettings(v?: Partial<Impostazioni> | null): Impostazioni {
  const out = structuredClone(IMPOSTAZIONI_DEFAULT);
  for (const [k, val] of Object.entries(v?.missive ?? {})) out.missive[k as keyof Impostazioni['missive']] = { ...out.missive[k as keyof Impostazioni['missive']], ...val };
  if (v?.addebitiAzzeratiIl) out.addebitiAzzeratiIl = v.addebitiAzzeratiIl;
  return out;
}

function mergeCatalog(custom: Ability[]) {
  const byId = new Map(ALL_ABILITIES.map((a) => [a.id, a]));
  for (const a of custom) byId.set(a.id, a); // lo staff può correggere o aggiungere
  return [...byId.values()];
}

// ---------- Demo: tutto resta nel browser ----------
interface DemoDb {
  v: number; pg: StaffCharacter[]; profili: Profile[]; abilita: Ability[];
  eventi: Evento[]; iscrizioni: Iscrizione[]; note: (Nota & { utente: string })[]; missive: Missiva[];
  impostazioni: Impostazioni; files: Record<string, string>; domande?: DomandaStaff[]; afflizioni?: Afflizione[]; manuali?: Manuale[]; missiveStaff?: MissivaStaff[];
}
const DEMO_V = 6;
function demoSeed(): DemoDb {
  const profili: Profile[] = [
    { id: 'staff-demo', email: 'staff@esempio.it', nome: 'Organizzatore (esempio)', ruolo: 'staff' },
    ...DEMO_CHARACTERS.map((c, i) => ({ id: `p${i + 1}`, email: `giocatore${i + 1}@esempio.it`, nome: c.giocatore, ruolo: 'giocatore' as const })),
  ];
  const y = new Date().getFullYear();
  return {
    v: DEMO_V, profili, abilita: [], files: {},
    pg: DEMO_CHARACTERS.map((c, i) => ({ ...c, stato: 'approvato' as StatoScheda, proprietario: `p${i + 1}`, attivo: true })),
    eventi: [{
      id: 'ev-esempio', titolo: 'Evento di esempio', dataInizio: `${y + 1}-03-14`, dataFine: `${y + 1}-03-15`, luogo: 'Da definire',
      descrizione: 'Evento inserito come esempio per provare l’iscrizione. Lo staff può modificarlo dal pannello.',
      iscrizioniAperte: true,
      prezzi: { giorno1: null, giorno1Pernotto: null, giorni2: null, pernottoVenerdi: null, pernottoDomenica: null, pranzoSabato: null, cenaVenerdi: null, cenaDomenica: null },
      pagamento: { iban: '', intestatario: '', paypal: '', causale: '' },
    }],
    iscrizioni: [], note: [], impostazioni: IMPOSTAZIONI_DEFAULT,
    afflizioni: [
      { id: 'af-1', personaggioId: 'demo-sigurd', tipo: 'benedizione', nome: 'Benedizione di esempio', effetto: 'Esempio inserito per provare la funzione: qui lo staff scrive cosa fa la benedizione.', origine: 'Thor', durata: 'Fino al prossimo live', nascosta: false, terminata: false },
      { id: 'af-2', personaggioId: 'demo-sigurd', tipo: 'maledizione', nome: 'Maledizione di esempio', effetto: 'Esempio di maledizione visibile al giocatore.', origine: 'Un altare profanato', durata: 'Permanente', nascosta: false, terminata: false },
      { id: 'af-3', personaggioId: 'demo-sigurd', tipo: 'maledizione', nome: 'Maledizione nascosta di esempio', effetto: 'La vede solo lo staff.', nascosta: true, terminata: false },
    ],
    missive: [{
      id: 'm-esempio', utente: 'p1', personaggioId: 'demo-sigurd', mittente: 'Sigurd Vreitsson', tipo: 'rapida',
      destinatario: 'Jarl Raven Crowsson', testo: 'Mio signore, chiedo udienza al prossimo raduno dei Fyrd. Porto notizie dai villaggi del nord.',
      inviata: new Date(Date.now() - 86400000 * 3).toISOString(), stato: 'inviata',
    }],
  };
}
function demoApi(): Api {
  const load = (): DemoDb => {
    const raw = safeGet('gv-demo-db');
    if (raw) try { const d = JSON.parse(raw); if (d.v === DEMO_V) return d; } catch { /* ricrea */ }
    return demoSeed();
  };
  let db = load();
  const persist = () => safeSet('gv-demo-db', JSON.stringify(db));
  let user: User | null = null;
  const asUser = (id: string): User | null => {
    const p = db.profili.find((x) => x.id === id);
    return p ? { id: p.id, email: p.email, ruolo: p.ruolo, nome: p.nome } : null;
  };
  const sel = safeGet('gv-demo-user');
  if (sel) user = asUser(sel);
  const me = () => { if (!user) throw new Error('Accesso richiesto.'); return user; };
  return {
    demo: true,
    async currentUser() { return user; },
    async signIn(id) { user = asUser(id); safeSet('gv-demo-user', id); return user!; },
    async signUp(email, _pw, nome) {
      if (db.profili.some((p) => p.email === email)) throw new Error('Esiste già un account con questa email.');
      const p: Profile = { id: uid(), email, nome, ruolo: 'giocatore' };
      db.profili.push(p); persist(); user = asUser(p.id); safeSet('gv-demo-user', p.id);
      return { confermaEmail: false };
    },
    async sendLoginLink() { /* niente in demo */ },
    async resendConfirmation() { /* niente in demo */ },
    async signOut() { user = null; safeSet('gv-demo-user', null); },
    async setPassword() { /* niente in demo */ },
    async myCharacters() { return db.pg.filter((c) => c.proprietario === user?.id && (c.attivo || c.stato !== 'approvato')); },
    async saveEquipment(id, eq) { db.pg = db.pg.map((c) => (c.id === id ? { ...c, equipaggiamento: eq } : c)); persist(); },
    async chooseSpells(id, ids) {
      db.pg = db.pg.map((c) => (c.id === id && c.proprietario === user?.id ? { ...c, incantesimi: [...c.incantesimi, ...ids.filter((x) => !c.incantesimi.includes(x))] } : c)); persist();
    },
    async submitCharacter(c, file) {
      const u = me();
      let bgFile = c.bgFile;
      if (file) {
        const path = `${u.id}/${Date.now()}-${file.name}`;
        // in demo il file resta nel browser solo se piccolo
        if (file.size < 1_500_000) db.files[path] = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
        bgFile = { path, nome: file.name };
      }
      const existing = db.pg.find((x) => x.id === c.id);
      if (existing && existing.stato === 'approvato') throw new Error('Questa scheda è già approvata.');
      const saved: StaffCharacter = { ...c, bgFile, id: c.id || uid(), stato: 'in_approvazione', proprietario: u.id, attivo: true, giocatore: u.nome ?? '', aggiornato: now() };
      db.pg = existing ? db.pg.map((x) => (x.id === saved.id ? saved : x)) : [...db.pg, saved];
      persist();
    },
    async catalog() { return mergeCatalog(db.abilita); },
    async bgFileUrl(path) { return db.files[path] ?? ''; },
    async events() { return [...db.eventi].sort((a, b) => a.dataInizio.localeCompare(b.dataInizio)); },
    async myRegistrations() { return db.iscrizioni.filter((i) => i.utente === user?.id); },
    async register(eventoId, dati) {
      const u = me();
      const ex = db.iscrizioni.find((i) => i.eventoId === eventoId && i.utente === u.id);
      if (ex) ex.dati = dati; else db.iscrizioni.push({ id: uid(), eventoId, utente: u.id, dati, creata: now(), pagata: false });
      persist();
    },
    async notes() { return db.note.filter((n) => n.utente === user?.id).sort((a, b) => b.aggiornata.localeCompare(a.aggiornata)); },
    async saveNote(n) {
      const u = me();
      const saved = { ...n, id: n.id || uid(), aggiornata: now(), utente: u.id };
      db.note = db.note.some((x) => x.id === saved.id) ? db.note.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...db.note];
      persist(); return saved;
    },
    async deleteNote(id) { db.note = db.note.filter((n) => n.id !== id); persist(); },
    async myLetters() { return db.missive.filter((m) => m.utente === user?.id).sort((a, b) => b.inviata.localeCompare(a.inviata)); },
    async sendLetter(m) { db.missive.push({ ...m, id: uid(), utente: me().id, inviata: now(), stato: 'inviata' }); persist(); },
    async settings() { return mergeSettings(db.impostazioni); },
    async allCharacters() { return db.pg; },
    async saveCharacter(c) {
      const saved = { ...c, id: c.id || uid(), aggiornato: now() };
      db.pg = db.pg.some((x) => x.id === saved.id) ? db.pg.map((x) => (x.id === saved.id ? saved : x)) : [...db.pg, saved];
      persist(); return saved;
    },
    async profiles() { return db.profili; },
    async invite(email, nome) {
      if (db.profili.some((p) => p.email === email)) throw new Error('Esiste già un account con questa email.');
      db.profili.push({ id: uid(), email, nome, ruolo: 'giocatore' }); persist();
    },
    async setRole(id, ruolo) { db.profili = db.profili.map((p) => (p.id === id ? { ...p, ruolo } : p)); persist(); },
    async saveAbility(a) { db.abilita = [...db.abilita.filter((x) => x.id !== a.id), a]; persist(); },
    async deleteAbility(id) { db.abilita = db.abilita.filter((x) => x.id !== id); persist(); },
    async saveEvent(e) {
      const saved = { ...e, id: e.id || uid() };
      db.eventi = db.eventi.some((x) => x.id === saved.id) ? db.eventi.map((x) => (x.id === saved.id ? saved : x)) : [...db.eventi, saved];
      persist();
    },
    async uploadEventBanner(img) {
      // in prova l'immagine resta nel browser: la si rimpicciolisce di più per non riempire la memoria
      const piccola = await ridimensiona(new File([img], 'b.jpg', { type: 'image/jpeg' }), 900, 0.7);
      return blobToDataUrl(piccola);
    },
    async deleteEvent(id) { db.eventi = db.eventi.filter((e) => e.id !== id); db.iscrizioni = db.iscrizioni.filter((i) => i.eventoId !== id); persist(); },
    async registrations(eventoId) { return db.iscrizioni.filter((i) => i.eventoId === eventoId); },
    async setPaid(id, pagata) { db.iscrizioni = db.iscrizioni.map((i) => (i.id === id ? { ...i, pagata } : i)); persist(); },
    async allLetters() { return [...db.missive].sort((a, b) => b.inviata.localeCompare(a.inviata)); },
    async markLetterRead(id) { db.missive = db.missive.map((m) => (m.id === id && m.stato === 'inviata' ? { ...m, stato: 'letta' } : m)); persist(); },
    async replyLetter(id, testo) {
      const m = db.missive.find((x) => x.id === id);
      if (!m || !db.impostazioni.missive[m.tipo]?.rispostaApp) throw new Error('A questo tipo di lettera non si risponde dall’app.');
      db.missive = db.missive.map((x) => (x.id === id ? { ...x, stato: 'risposta', risposta: testo, rispostaIl: now() } : x)); persist();
    },
    async saveSettings(s) { db.impostazioni = s; persist(); },
    async chiedi(domanda, _storia, onTesto) {
      const r = await demoChiedi(domanda);
      if (onTesto) for (const parola of r.risposta.split(/(?<= )/)) { onTesto(parola); await new Promise((ok) => setTimeout(ok, 18)); }
      return r;
    },
    async myQuestions() { return (db.domande ?? []).filter((d) => d.utente === user?.id).sort((a, b) => b.creata.localeCompare(a.creata)); },
    async askStaff(d) { db.domande = [{ ...d, id: uid(), utente: me().id, stato: 'aperta', creata: now() }, ...(db.domande ?? [])]; persist(); },
    async allQuestions() { return [...(db.domande ?? [])].sort((a, b) => b.creata.localeCompare(a.creata)); },
    async replyQuestion(id, testo) { db.domande = (db.domande ?? []).map((d) => (d.id === id ? { ...d, stato: 'risposta', risposta: testo, rispostaIl: now() } : d)); persist(); },
    async indexManual(manuale, parti) {
      const tutte = demoManuali().filter((p) => p.manuale !== manuale).concat(parti);
      try { localStorage.setItem('gv-demo-manuali', JSON.stringify(tutte)); } catch { throw new Error('Spazio del browser esaurito: nella versione di prova i manuali più grandi non entrano.'); }
    },
    async manualIndexStats() {
      const out: Record<string, number> = {};
      for (const p of demoManuali()) out[p.manuale] = (out[p.manuale] ?? 0) + 1;
      return out;
    },
    async afflictions(personaggioId) {
      const tutte = (db.afflizioni ?? []).filter((a) => a.personaggioId === personaggioId);
      return user?.ruolo === 'staff' ? tutte : tutte.filter((a) => !a.nascosta && !a.terminata);
    },
    async saveAffliction(a) {
      const saved = { ...a, id: a.id || uid() };
      const list = db.afflizioni ?? [];
      db.afflizioni = list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved];
      persist();
    },
    async deleteAffliction(id) { db.afflizioni = (db.afflizioni ?? []).filter((a) => a.id !== id); persist(); },
    async manuals() { return unisciManuali(db.manuali ?? []); },
    async myStaffLetters() { return (db.missiveStaff ?? []).filter((m) => m.utente === user?.id).sort((a, b) => b.inviata.localeCompare(a.inviata)); },
    async markStaffLetterRead(id) { db.missiveStaff = (db.missiveStaff ?? []).map((m) => (m.id === id && !m.letta && m.utente === user?.id ? { ...m, letta: now() } : m)); persist(); },
    async allStaffLetters() { return [...(db.missiveStaff ?? [])].sort((a, b) => b.inviata.localeCompare(a.inviata)); },
    async sendStaffLetter(mittente, testo, destinatari) {
      const nuove = destinatari.map((d) => ({ id: uid(), personaggioId: d.id, utente: db.pg.find((c) => c.id === d.id)?.proprietario ?? null, destinatario: d.nome, mittente, testo, inviata: now() }));
      db.missiveStaff = [...nuove, ...(db.missiveStaff ?? [])]; persist();
    },
    async manualUrl(m) { return m.filePath ? db.files[m.filePath] ?? '' : `manuali/${m.id}`; },
    async saveManual(m, file) {
      const saved: Manuale = { ...m, id: m.id || `m-${Date.now()}` };
      if (file) {
        if (file.size > 4_000_000) throw new Error('Nella versione di prova si possono caricare solo PDF piccoli (fino a 4 MB). Sul sito vero non c’è questo limite.');
        const path = `${saved.id}/${Date.now()}.pdf`;
        db.files[path] = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
        saved.filePath = path;
      }
      const { base: _b, ...riga } = saved;
      db.manuali = [...(db.manuali ?? []).filter((x) => x.id !== saved.id), riga as Manuale];
      try { persist(); } catch { throw new Error('Spazio del browser esaurito.'); }
      return saved;
    },
    async deleteManual(m) {
      db.manuali = (db.manuali ?? []).filter((x) => x.id !== m.id);
      if (m.filePath) delete db.files[m.filePath];
      persist();
      await this.indexManual(m.id, []);
    },
  };
}

async function demoChiedi(domanda: string): Promise<RispostaChat> {
  // Versione di prova: nessuna AI, mostra i passaggi più pertinenti trovati nei manuali caricati
  const parti = demoManuali();
  if (!parti.length) throw new Error('Il chatbot non ha ancora i testi dei manuali: lo staff deve premere “Aggiorna il chatbot” (pannello staff, Altro, Manuali).');
  const parole = paroleChiave(domanda);
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const top = parti.map((p) => {
    const t = norm(p.titolo + ' ' + p.testo);
    let s = 0;
    for (const w of parole) { const n = t.split(w).length - 1; if (n) s += 3 + Math.min(n, 5); }
    for (let i = 0; i + 1 < parole.length; i++) if (new RegExp(parole[i] + '\\w*\\s+' + parole[i + 1]).test(t)) s += 8;
    return { p, s: s / Math.sqrt(1 + t.length / 1500) };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
  if (!top.length) return { risposta: 'Nei manuali non ho trovato passaggi su questo argomento. Prova con altre parole oppure contatta lo staff.', fonti: [] };
  return {
    risposta: 'Versione di prova: qui non c’è l’intelligenza artificiale, ti mostro i passaggi più pertinenti dei manuali.\n\n'
      + top.map((x) => `${x.p.titolo}, pag. ${x.p.pagina}:\n${x.p.testo.slice(0, 350)}${x.p.testo.length > 350 ? '…' : ''}`).join('\n\n'),
    fonti: top.map((x) => ({ manuale: x.p.manuale, titolo: x.p.titolo, pagina: x.p.pagina })),
  };
}

function demoManuali(): ParteManuale[] {
  try { return JSON.parse(safeGet('gv-demo-manuali') ?? '[]'); } catch { return []; }
}
const STOP = new Set('il lo la i gli le un uno una di a da in con su per tra fra e o ma se che chi cosa come quando dove quanto quanti quale quali posso puo può si no non del della dei delle degli al alla ai alle nel nella nei nelle sul sulla mio mia tuo tua suo sua è ha ho hanno sono essere avere fare'.split(' '));
function paroleChiave(t: string) {
  return [...new Set(t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.slice(0, Math.max(4, w.length - 2))))];
}

// ---------- Supabase ----------
type PgRow = { id: string; dati: Character; equipaggiamento: Character['equipaggiamento']; proprietario: string | null; attivo: boolean; stato: StatoScheda; nota_staff: string | null; aggiornato_il: string };
function supabaseApi(sb: SupabaseClient): Api {
  async function toUser(): Promise<User | null> {
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const { data: prof } = await sb.from('profili').select('ruolo, nome').eq('id', data.user.id).maybeSingle();
    return { id: data.user.id, email: data.user.email ?? '', ruolo: prof?.ruolo ?? 'giocatore', nome: prof?.nome };
  }
  const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
  const myId = async () => { const { data } = await sb.auth.getUser(); if (!data.user) throw new Error('Accesso richiesto.'); return data.user.id; };
  const toStaff = (r: PgRow): StaffCharacter =>
    ({ ...r.dati, id: r.id, equipaggiamento: r.equipaggiamento, proprietario: r.proprietario, attivo: r.attivo, stato: r.stato, notaStaff: r.nota_staff ?? undefined, aggiornato: r.aggiornato_il });
  const toEvento = (r: { id: string; dati: Omit<Evento, 'id'> }): Evento => ({ ...r.dati, id: r.id });
  const toIscr = (r: { id: string; evento_id: string; utente: string; dati: DatiIscrizione; creata_il: string; pagata: boolean }): Iscrizione =>
    ({ id: r.id, eventoId: r.evento_id, utente: r.utente, dati: r.dati, creata: r.creata_il, pagata: r.pagata });
  const toMiss = (r: Record<string, unknown>): Missiva => ({
    id: r.id as string, utente: r.utente as string, personaggioId: r.personaggio_id as string | null, mittente: r.mittente as string,
    tipo: r.tipo as Missiva['tipo'], destinatario: r.destinatario as string, testo: r.testo as string, inviata: r.inviata_il as string,
    stato: r.stato as Missiva['stato'], risposta: (r.risposta as string) ?? undefined, rispostaIl: (r.risposta_il as string) ?? undefined,
  });
  const toDomanda = (r: Record<string, unknown>): DomandaStaff => ({
    id: r.id as string, utente: r.utente as string, domanda: r.domanda as string, rispostaBot: (r.risposta_bot as string) ?? undefined,
    messaggio: (r.messaggio as string) ?? undefined, stato: r.stato as DomandaStaff['stato'], risposta: (r.risposta as string) ?? undefined,
    rispostaIl: (r.risposta_il as string) ?? undefined, creata: r.creata_il as string,
  });
  const toMissStaff = (r: Record<string, unknown>): MissivaStaff => ({
    id: r.id as string, personaggioId: (r.personaggio_id as string) ?? null, utente: (r.utente as string) ?? null,
    destinatario: r.destinatario as string, mittente: r.mittente as string, testo: r.testo as string,
    inviata: r.inviata_il as string, letta: (r.letta_il as string) ?? undefined,
  });
  const redirect = () => window.location.origin + window.location.pathname;
  return {
    demo: false,
    currentUser: toUser,
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error && /not confirmed/i.test(error.message)) throw new Error(NON_CONFERMATO);
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o password non corretti.' : error.message);
      return (await toUser())!;
    },
    async signUp(email, password, nome) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nome }, emailRedirectTo: redirect() } });
      if (error) throw new Error(error.message.includes('already registered') ? 'Esiste già un account con questa email. Accedi o usa il link di accesso.' : error.message);
      return { confermaEmail: !data.session };
    },
    async sendLoginLink(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirect() } });
      if (error) throw new Error(error.message.includes('Signups not allowed') ? 'Non c’è un account con questa email. Registrati o chiedilo agli organizzatori.' : error.message);
    },
    async resendConfirmation(email) {
      const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirect() } });
      if (error) throw new Error(/rate|seconds/i.test(error.message) ? 'Hai già chiesto un’email da poco: aspetta un minuto e riprova.' : error.message);
    },
    async signOut() { await sb.auth.signOut(); },
    async setPassword(password) { fail((await sb.auth.updateUser({ password })).error); },
    async myCharacters() {
      const id = await myId();
      const { data, error } = await sb.from('personaggi').select('*').eq('proprietario', id).or('attivo.eq.true,stato.neq.approvato');
      fail(error);
      return (data ?? []).map(toStaff);
    },
    async saveEquipment(id, eq) { fail((await sb.rpc('salva_equipaggiamento', { p_id: id, p_eq: eq })).error); },
    async chooseSpells(id, ids) {
      const { error } = await sb.rpc('scegli_incantesimi', { p_id: id, p_ids: ids });
      if (error) throw new Error(error.message.includes('scegli_incantesimi') ? 'Scelta degli incantesimi non ancora attiva: lo staff deve eseguire scelta_incantesimi.sql in Supabase.' : error.message);
    },
    async submitCharacter(c, file) {
      const u = await myId();
      let bgFile = c.bgFile;
      if (file) {
        const path = `${u}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
        fail((await sb.storage.from('background').upload(path, file, { upsert: false })).error);
        bgFile = { path, nome: file.name };
      }
      const { id, equipaggiamento, ...rest } = c;
      fail((await sb.rpc('invia_scheda', { p_id: id || null, p_dati: { ...rest, bgFile }, p_eq: equipaggiamento })).error);
    },
    async catalog() {
      const { data } = await sb.from('abilita').select('dati');
      return mergeCatalog((data ?? []).map((r) => r.dati as Ability));
    },
    async bgFileUrl(path) {
      const { data, error } = await sb.storage.from('background').createSignedUrl(path, 600);
      fail(error); return data!.signedUrl;
    },
    async events() {
      const { data, error } = await sb.from('eventi').select('id, dati').order('data_inizio');
      fail(error); return (data ?? []).map(toEvento);
    },
    async myRegistrations() {
      const id = await myId();
      const { data, error } = await sb.from('iscrizioni').select('*').eq('utente', id);
      fail(error); return (data ?? []).map(toIscr);
    },
    async register(eventoId, dati) {
      const id = await myId();
      fail((await sb.from('iscrizioni').upsert({ evento_id: eventoId, utente: id, dati }, { onConflict: 'evento_id,utente' })).error);
    },
    async notes() {
      const { data, error } = await sb.from('note').select('*').order('aggiornata_il', { ascending: false });
      fail(error);
      return (data ?? []).map((r) => ({ id: r.id, titolo: r.titolo, testo: r.testo, categoria: r.categoria, aggiornata: r.aggiornata_il }));
    },
    async saveNote(n) {
      const utente = await myId();
      const row = { ...(n.id ? { id: n.id } : {}), utente, titolo: n.titolo, testo: n.testo, categoria: n.categoria, aggiornata_il: now() };
      const { data, error } = await sb.from('note').upsert(row).select('*').single();
      fail(error);
      return { id: data.id, titolo: data.titolo, testo: data.testo, categoria: data.categoria, aggiornata: data.aggiornata_il };
    },
    async deleteNote(id) { fail((await sb.from('note').delete().eq('id', id)).error); },
    async myLetters() {
      const id = await myId();
      const { data, error } = await sb.from('missive').select('*').eq('utente', id).order('inviata_il', { ascending: false });
      fail(error); return (data ?? []).map(toMiss);
    },
    async sendLetter(m) {
      const utente = await myId();
      fail((await sb.from('missive').insert({ utente, personaggio_id: m.personaggioId, mittente: m.mittente, tipo: m.tipo, destinatario: m.destinatario, testo: m.testo })).error);
    },
    async settings() {
      const { data } = await sb.from('impostazioni').select('valore').eq('chiave', 'generale').maybeSingle();
      return mergeSettings(data?.valore);
    },
    async allCharacters() {
      const { data, error } = await sb.from('personaggi').select('*').order('aggiornato_il', { ascending: false });
      fail(error); return (data ?? []).map(toStaff);
    },
    async saveCharacter(c) {
      const { id, equipaggiamento, proprietario, attivo, stato, notaStaff, aggiornato: _a, ...dati } = c;
      const row = { dati, equipaggiamento, proprietario, attivo, stato: stato ?? 'approvato', nota_staff: notaStaff ?? null, aggiornato_il: now(), ...(id ? { id } : {}) };
      const { data, error } = await sb.from('personaggi').upsert(row).select('*').single();
      fail(error); return toStaff(data);
    },
    async profiles() {
      const { data, error } = await sb.from('profili').select('id, email, nome, ruolo').order('nome');
      fail(error); return (data ?? []) as Profile[];
    },
    async invite(email, nome) {
      fail((await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { nome }, emailRedirectTo: redirect() } })).error);
    },
    async setRole(id, ruolo) { fail((await sb.from('profili').update({ ruolo }).eq('id', id)).error); },
    async saveAbility(a) { fail((await sb.from('abilita').upsert({ id: a.id, dati: a, aggiornato_il: now() })).error); },
    async deleteAbility(id) { fail((await sb.from('abilita').delete().eq('id', id)).error); },
    async saveEvent(e) {
      const { id, ...dati } = e;
      fail((await sb.from('eventi').upsert({ ...(id ? { id } : {}), dati, data_inizio: e.dataInizio })).error);
    },
    async deleteEvent(id) { fail((await sb.from('eventi').delete().eq('id', id)).error); },
    async uploadEventBanner(img) {
      const path = `banner/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await sb.storage.from('eventi').upload(path, img, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (up.error) throw new Error(/not found/i.test(up.error.message) ? 'Archivio immagini non installato: esegui eventi_banner.sql in Supabase.' : up.error.message);
      return sb.storage.from('eventi').getPublicUrl(path).data.publicUrl;
    },
    async registrations(eventoId) {
      const { data, error } = await sb.from('iscrizioni').select('*').eq('evento_id', eventoId).order('creata_il');
      fail(error); return (data ?? []).map(toIscr);
    },
    async setPaid(id, pagata) { fail((await sb.from('iscrizioni').update({ pagata }).eq('id', id)).error); },
    async allLetters() {
      const { data, error } = await sb.from('missive').select('*').order('inviata_il', { ascending: false });
      fail(error); return (data ?? []).map(toMiss);
    },
    async markLetterRead(id) { fail((await sb.from('missive').update({ stato: 'letta' }).eq('id', id).eq('stato', 'inviata')).error); },
    async replyLetter(id, testo) { fail((await sb.from('missive').update({ stato: 'risposta', risposta: testo, risposta_il: now() }).eq('id', id)).error); },
    async saveSettings(s) { fail((await sb.from('impostazioni').upsert({ chiave: 'generale', valore: s })).error); },
    async chiedi(domanda, storia, onTesto) {
      // 1) risposta parola per parola dalla Edge Function "chiedi", se è installata
      const { data: sess } = await sb.auth.getSession();
      const token = sess.session?.access_token;
      if (token && onTesto) {
        let res: Response | null = null;
        try {
          res = await fetch(`${URL}/functions/v1/chiedi`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, apikey: KEY!, 'Content-Type': 'application/json' },
            body: JSON.stringify({ domanda, storia }),
          });
        } catch { res = null; }
        if (res && res.ok && res.body) {
          const out: RispostaChat = { risposta: '', fonti: [] };
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf('\n')) >= 0) {
              const riga = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
              if (!riga) continue;
              const ev = JSON.parse(riga);
              if (ev.tipo === 'fonti') { out.fonti = ev.fonti ?? []; out.rimaste = ev.rimaste; }
              else if (ev.tipo === 'testo') { out.risposta += ev.t; onTesto(ev.t); }
              else if (ev.tipo === 'errore') throw new Error(ev.messaggio);
            }
          }
          return out;
        }
        // funzione non installata o non raggiungibile: si usa il metodo classico qui sotto
      }
      // 2) risposta tutta insieme dal database
      const { data, error } = await sb.rpc('chiedi_manuali', { p_domanda: domanda, p_storia: storia });
      if (error) throw new Error(error.message.includes('chiedi_manuali') ? 'Il chatbot non è ancora installato: lo staff deve completare la configurazione.' : error.message);
      return data as RispostaChat;
    },
    async myQuestions() {
      const id = await myId();
      const { data, error } = await sb.from('domande_staff').select('*').eq('utente', id).order('creata_il', { ascending: false });
      fail(error); return (data ?? []).map(toDomanda);
    },
    async askStaff(d) {
      const utente = await myId();
      fail((await sb.from('domande_staff').insert({ utente, domanda: d.domanda, risposta_bot: d.rispostaBot ?? null, messaggio: d.messaggio ?? null })).error);
    },
    async allQuestions() {
      const { data, error } = await sb.from('domande_staff').select('*').order('creata_il', { ascending: false });
      fail(error); return (data ?? []).map(toDomanda);
    },
    async replyQuestion(id, testo) { fail((await sb.from('domande_staff').update({ stato: 'risposta', risposta: testo, risposta_il: now() }).eq('id', id)).error); },
    async indexManual(manuale, parti) {
      fail((await sb.from('manuali_parti').delete().eq('manuale', manuale)).error);
      for (let i = 0; i < parti.length; i += 200) fail((await sb.from('manuali_parti').insert(parti.slice(i, i + 200))).error);
    },
    async manualIndexStats(files) {
      const out: Record<string, number> = {};
      for (const f of files) {
        const { count, error } = await sb.from('manuali_parti').select('id', { count: 'exact', head: true }).eq('manuale', f);
        if (error) return {}; // tabella non ancora creata
        out[f] = count ?? 0;
      }
      return out;
    },
    async afflictions(personaggioId) {
      const { data, error } = await sb.from('afflizioni').select('*').eq('personaggio_id', personaggioId).order('creata_il');
      if (error) return []; // tabella non ancora creata
      return (data ?? []).map((r) => ({
        id: r.id, personaggioId: r.personaggio_id, tipo: r.tipo, nome: r.nome, effetto: r.effetto ?? '',
        origine: r.origine ?? undefined, durata: r.durata ?? undefined, nascosta: r.nascosta, terminata: r.terminata,
      }));
    },
    async saveAffliction(a) {
      const row = { ...(a.id ? { id: a.id } : {}), personaggio_id: a.personaggioId, tipo: a.tipo, nome: a.nome, effetto: a.effetto,
        origine: a.origine || null, durata: a.durata || null, nascosta: a.nascosta, terminata: a.terminata };
      const { error } = await sb.from('afflizioni').upsert(row);
      if (error) throw new Error(error.message.includes('afflizioni') ? 'Benedizioni e maledizioni non sono ancora installate: esegui benedizioni.sql in Supabase.' : error.message);
    },
    async deleteAffliction(id) { fail((await sb.from('afflizioni').delete().eq('id', id)).error); },
    async myStaffLetters() {
      const id = await myId();
      const { data, error } = await sb.from('missive_staff').select('*').eq('utente', id).order('inviata_il', { ascending: false });
      if (error) return []; // tabella non ancora creata
      return (data ?? []).map(toMissStaff);
    },
    async markStaffLetterRead(id) { await sb.rpc('segna_missiva_staff_letta', { p_id: id }); },
    async allStaffLetters() {
      const { data, error } = await sb.from('missive_staff').select('*').order('inviata_il', { ascending: false });
      if (error) return [];
      return (data ?? []).map(toMissStaff);
    },
    async sendStaffLetter(mittente, testo, destinatari) {
      const { error } = await sb.from('missive_staff').insert(destinatari.map((d) => ({ personaggio_id: d.id, destinatario: d.nome, mittente, testo })));
      if (error) throw new Error(error.code === '42P01' || error.code === 'PGRST205' || /could not find the table|does not exist/i.test(error.message)
        ? 'Missive dello staff non installate: esegui missive_staff.sql in Supabase.' : `Missiva non spedita: ${error.message}`);
    },
    async manuals() {
      const { data, error } = await sb.from('manuali').select('*');
      if (error) return unisciManuali([]); // tabella non ancora creata: solo i manuali di base
      return unisciManuali((data ?? []).map((r) => ({
        id: r.id, nome: r.nome, descrizione: r.descrizione ?? '', sigla: r.sigla ?? '', ordine: r.ordine ?? 100,
        filePath: r.file_path ?? undefined, nascosto: r.nascosto, base: false,
      })));
    },
    async manualUrl(m) {
      if (!m.filePath) return `manuali/${m.id}`;
      const { data, error } = await sb.storage.from('manuali').createSignedUrl(m.filePath, 3600);
      fail(error); return data!.signedUrl;
    },
    async saveManual(m, file) {
      const saved: Manuale = { ...m, id: m.id || `m-${Date.now()}` };
      if (file) {
        const path = `${saved.id}/${Date.now()}.pdf`;
        const up = await sb.storage.from('manuali').upload(path, file, { contentType: 'application/pdf', upsert: true });
        if (up.error) throw new Error(up.error.message.includes('not found') ? 'Archivio dei manuali non installato: esegui manuali.sql in Supabase.' : up.error.message);
        if (m.filePath) await sb.storage.from('manuali').remove([m.filePath]); // versione precedente
        saved.filePath = path;
      }
      const { error } = await sb.from('manuali').upsert({
        id: saved.id, nome: saved.nome, descrizione: saved.descrizione, sigla: saved.sigla, ordine: saved.ordine,
        file_path: saved.filePath ?? null, nascosto: saved.nascosto, aggiornato_il: now(),
      });
      if (error) throw new Error(error.message.includes('manuali') ? 'Gestione manuali non installata: esegui manuali.sql in Supabase.' : error.message);
      return saved;
    },
    async deleteManual(m) {
      fail((await sb.from('manuali').delete().eq('id', m.id)).error);
      if (m.filePath) await sb.storage.from('manuali').remove([m.filePath]);
      await sb.from('manuali_parti').delete().eq('manuale', m.id);
    },
  };
}

export const api: Api = URL && KEY ? supabaseApi(createClient(URL, KEY)) : demoApi();
