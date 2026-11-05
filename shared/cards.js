// Card catalogue shared by the server (rules) and the browser (rendering).
// Original names/art — mechanics inspired by the classic "don't draw the bomb" party game.

export const CARD_TYPES = {
  kaboom: {
    name: 'Kaboom Kitten',
    icon: '💣',
    art: '🙀',
    desc: 'You drew a ticking kitten. Play a Defuse or you are OUT.',
    flavor: 'tick… tick… meow',
    colors: ['#1b1b1b', '#000000'],
    accent: '#ff3b3b',
    group: 'kaboom',
  },
  defuse: {
    name: 'Defuse',
    icon: '🧯',
    art: '🔦',
    desc: 'Saves you from a Kaboom Kitten. Then sneak it back into the deck anywhere.',
    flavor: 'distract it with a laser pointer',
    colors: ['#7cc242', '#4e8f1f'],
    accent: '#c9f2a6',
    group: 'defuse',
  },
  attack: {
    name: 'Attack',
    icon: '⚔️',
    art: '🦖',
    desc: 'End your turn without drawing. The next player takes 2 turns. Attacks stack.',
    flavor: 'unleash the cat-o-saurus',
    colors: ['#f58220', '#c55a00'],
    accent: '#ffd2a8',
    group: 'action',
  },
  skip: {
    name: 'Skip',
    icon: '⏭️',
    art: '😴',
    desc: 'End one turn without drawing a card.',
    flavor: 'nap time. do not disturb.',
    colors: ['#1f8ad8', '#0b5ea3'],
    accent: '#bfe1ff',
    group: 'action',
  },
  favor: {
    name: 'Favor',
    icon: '🎁',
    art: '🥺',
    desc: 'Pick a player. They must give you a card of their choice.',
    flavor: 'big eyes, bigger demands',
    colors: ['#3a3a3a', '#151515'],
    accent: '#d4d4d4',
    group: 'action',
  },
  shuffle: {
    name: 'Shuffle',
    icon: '🔀',
    art: '🌪️',
    desc: 'Shuffle the draw pile.',
    flavor: 'zoomies in the card box',
    colors: ['#8a5a3b', '#5e3a22'],
    accent: '#ecd2bd',
    group: 'action',
  },
  nope: {
    name: 'Nope',
    icon: '🚫',
    art: '🙅',
    desc: 'Cancel any action (not a Kaboom or Defuse). Play any time. A Nope can be Noped.',
    flavor: 'nope. nope. nope.',
    colors: ['#e2231a', '#a10f08'],
    accent: '#ffc2bf',
    group: 'nope',
  },
  future: {
    name: 'See the Future',
    icon: '🔮',
    art: '👁️',
    desc: 'Privately peek at the top 3 cards of the draw pile.',
    flavor: 'the yarn ball knows all',
    colors: ['#e6007e', '#a3005a'],
    accent: '#ffc0e3',
    group: 'action',
  },
  alter: {
    name: 'Alter the Future',
    icon: '🪄',
    art: '🧿',
    desc: 'Peek at the top 3 cards and put them back in any order you like.',
    flavor: 'fate is just a suggestion',
    colors: ['#7b3fa0', '#4f1f70'],
    accent: '#e3c8f5',
    group: 'action',
    expansion: true,
  },
  reverse: {
    name: 'Reverse',
    icon: '🔄',
    art: '🌀',
    desc: 'Reverse the turn order and end your turn without drawing.',
    flavor: 'chasing its own tail',
    colors: ['#f2b600', '#b88700'],
    accent: '#ffe9a3',
    group: 'action',
    expansion: true,
  },
  bottom: {
    name: 'Draw from Bottom',
    icon: '⤵️',
    art: '🕳️',
    desc: 'End your turn by drawing the BOTTOM card of the draw pile.',
    flavor: 'dig from the other side',
    colors: ['#00a19a', '#006b66'],
    accent: '#b5f0ec',
    group: 'action',
    expansion: true,
  },
  pizzacat: {
    name: 'Pizza Cat',
    icon: '🍕',
    art: '🐱',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'extra cheese, extra claws',
    colors: ['#f9a825', '#c77800'],
    accent: '#ffe3a8',
    group: 'cat',
  },
  discocat: {
    name: 'Disco Cat',
    icon: '🪩',
    art: '😼',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'stayin’ alive (9 times)',
    colors: ['#c44dff', '#8a1fc4'],
    accent: '#f1ccff',
    group: 'cat',
  },
  ninjacat: {
    name: 'Ninja Cat',
    icon: '🥷',
    art: '😾',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'you never heard it coming',
    colors: ['#5f6670', '#33383f'],
    accent: '#dde1e6',
    group: 'cat',
  },
  wizardcat: {
    name: 'Wizard Cat',
    icon: '🧙',
    art: '😸',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'casts “knock it off the table”',
    colors: ['#29b6f6', '#0277bd'],
    accent: '#c4ecff',
    group: 'cat',
  },
  spacecat: {
    name: 'Space Cat',
    icon: '🚀',
    art: '😺',
    desc: 'Does nothing alone. Play matching cards as a combo to steal.',
    flavor: 'one small step for paws',
    colors: ['#4b3fa8', '#2b2270'],
    accent: '#d5d0ff',
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
