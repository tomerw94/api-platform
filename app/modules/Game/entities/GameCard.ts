/**
 * GameCard represents a card instance during gameplay.
 * These exist only in memory and are created from DB Card templates.
 * Each GameCard has a unique gameCardId (UUID) even if it's a copy of the same Card.
 */
export interface GameCard {
  gameCardId: string;      // UUID - unique per card instance in game
  cardId: string;          // UUID - reference to DB Card
  name: string;
  description: string;
  cost: number;
  power: number;
  maxHealth: number;
  health: number;          // Current health (can be damaged)
  image?: string;          // Filename of card art image
  playable?: boolean;      // Set by server when broadcasting: can this hand card be played?
  canAttack?: boolean;     // Set by server when broadcasting: can this board card attack?
}
