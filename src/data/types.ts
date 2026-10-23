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
  /** PF aggiuntivi in tutte le locazioni (si sommano se l'abilità è presa più volte) */
  pf?: number;
  /** PA aggiuntivi in ogni locazione coperta da un'armatura (es. Combattente Esperto) */
  paSeArmato?: number;
  /** abilita a indossare questo tipo di armatura */
  armatura?: ArmorType;
  /** Armatura Completa: +1 PA in tutte le locazioni se l'armatura copre almeno l'80% del corpo */
  completa?: boolean;
  /** dà accesso a una via sovrannaturale a un certo livello (1 Minore … 4 Assoluto, 5 Puro) */
  potere?: { via: ViaPotere; livello: 1 | 2 | 3 | 4 | 5 };
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
  // dal database dello staff (foglio Abilità)
  codice?: string;
  /** Sephira minima per apprenderla */
  sephira?: number;
  /** titolo o carica richiesti: "A, B" = servono entrambi, "A / B" = basta uno */
  titolo?: string;
  /** TAG del foglio: professione o ramo a cui appartiene */
  gruppo?: string;
  /** eventi di apprendimento per disciplina: 0 = nessun tempo, 'NI' = non insegnabile */
  tempi?: Partial<Record<Categoria, number | 'NI'>>;
  segreta?: boolean;
  riacquistabile?: boolean;
  temporanea?: boolean;
  limitata?: boolean;
  nonInsegnabile?: boolean;
  /** appunti interni dello staff */
  note?: string;
  /** nomi delle tabelle speciali collegate (tabelle.json) */
  tabelle?: string[];
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
  /** non si sceglie in creazione: 'png' = solo per i personaggi dei Master; 'gioco' = la assegnano i Master durante il gioco */
  soloStaff?: 'png' | 'gioco';
  /** bonus e malus presi dal database dello staff: le abilità di Sephira 0 con questo titolo (es. "Senza Fato") */
  trattiDa?: string;
}

export interface Spell {
  id: string;
  nome: string;
  tipo: 'incantesimo' | 'miracolo' | 'runa' | 'cerchio';
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
  codice?: string;
  genere?: string;
  /** riassunto dello staff (Descrizione Breve) */
  breve?: string;
  /** segreto: non compare tra le scelte dei giocatori */
  segreto?: boolean;
  brevetto?: string;
  /** livello Master: solo staff, i giocatori lo ottengono solo da oggetti, suppliche o rituali */
  master?: boolean;
  proibito?: boolean;
  /** solo Rune */
  lettera?: string;
  significato?: string;
  notaStaff?: string;
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

export interface DatiDocumento { titolo?: string; nome?: string; razza?: string; professione?: string; varie?: string }

export interface Character {
  id: string;
  giocatore: string;
  nome: string;
  cognome: string;
  provenienza: string;
  razza: string;
  /** solo Mezz'Elfo: id della razza da cui eredita bonus/malus */
  razzaEreditata?: string;   // Mezz'Elfo: razza da cui eredita il bonus
  razzaMalus?: string;       // Mezz'Elfo: razza da cui eredita il malus (se manca, la stessa del bonus)
  professione: string;
  professioneAvanzata?: string;
  divinita?: string;
  elemento?: string;
  /** altri elementi oltre al principale (un mago può averne più di uno) */
  altriElementi?: string[];
  eta?: number;
  sephire: number;
  abilita: string[];
  slot: Partial<Record<Categoria, SlotApprendimento>>;
  incantesimi: string[];
  /** falsa identità: i dati scritti sul documento (pagina Identità del libretto); i campi normali sono i dati reali,
   *  stampati nella pagina "Incongruenze d'identità". Un campo vuoto vale come quello reale. */
  documento?: DatiDocumento;
  /** foto del volto (immagine piccola salvata nella scheda, data URL JPEG) */
  foto?: string;
  /** titoli e cariche assegnati dallo staff (Fyrd e la razza valgono già da sé) */
  titoli?: string[];
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
  /** immagine banner (indirizzo pubblico) */
  banner?: string;
  iscrizioniAperte: boolean;
  prezzi: { giorno1: number | null; giorno1Pernotto: number | null; giorni2: number | null; pernottoVenerdi: number | null; pernottoDomenica: number | null; pranzoSabato: number | null; cenaVenerdi?: number | null; cenaDomenica?: number | null };
  pagamento: { iban: string; intestatario: string; paypal: string; causale: string };
}

export type Biglietto = '1 giorno' | '1 giorno + pernotto' | '2 giorni';
export interface DatiIscrizione {
  nome: string; cognome: string; nomePg: string;
  nuovoGiocatore: boolean; associato: boolean; email: string;
  biglietto: Biglietto; pernottoVenerdi: boolean; pernottoDomenica: boolean; pranzoSabato: boolean; cenaVenerdi?: boolean; cenaDomenica?: boolean;
  pagamento: 'PayPal' | 'Bonifico'; note?: string;
}
export interface Iscrizione { id: string; eventoId: string; utente: string; dati: DatiIscrizione; creata: string; pagata: boolean }

export interface Nota { id: string; titolo: string; testo: string; categoria: string; aggiornata: string }

export type TipoMissiva = 'normale' | 'assicurata' | 'rapida' | 'runica';
export interface Missiva {
  id: string; utente: string; personaggioId: string | null; mittente: string;
  tipo: TipoMissiva; destinatario: string; testo: string; inviata: string;
  stato: 'inviata' | 'letta' | 'risposta'; risposta?: string; rispostaIl?: string; rispostaLetta?: string;
}
export interface Impostazioni {
  /** costo in Astri d'Argento (AA); rispostaApp: lo staff può rispondere dall'app */
  missive: Record<TipoMissiva, { costo: number; descrizione: string; rispostaApp: boolean }>;
  /** gli addebiti delle missive contano solo le missive spedite dopo questo momento (azzeramento dello staff) */
  addebitiAzzeratiIl?: string;
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

/** Missiva scritta dallo staff (mittente libero, es. un PNG) a un personaggio; il giocatore non può rispondere */
export interface MissivaStaff {
  id: string; personaggioId: string | null; utente: string | null; destinatario: string;
  mittente: string; testo: string; inviata: string; letta?: string;
}
