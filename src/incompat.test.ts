import { describe, expect, it } from 'vitest';
import { ALL_ABILITIES } from './data/abilities';
import { motivoIncompatibile } from './incompat';

const ab = (id: string) => ALL_ABILITIES.find((a) => a.id === id)!;
describe('Poteri incompatibili', () => {
  it('Dono Arcano blocca Legame Divino (tutti i livelli) e Conoscenze Magiche', () => {
    expect(motivoIncompatibile(ab('legame-divino-1'), ['dono-arcano-1'], ALL_ABILITIES)).toMatch(/Dono Arcano/);
    expect(motivoIncompatibile(ab('legame-divino-2'), ['dono-arcano-1'], ALL_ABILITIES)).toMatch(/Dono Arcano/);
    expect(motivoIncompatibile(ab('conoscenze-magiche'), ['dono-arcano-1'], ALL_ABILITIES)).toMatch(/Dono Arcano/);
  });
  it('Conoscenze Magiche non blocca Studio Arcano', () =>
    expect(motivoIncompatibile(ab('studio-arcano-1'), ['conoscenze-magiche'], ALL_ABILITIES)).toBeNull());
  it('Legame Divino blocca Alchimia e Rune', () => {
    expect(motivoIncompatibile(ab('alchimia-1'), ['legame-divino-1'], ALL_ABILITIES)).not.toBeNull();
    expect(motivoIncompatibile(ab('aett-3'), ['legame-divino-1'], ALL_ABILITIES)).not.toBeNull();
  });
  it('abilità non sovrannaturali: mai bloccate', () =>
    expect(motivoIncompatibile(ab('contare'), ['dono-arcano-1'], ALL_ABILITIES)).toBeNull());
});
