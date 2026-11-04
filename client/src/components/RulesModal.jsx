import { CARD_TYPES } from '@shared/cards.js';
import { Modal } from './Modal.jsx';
import { Card } from './Card.jsx';
import s from './RulesModal.module.css';

const ACTIONS = ['kaboom', 'defuse', 'nope', 'attack', 'skip', 'favor', 'shuffle', 'future', 'alter', 'reverse', 'bottom'];
const CATS = ['pizzacat', 'discocat', 'ninjacat', 'wizardcat', 'spacecat'];

export function RulesModal({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="How to play"
      subtitle="Be the last kitten standing. Draw a Kaboom Kitten without a Defuse and you're out."
      actions={<button className="btn btn-primary" onClick={onClose}>Got it</button>}
    >
      <div className={s.rules}>
        <h3>Your turn</h3>
        <ol>
          <li>Play as many cards as you like (or none).</li>
          <li>End your turn by <b>drawing a card</b> from the deck (click the deck).</li>
        </ol>
        <p>Skip and Attack end your turn <i>without</i> drawing.</p>
        <h3>Kaboom Kittens 💣</h3>
        <p>
          There is always one fewer Kaboom Kitten than there are players. If you draw one you need a <b>Defuse</b>.
          Then you secretly put the kitten back into the deck at any position. No Defuse means you're out.
        </p>
        <h3>Nope 🚫</h3>
        <p>
          Every action gets a short window when anyone can play a <b>Nope</b> to cancel it. A Nope can be Noped back.
          Kaboom Kittens and Defuses can't be Noped.
        </p>
        <h3>Combos</h3>
        <ul>
          <li><b>Two of a kind</b>: steal a random card from a player.</li>
          <li><b>Three of a kind</b>: name a card. If that player has it, they must give it to you.</li>
          <li><b>Five different cards</b>: take any card from the discard pile.</li>
        </ul>
        <h3>Cards</h3>
        <div className={s.grid}>
          {ACTIONS.map((t) => (
            <div key={t} className={s.cell}>
              <Card type={t} size="sm" />
              <div>
                <b>{CARD_TYPES[t].name}</b>
                {CARD_TYPES[t].expansion && <span className="tag" style={{ marginLeft: 6 }}>party pack</span>}
                <p>{CARD_TYPES[t].desc}</p>
              </div>
            </div>
          ))}
        </div>
        <h3>Cat cards</h3>
        <div className={s.cats}>
          {CATS.map((t) => <Card key={t} type={t} size="sm" />)}
        </div>
        <p className="muted">Cat cards do nothing alone. Use them in combos.</p>
        <h3>Shortcuts</h3>
        <p className="muted"><kbd>D</kbd> draw · <kbd>N</kbd> nope · <kbd>Enter</kbd> play selected · <kbd>Esc</kbd> clear selection</p>
      </div>
    </Modal>
  );
}
