// Tipi condivisi dell'app Grayvent

export type LocId = 'tronco' | 'braccioDx' | 'braccioSx' | 'gambaDx' | 'gambaSx';
export const LOCAZIONI: { id: LocId; nome: string; vitale: boolean }[] = [
  { id: 'tronco', nome: 'Tronco', vitale: true },
  { id: 'braccioDx', nome: 'Braccio destro', vitale: false },
  { id: 'braccioSx', nome: 'Braccio sinistro', vitale: false },
  { id: 'gambaDx', nome: 'Gamba destra', vitale: false },
  { id: 'gambaSx', nome: 'Gamba sinistra', vitale: false },
];

export type ArmorType = 'nessuna' | 'cuoio' | 'cuoioLavorato' | 'anelli' | 'piastre';
export type Categoria = 'fisico' | 'mentale' | 'sovrannaturale';
export type ViaPotere = 'mago' | 'stregone' | 'sacerdote' | 'alchimista' | 'runista';

export interface AbilityEffects {
  /** PF aggiuntivi in tutte le locazioni */
  pf?: number;
  /** abilita a indossare questo tipo di armatura */
  armatura?: ArmorType;
  /** Armatura Completa: +1 PA in tutte le locazioni se l'armatura copre almeno l'80% del corpo */
  completa?: boolean;
  /** dà accesso a una via sovrannaturale a un certo livello (1 Minore … 4 Assoluto) */
  potere?: { via: ViaPotere; livello: 1 | 2 | 3 | 4 };
}

export interface Ability {
  id: string;
  nome: string;
  categoria: Categoria;
  tipo: 'base' | 'avanzata';
  pc?: number | null;
  tda?: number | null;
  prerequisiti?: string;
  descrizione: string;
  soloCreazione?: boolean;
  effetti?: AbilityEffects;
}

export interface Race {
  id: string;
  nome: string;
  /** sottotitolo, es. il feudo per gli umani */
  origine?: string;
  dei?: string;
  longevita?: string;
  bonusNome: string;
  bonus: string;
  malus: string;
  effetti?: {
    pf?: number;
    /** -1 PF di notte: mostrato come nota */
    malusNotte?: boolean;
    /** +1 PA in tutte le locazioni se indossa un'armatura qualsiasi */
    paSeArmato?: number;
  };
  abilitaObbligatorie?: string[];
  abilitaVietate?: string[];
  /** il Mezz'Elfo eredita bonus/malus da un'altra razza, scelta dai Master */
  ereditaDaScelta?: boolean;
}

export interface Spell {
  id: string;
  nome: string;
  tipo: 'incantesimo' | 'miracolo';
  scuola: string;
  livello: string;
  flavor: string;
  formula: string;
  aggiunta: string;
  descrizione: string;
  gittata: string;
  bersaglio: string;
  lancio: string;
  durata: string;
}

export interface SlotApprendimento {
  abilita: string; // id o nome libero
  eventiTotali: number;
  eventiSvolti: number;
  insegnante: string;
  eventoInizio: string;
}

/** Armatura per locazione + la dichiarazione unica di Armatura Completa (copre almeno l'80% del corpo) */
export type Equipaggiamento = Record<LocId, { armatura: ArmorType }> & { completa?: boolean };

export interface Character {
  id: string;
  giocatore: string;
  nome: string;
  cognome: string;
  provenienza: string;
  razza: string;
  /** solo Mezz'Elfo: id della razza da cui eredita bonus/malus */
  razzaEreditata?: string;
  professione: string;
  professioneAvanzata?: string;
  divinita?: string;
  elemento?: string;
  eta?: number;
  sephire: number;
  abilita: string[];
  slot: Partial<Record<Categoria, SlotApprendimento>>;
  incantesimi: string[];
  note?: string;
  /** l'unica parte modificabile dal giocatore */
  equipaggiamento: Equipaggiamento;
  aggiornato?: string;
  /** schede create dal giocatore: restano 'in_approvazione' finché lo staff non le approva */
  stato?: StatoScheda;
  notaStaff?: string;
  bgTesto?: string;
  bgFile?: { path: string; nome: string };
  /** spunti narrativi del manuale inseriti nel background */
  spuntiBg?: string[];
  /** Talento 1 e Astri d'Oro dai PC avanzati in creazione */
  usiTalento?: number;
  astriOro?: number;
  /** campi del libretto cartaceo, compilati dallo staff */
  titolo?: string;
  varie?: string;
  /** "Abilità speciali e note" del libretto, una per riga */
  abilitaSpeciali?: string;
}

export type StatoScheda = 'approvato' | 'in_approvazione' | 'da_rivedere';

export interface Evento {
  id: string;
  titolo: string;
  dataInizio: string; // YYYY-MM-DD
  dataFine: string;
  luogo: string;
  descrizione: string;
  iscrizioniAperte: boolean;
  prezzi: { giorno1: number | null; giorno1Pernotto: number | null; giorni2: number | null; pernottoVenerdi: number | null; pernottoDomenica: number | null; pranzoSabato: number | null };
  pagamento: { iban: string; intestatario: string; paypal: string; causale: string };
}

export type Biglietto = '1 giorno' | '1 giorno + pernotto' | '2 giorni';
export interface DatiIscrizione {
  nome: string; cognome: string; nomePg: string;
  nuovoGiocatore: boolean; associato: boolean; email: string;
  biglietto: Biglietto; pernottoVenerdi: boolean; pernottoDomenica: boolean; pranzoSabato: boolean;
  pagamento: 'PayPal' | 'Bonifico'; note?: string;
}
export interface Iscrizione { id: string; eventoId: string; utente: string; dati: DatiIscrizione; creata: string; pagata: boolean }

export interface Nota { id: string; titolo: string; testo: string; categoria: string; aggiornata: string }

export type TipoMissiva = 'normale' | 'assicurata' | 'rapida' | 'runica';
export interface Missiva {
  id: string; utente: string; personaggioId: string | null; mittente: string;
  tipo: TipoMissiva; destinatario: string; testo: string; inviata: string;
  stato: 'inviata' | 'letta' | 'risposta'; risposta?: string; rispostaIl?: string;
}
export interface Impostazioni {
  /** costo in Astri d'Argento (AA); rispostaApp: lo staff può rispondere dall'app */
  missive: Record<TipoMissiva, { costo: number; descrizione: string; rispostaApp: boolean }>;
}

/** Chatbot "Chiedi ai manuali" */
export interface FonteManuale { manuale: string; titolo: string; pagina: number }
export interface RispostaChat { risposta: string; fonti: FonteManuale[]; rimaste?: number }
export interface ParteManuale { manuale: string; titolo: string; pagina: number; testo: string }
/** Domanda inviata allo staff quando la risposta del chatbot non basta */
export interface DomandaStaff {
  id: string; utente: string; domanda: string; rispostaBot?: string; messaggio?: string;
  stato: 'aperta' | 'risposta'; risposta?: string; rispostaIl?: string; creata: string;
}

/** Benedizione o Maledizione che affligge un personaggio (inserita dallo staff) */
export interface Afflizione {
  id: string; personaggioId: string; tipo: 'benedizione' | 'maledizione';
  nome: string; effetto: string; origine?: string; durata?: string;
  /** il giocatore non la vede */ nascosta: boolean;
  /** conclusa: resta solo nello storico dello staff */ terminata: boolean;
}

/** Manuale consultabile nell'app: di base (PDF incluso nell'app) o caricato dallo staff */
export interface Manuale {
  id: string; nome: string; descrizione: string; sigla: string; ordine: number;
  /** PDF caricato nell'archivio; assente = PDF di base dell'app */
  filePath?: string;
  nascosto: boolean;
  /** uno dei manuali inclusi nell'app */
  base: boolean;
}
