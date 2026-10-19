// Livello dati: modalità demo (tutto nel browser) oppure Supabase (account reali).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Ability, Character, DatiIscrizione, Evento, Impostazioni, Iscrizione, Missiva, Nota, StatoScheda } from './data/types';
import { DEMO_CHARACTERS } from './data/demo';
import { ALL_ABILITIES } from './data/abilities';

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
  signOut(): Promise<void>;
  setPassword(password: string): Promise<void>;
  myCharacters(): Promise<StaffCharacter[]>;
  saveEquipment(id: string, eq: Character['equipaggiamento']): Promise<void>;
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
  registrations(eventoId: string): Promise<Iscrizione[]>;
  setPaid(id: string, pagata: boolean): Promise<void>;
  allLetters(): Promise<Missiva[]>;
  markLetterRead(id: string): Promise<void>;
  replyLetter(id: string, testo: string): Promise<void>;
  saveSettings(s: Impostazioni): Promise<void>;
}

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function safeGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage non disponibile */ } }
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const now = () => new Date().toISOString();

/** Impostazioni salvate + valori predefiniti per i tipi aggiunti dopo */
export function mergeSettings(v?: Partial<Impostazioni> | null): Impostazioni {
  const out = structuredClone(IMPOSTAZIONI_DEFAULT);
  for (const [k, val] of Object.entries(v?.missive ?? {})) out.missive[k as keyof Impostazioni['missive']] = { ...out.missive[k as keyof Impostazioni['missive']], ...val };
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
  impostazioni: Impostazioni; files: Record<string, string>;
}
const DEMO_V = 5;
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
      prezzi: { giorno1: null, giorno1Pernotto: null, giorni2: null, pernottoVenerdi: null, pernottoDomenica: null, pranzoSabato: null },
      pagamento: { iban: '', intestatario: '', paypal: '', causale: '' },
    }],
    iscrizioni: [], note: [], impostazioni: IMPOSTAZIONI_DEFAULT,
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
    async signOut() { user = null; safeSet('gv-demo-user', null); },
    async setPassword() { /* niente in demo */ },
    async myCharacters() { return db.pg.filter((c) => c.proprietario === user?.id && (c.attivo || c.stato !== 'approvato')); },
    async saveEquipment(id, eq) { db.pg = db.pg.map((c) => (c.id === id ? { ...c, equipaggiamento: eq } : c)); persist(); },
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
  };
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
  const redirect = () => window.location.origin + window.location.pathname;
  return {
    demo: false,
    currentUser: toUser,
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
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
    async signOut() { await sb.auth.signOut(); },
    async setPassword(password) { fail((await sb.auth.updateUser({ password })).error); },
    async myCharacters() {
      const id = await myId();
      const { data, error } = await sb.from('personaggi').select('*').eq('proprietario', id).or('attivo.eq.true,stato.neq.approvato');
      fail(error);
      return (data ?? []).map(toStaff);
    },
    async saveEquipment(id, eq) { fail((await sb.rpc('salva_equipaggiamento', { p_id: id, p_eq: eq })).error); },
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
  };
}

export const api: Api = URL && KEY ? supabaseApi(createClient(URL, KEY)) : demoApi();
