import { GameCard } from './GameCard';

export interface PlayerState {
  userId: string;         // UUID
  health: number;
  gold: number;
  hand: GameCard[];        // Array of GameCard instances
  board: GameCard[];      // Array of GameCard instances (max 5)
  deck: GameCard[];       // Array of GameCard instances
}

export interface GameState {
  id: string;              // UUID
  player1: PlayerState;
  player2: PlayerState;
  currentTurn: 'player1' | 'player2';
  turnNumber: number;
  status: 'waiting' | 'active' | 'finished';
  winner?: string;         // UUID of winning player
  createdAt: Date;
}
