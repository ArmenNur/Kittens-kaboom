import { CARD_TYPES, SINGLE_PLAYABLE, describePlay } from '@shared/cards.js';

/**
 * Client-side mirror of the server's combo rules, used to label the Play button
 * and decide whether a target / named card is needed. The server re-validates everything.
 */
export function analyzeSelection(cards) {
  if (!cards.length) return null;
  const types = cards.map((c) => c.type);
  const same = types.every((t) => t === types[0]);

  if (cards.length === 1) {
    const t = types[0];
    if (SINGLE_PLAYABLE.has(t)) {
      return { kind: t, needsTarget: t === 'favor', needsName: false, label: `Play ${CARD_TYPES[t].name}` };
    }
    if (t === 'nope') return { error: 'Nope is played against other actions (button appears when you can).' };
    if (t === 'defuse') return { error: 'Defuse is used automatically when you draw a Kaboom Kitten.' };
    return { error: `Select a matching ${CARD_TYPES[t].name} to steal from someone.` };
  }
  if (cards.length === 2 && same) {
    return { kind: 'pair', needsTarget: true, needsName: false, label: 'Play pair → steal random card' };
  }
  if (cards.length === 3 && same) {
    return { kind: 'triple', needsTarget: true, needsName: true, label: 'Play three → ask for a card' };
  }
  if (cards.length === 5 && new Set(types).size === 5) {
    return { kind: 'five', needsTarget: false, needsName: false, label: 'Play five → pick from discard' };
  }
  return { error: 'Combos: 2 or 3 matching cards, or 5 all-different cards.' };
}

export function playDescription(pending) {
  return describePlay(pending.kind, pending.cardTypes);
}
