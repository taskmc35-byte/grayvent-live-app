import type { Character } from './data/types';
/** Il personaggio ha una falsa identità con almeno un dato del documento compilato */
export const haDocumento = (pg: Pick<Character, 'documento'>) => !!pg.documento && Object.values(pg.documento).some((v) => (v ?? '').trim());
