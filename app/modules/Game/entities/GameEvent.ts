/**
 * GameEvent represents a discrete action that occurred during the game.
 * The server emits these alongside the final GameState so clients can
 * animate what happened, in order, without the server waiting for animations.
 *
 * Extensibility: to add a new animation, add a new variant here (server),
 * mirror it in platform-ui/services/websocket.ts, push it in GameService,
 * and add a handler to the client animationRegistry.
 */
export type GameEvent =
  | {
      type: 'CARD_PLAYED';
      byPlayerKey: 'player1' | 'player2';
      gameCardId: string;
      boardIndex: number; // 0-based index where the card landed on the board
    }
  | {
      type: 'ATTACK';
      attackerGameCardId: string;
      targetType: 'monster' | 'player';
      targetGameCardId?: string; // undefined when targeting the player
    };
  // Future events to add here:
  // | { type: 'CARD_DIED'; gameCardId: string }
  // | { type: 'DRAW_CARD'; byPlayerKey: 'player1' | 'player2'; gameCardId: string }
  // | { type: 'SPELL_CAST'; ... }
