import type { Ability, ArmorType, Character, LocId, Race, ViaPotere } from './data/types';
import { LOCAZIONI } from './data/types';

export const ARMOR: Record<ArmorType, { nome: string; pa: number }> = {
  nessuna: { nome: 'Nessuna', pa: 0 },
  cuoio: { nome: 'Cuoio', pa: 1 },
  cuoioLavorato: { nome: 'Cuoio lavorato', pa: 2 },
  anelli: { nome: 'Anelli', pa: 3 },
  piastre: { nome: 'Piastre', pa: 4 },
};
export const ARMOR_ORDER: ArmorType[] = ['nessuna', 'cuoio', 'cuoioLavorato', 'anelli', 'piastre'];

const LIVELLI = ['Minore', 'Maggiore', 'Estremo', 'Assoluto', 'Puro'];

// Manuale dei Misteri: tabelle PP / TdR per livello
export const POWER_TABLE: Record<ViaPotere, { nome: string; risorsa: string; valori: { qta: number; tdr?: string; tdrMax?: string; extra?: string }[] }> = {
  mago: { nome: 'Mago', risorsa: 'Punti Potere', valori: [
    { qta: 3, tdr: '6 min', tdrMax: '18 min', extra: 'Contraccolpo: FATO! Confusione!' },
    { qta: 4, tdr: '5 min', tdrMax: '20 min', extra: 'Contraccolpo: FATO! A Terra!' },
    { qta: 5, tdr: '4 min', tdrMax: '20 min', extra: 'Contraccolpo: FATO! Paralisi!' },
    { qta: 6, tdr: '3 min', tdrMax: '18 min', extra: 'Contraccolpo: FATO! Energia! A Terra!' },
    { qta: 7, tdr: '2 min', tdrMax: '14 min', extra: 'Contraccolpo: FATO! Energia! Crash! Lanciare un Incantesimo Puro costa 5 PP' },
  ] },
  stregone: { nome: 'Stregone', risorsa: 'Punti Potere', valori: [
    { qta: 2, tdr: '5 min', tdrMax: '10 min' },
    { qta: 3, tdr: '4 min', tdrMax: '12 min' },
    { qta: 4, tdr: '3 min', tdrMax: '12 min' },
    { qta: 6, tdr: '3 min', tdrMax: '18 min' }, // Assoluto: come il Mago Assoluto (confermato dallo staff)
  ] },
  sacerdote: { nome: 'Sacerdote', risorsa: 'Punti Potere', valori: [
    { qta: 3, tdr: '6 min', tdrMax: '18 min' },
    { qta: 4, tdr: '5 min', tdrMax: '20 min' },
    { qta: 5, tdr: '4 min', tdrMax: '20 min' },
    { qta: 6, tdr: '3 min', tdrMax: '18 min' },
    { qta: 7, tdr: '2 min', tdrMax: '14 min', extra: 'Lanciare un Miracolo Puro costa 5 PP' },
  ] },
  alchimista: { nome: 'Alchimista', risorsa: 'Attivazioni al giorno', valori: [
    { qta: 7, extra: '1 attivazione per livello del Cerchio' }, { qta: 10 }, { qta: 13 }, { qta: 15 }, { qta: 17 },
  ] },
  runista: { nome: 'Runista', risorsa: 'Pietre runiche a evento', valori: [
    { qta: 5, extra: 'Tempo di scrittura 3 min' }, { qta: 6, extra: 'Tempo di scrittura 6 min' },
    { qta: 9, extra: 'Tempo di scrittura 9 min' }, { qta: 10, extra: 'Tempo di scrittura 12 min' },
  ] },
};

export interface LocStats { id: LocId; nome: string; vitale: boolean; pf: number; pa: number; pl: number; armatura: ArmorType; avviso?: string }
export interface PowerStats { via: ViaPotere; nome: string; livello: number; livelloNome: string; risorsa: string; qta: number; tdr?: string; tdrMax?: string; extra?: string }

export interface Computed {
  locazioni: LocStats[];
  pfBase: number;
  fontiPf: string[];
  fontiPa: string[];
  potere: PowerStats[];
  note: string[];
  avvisi: string[];
  armaturePermesse: ArmorType[];
  haCompleta: boolean;
  /** armatura indossata su tutte le locazioni: la dichiarazione dell'80% si può attivare */
  completaPossibile: boolean;
  completaAttiva: boolean;
}

/** Bonus/malus effettivi della razza: il Mezz'Elfo eredita bonus e malus da razze scelte dai Master, anche diverse tra loro */
export function effectiveRace(c: Character, races: Race[]): { race?: Race; inherited?: Race; malus?: Race; bonusDa?: Race; malusDa?: Race } {
  const race = races.find((r) => r.id === c.razza);
  if (!race?.ereditaDaScelta) return { race, bonusDa: race, malusDa: race };
  const inherited = c.razzaEreditata ? races.find((r) => r.id === c.razzaEreditata) : undefined;
  const malus = c.razzaMalus ? races.find((r) => r.id === c.razzaMalus) : inherited;
  return { race, inherited, malus, bonusDa: inherited ?? race, malusDa: malus ?? race };
}

/** "con sangue umano, Feudo Nord" oppure "bonus da …, malus da …" quando le due razze sono diverse */
export function sangueTesto(c: Character, races: Race[], label: (r?: Race) => string) {
  const { inherited, malus } = effectiveRace(c, races);
  if (!inherited && !malus) return '';
  if (inherited && malus && inherited.id === malus.id) return `con sangue ${label(inherited).toLowerCase()}`;
  return [inherited && `bonus da ${label(inherited)}`, malus && `malus da ${label(malus)}`].filter(Boolean).join(', ');
}

export function compute(c: Character, catalog: Ability[], races: Race[]): Computed {
  const abil = c.abilita.map((id) => catalog.find((a) => a.id === id)).filter(Boolean) as Ability[];
  const { bonusDa: rEff, malusDa: rMalus } = effectiveRace(c, races);

  // PF
  const fontiPf = ['Base: 2'];
  let pf = 2;
  for (const a of abil) if (a.effetti?.pf) { pf += a.effetti.pf; fontiPf.push(`${a.nome}: +${a.effetti.pf}`); }
  if (rEff?.effetti?.pf) { pf += rEff.effetti.pf; fontiPf.push(`${rEff.bonusNome}: +${rEff.effetti.pf}`); }

  // Armature consentite
  const permesse = new Set<ArmorType>(['nessuna']);
  for (const a of abil) if (a.effetti?.armatura) permesse.add(a.effetti.armatura);
  const haCompleta = abil.some((a) => a.effetti?.completa);
  const armaturePermesse = ARMOR_ORDER.filter((t) => permesse.has(t));

  const eq = c.equipaggiamento;
  // Combattente Esperto: +1 PA solo nelle locazioni dove l'armatura è effettivamente indossata
  const bonusRazzaPa = rEff?.effetti?.paSeArmato ?? 0;

  // Armatura Completa: una sola dichiarazione per tutto il corpo. Vale solo se il PG ha l'abilità,
  // indossa un'armatura (consentita) su tutte le locazioni e l'armatura copre almeno l'80% del corpo.
  const tuttoArmato = LOCAZIONI.every((l) => { const a = eq[l.id]?.armatura ?? 'nessuna'; return a !== 'nessuna' && permesse.has(a); });
  const completaPossibile = haCompleta && tuttoArmato;
  const completaAttiva = completaPossibile && !!eq.completa;

  const fontiPa: string[] = [];
  if (completaAttiva) fontiPa.push('Armatura Completa: +1 in tutte le locazioni');
  if (rEff?.effetti?.paSeArmato) fontiPa.push(`${rEff.bonusNome}: +${rEff.effetti.paSeArmato} in ogni locazione coperta da armatura`);

  const avvisi: string[] = [];
  const locazioni: LocStats[] = LOCAZIONI.map((l) => {
    const e = eq[l.id] ?? { armatura: 'nessuna' as ArmorType };
    let pa = 0;
    let avviso: string | undefined;
    if (e.armatura !== 'nessuna') {
      if (permesse.has(e.armatura)) {
        pa += ARMOR[e.armatura].pa;
        if (completaAttiva) pa += 1;
        pa += bonusRazzaPa;
      } else {
        avviso = `Non hai l’abilità per l’armatura ${ARMOR[e.armatura].nome.toLowerCase()}: 0 PA`;
      }
    }
    return { id: l.id, nome: l.nome, vitale: l.vitale, pf, pa, pl: pf + pa, armatura: e.armatura, avviso };
  });

  const pesanti = LOCAZIONI.filter((l) => ['anelli', 'piastre'].includes(eq[l.id]?.armatura));
  // Potere: per ogni via il livello più alto posseduto
  const best = new Map<ViaPotere, number>();
  for (const a of abil) {
    const p = a.effetti?.potere;
    if (p && (best.get(p.via) ?? 0) < p.livello) best.set(p.via, p.livello);
  }
  const potere: PowerStats[] = [...best.entries()].map(([via, livello]) => {
    const t = POWER_TABLE[via];
    const v = t.valori[Math.min(livello, t.valori.length) - 1];
    return { via, nome: t.nome, livello, livelloNome: LIVELLI[livello - 1], risorsa: t.risorsa, ...v };
  });

  if (pesanti.length && (best.has('mago') || best.has('stregone'))) {
    avvisi.push('Con un’armatura ad anelli o di piastre non puoi usare la Magia Arcana.');
  }
  if (LOCAZIONI.some((l) => eq[l.id]?.armatura === 'piastre')) avvisi.push('Con l’armatura di piastre non puoi combattere con due armi.');
  for (const l of locazioni) if (l.avviso) avvisi.push(`${l.nome}: ${l.avviso}`);

  const note: string[] = [];
  if (rMalus?.effetti?.malusNotte) note.push('Di notte, dal tramonto all’alba, hai 1 PF in meno in ogni locazione.');
  if (rEff?.id === 'umano-centrale') note.push('Benedizione Minore: 1 Miracolo Minore al Giorno di Gioco senza spendere PP.');

  return { locazioni, pfBase: pf, fontiPf, fontiPa, potere, note, avvisi, armaturePermesse, haCompleta, completaPossibile, completaAttiva };
}
