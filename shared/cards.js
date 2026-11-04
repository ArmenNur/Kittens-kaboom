// Card catalogue shared by the server (rules) and the browser (rendering).
// Original names/art — mechanics inspired by the classic "don't draw the bomb" party game.

export const CARD_TYPES = {
  kaboom: {
    name: 'Kaboom Kitten',
    icon: '💣',
    art: '🙀',
    desc: 'You drew a ticking kitten. Play a Defuse or you are OUT.',
    flavor: 'tick… tick… meow',
    colors: ['#2b0a0a', '#120202'],
    accent: '#ff3b3b',
    group: 'kaboom',
  },
  defuse: {
    name: 'Defuse',
    icon: '🧯',
    art: '🔦',
    desc: 'Saves you from a Kaboom Kitten. Then sneak it back into the deck anywhere.',
    flavor: 'distract it with a laser pointer',
    colors: ['#2fbf71', '#127a45'],
    accent: '#b7ffd6',
    group: 'defuse',
  },
  attack: {
    name: 'Attack',
    icon: '⚔️',
    art: '🦖',
    desc: 'End your turn without drawing. The next player takes 2 turns. Attacks stack.',
    flavor: 'unleash the cat-o-saurus',
    colors: ['#ff6a3d', '#c4280e'],
    accent: '#ffe0d4',
    group: 'action',
  },
  skip: {
    name: 'Skip',
    icon: '⏭️',
    art: '😴',
    desc: 'End one turn without drawing a card.',
    flavor: 'nap time. do not disturb.',
    colors: ['#3d8bff', '#1a4fc4'],
    accent: '#d6e6ff',
    group: 'action',
  },
  favor: {
    name: 'Favor',
    icon: '🎁',
    art: '🥺',
    desc: 'Pick a player. They must give you a card of their choice.',
    flavor: 'big eyes, bigger demands',
    colors: ['#ff6fb5', '#c7287a'],
    accent: '#ffe0f0',
    group: 'action',
  },
  shuffle: {
    name: 'Shuffle',
    icon: '🔀',
    art: '🌪️',
    desc: 'Shuffle the draw pile.',
    flavor: 'zoomies in the card box',
    colors: ['#9b5cff', '#5d22c9'],
    accent: '#ece0ff',
    group: 'action',
  },
  nope: {
    name: 'Nope',
    icon: '🚫',
    art: '🙅',
    desc: 'Cancel any action (not a Kaboom or Defuse). Play any time. A Nope can be Noped.',
    flavor: 'nope. nope. nope.',
    colors: ['#4a4a5a', '#1f1f29'],
    accent: '#ff5d5d',
    group: 'nope',
  },
  future: {
    name: 'See the Future',
    icon: '🔮',
    art: '👁️',
    desc: 'Privately peek at the top 3 cards of the draw pile.',
    flavor: 'the yarn ball knows all',
    colors: ['#5b4bff', '#2a1d9e'],
    accent: '#e2deff',
    group: 'action',
  },
  alter: {
    name: 'Alter the Future',
    icon: '🪄',
    art: '🧿',
    desc: 'Peek at the top 3 cards and put them back in any order you like.',
    flavor: 'fate is just a suggestion',
    colors: ['#14b8a6', '#0b6e63'],
    accent: '#d2fff9',
    group: 'action',
    expansion: true,
  },
  reverse: {
    name: 'Reverse',
    icon: '🔄',
    art: '🌀',
    desc: 'Reverse the turn order and end your turn without drawing.',
    flavor: 'chasing its own tail',
    colors: ['#f5b40b', '#b77a00'],
    accent: '#fff3cf',
    group: 'action',
    expansion: true,
  },
  bottom: {
    name: 'Draw from Bottom',
    icon: '⤵️',
    art: '🕳️',
    desc: 'End your turn by drawing the BOTTOM card of the draw pile.',
    flavor: 'dig from the other side',
    colors: ['#a0703e', '#6b4520'],
    accent: '#ffe8cf',
    group: 'action',
    expansion: true,
  },
  pizzacat: {
    name: 'Pizza Cat',
    icon: '🍕',
    art: '🐱',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'extra cheese, extra claws',
    colors: ['#ffcf6b', '#e8892b'],
    accent: '#fff4dc',
    group: 'cat',
  },
  discocat: {
    name: 'Disco Cat',
    icon: '🪩',
    art: '😼',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'stayin’ alive (9 times)',
    colors: ['#ff8ae2', '#8a3dff'],
    accent: '#ffe6fa',
    group: 'cat',
  },
  ninjacat: {
    name: 'Ninja Cat',
    icon: '🥷',
    art: '😾',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'you never heard it coming',
    colors: ['#6b7280', '#262b36'],
    accent: '#e5e7eb',
    group: 'cat',
  },
  wizardcat: {
    name: 'Wizard Cat',
    icon: '🧙',
    art: '😸',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'casts “knock it off the table”',
    colors: ['#38bdf8', '#4338ca'],
    accent: '#e0f2fe',
    group: 'cat',
  },
  spacecat: {
    name: 'Space Cat',
    icon: '🚀',
    art: '😺',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'one small step for paws',
    colors: ['#1e293b', '#7c3aed'],
    accent: '#ddd6fe',
    group: 'cat',
  },
};

export const CAT_TYPES = ['pizzacat', 'discocat', 'ninjacat', 'wizardcat', 'spacecat'];

// Cards that may be played by themselves on your turn.
export const SINGLE_PLAYABLE = new Set([
  'attack', 'skip', 'favor', 'shuffle', 'future', 'alter', 'reverse', 'bottom',
]);

// Per "pack" (one pack supports up to 5 players; 6-10 players use two packs).
const PACK = {
  attack: 4, skip: 4, favor: 4, shuffle: 4, nope: 5, future: 5,
  pizzacat: 4, discocat: 4, ninjacat: 4, wizardcat: 4, spacecat: 4,
};
const EXPANSION_PACK = { alter: 4, reverse: 4, bottom: 4 };

export const HAND_SIZE = 4; // plus one Defuse each
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

/**
 * Describes the deck for a given player count.
 * main: card types that are dealt from (no kabooms / defuses)
 * extraDefuses: defuses shuffled into the draw pile after dealing
 * kabooms: kaboom kittens shuffled in after dealing (always players - 1)
 */
export function deckSpec(playerCount, expansion = false) {
  const packs = playerCount <= 5 ? 1 : 2;
  const main = [];
  const add = (counts) => {
    for (const [type, n] of Object.entries(counts)) {
      for (let i = 0; i < n * packs; i++) main.push(type);
    }
  };
  add(PACK);
  if (expansion) add(EXPANSION_PACK);
  const extraDefuses = Math.max(1, Math.min(2, packs * 6 - playerCount));
  return { main, extraDefuses, kabooms: playerCount - 1 };
}

export function describePlay(kind, cardTypes) {
  if (kind === 'pair') return `a pair of ${CARD_TYPES[cardTypes[0]].name}`;
  if (kind === 'triple') return `three ${CARD_TYPES[cardTypes[0]].name}`;
  if (kind === 'five') return 'five different cards';
  return CARD_TYPES[kind]?.name ?? kind;
}
