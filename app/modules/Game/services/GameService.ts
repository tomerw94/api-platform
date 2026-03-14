import { prisma } from '../../../lib/prisma';
import { GameState, PlayerState } from '../entities/GameState';
import { GameCard } from '../entities/GameCard';
import { GameEvent } from '../entities/GameEvent';
import { v4 as uuidv4 } from 'uuid';

export class GameService {
  private events: GameEvent[] = [];

  /**
   * Returns all queued events since the last drain and clears the queue.
   * Call this in broadcastGameState to include events in the GAME_STATE payload.
   */
  drainEvents(): GameEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }
  /**
   * Initialize a new game between two players
   */
  async initializeGame(player1Id: string, player2Id: string): Promise<GameState> {
    // Fetch decks for both players
    const [player1Deck, player2Deck] = await Promise.all([
      this.getPlayerDeck(player1Id),
      this.getPlayerDeck(player2Id),
    ]);

    // Convert deck cards to GameCard instances
    const player1GameCards = this.createGameCards(player1Deck);
    const player2GameCards = this.createGameCards(player2Deck);

    // Shuffle decks
    this.shuffleArray(player1GameCards);
    this.shuffleArray(player2GameCards);

    // Draw initial 3 cards for each player
    const player1Hand = player1GameCards.splice(0, 3);
    const player2Hand = player2GameCards.splice(0, 3);

    // Randomly select starting player
    const startingPlayer = Math.random() < 0.5 ? 'player1' : 'player2';

    // Initialize player states
    const player1State: PlayerState = {
      userId: player1Id,
      health: 30,
      gold: startingPlayer === 'player1' ? 1 : 0,
      hand: player1Hand,
      board: [],
      deck: player1GameCards,
    };

    const player2State: PlayerState = {
      userId: player2Id,
      health: 30,
      gold: startingPlayer === 'player2' ? 1 : 0,
      hand: player2Hand,
      board: [],
      deck: player2GameCards,
    };

    // Create game state
    const gameState: GameState = {
      id: uuidv4(),
      player1: player1State,
      player2: player2State,
      currentTurn: startingPlayer,
      turnNumber: 1,
      status: 'active',
      createdAt: new Date(),
    };

    return gameState;
  }

  /**
   * Get player's default deck from database
   */
  private async getPlayerDeck(userId: string): Promise<any[]> {
    const deck = await prisma.deck.findFirst({
      where: { userId },
      include: {
        cards: {
          include: {
            card: true,
          },
        },
      },
    });

    if (!deck) {
      throw new Error(`No deck found for user ${userId}`);
    }

    // Return array of card data
    return deck.cards.map(ctd => ctd.card);
  }

  /**
   * Convert DB Card records to GameCard instances
   */
  private createGameCards(cards: any[]): GameCard[] {
    return cards.map(card => ({
      gameCardId: uuidv4(),
      cardId: card.id,
      name: card.name,
      description: card.description || card.name,
      cost: card.cost,
      power: card.power,
      maxHealth: card.health,
      health: card.health,
      image: card.image ?? undefined,
    }));
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Play a card from hand to board
   */
  playCard(gameState: GameState, playerKey: 'player1' | 'player2', gameCardId: string): void {
    const player = gameState[playerKey];

    // Find card in hand
    const cardIndex = player.hand.findIndex(c => c.gameCardId === gameCardId);
    if (cardIndex === -1) {
      throw new Error('Card not found in hand');
    }

    const card = player.hand[cardIndex];

    // Validate gold
    if (card.cost > player.gold) {
      throw new Error('Not enough gold to play this card');
    }

    // Validate board space
    if (player.board.length >= 5) {
      throw new Error('Board is full (max 5 cards)');
    }

    // Validate it's player's turn
    if (gameState.currentTurn !== playerKey) {
      throw new Error('Not your turn');
    }

    // Move card from hand to board (rightmost position = push to end)
    player.hand.splice(cardIndex, 1);
    player.board.push(card);
    const boardIndex = player.board.length - 1;

    // Deduct gold
    player.gold -= card.cost;

    this.events.push({ type: 'CARD_PLAYED', byPlayerKey: playerKey, gameCardId, boardIndex });
  }

  /**
   * Attack with a card
   */
  attack(
    gameState: GameState,
    attackerKey: 'player1' | 'player2',
    attackerGameCardId: string,
    targetType: 'monster' | 'player',
    targetGameCardId?: string
  ): void {
    const attacker = gameState[attackerKey];
    const defender = attackerKey === 'player1' ? gameState.player2 : gameState.player1;

    // Validate it's attacker's turn
    if (gameState.currentTurn !== attackerKey) {
      throw new Error('Not your turn');
    }

    // Find attacker card on board
    const attackerCard = attacker.board.find(c => c.gameCardId === attackerGameCardId);
    if (!attackerCard) {
      throw new Error('Attacker card not found on board');
    }

    this.events.push({ type: 'ATTACK', attackerGameCardId, targetType, targetGameCardId });

    if (targetType === 'monster') {
      if (!targetGameCardId) {
        throw new Error('Target monster ID required');
      }

      // Find target monster
      const targetCard = defender.board.find(c => c.gameCardId === targetGameCardId);
      if (!targetCard) {
        throw new Error('Target monster not found');
      }

      // Deal damage both ways
      targetCard.health -= attackerCard.power;
      attackerCard.health -= targetCard.power;

      // Remove dead cards
      defender.board = defender.board.filter(c => c.health > 0);
      attacker.board = attacker.board.filter(c => c.health > 0);
    } else {
      // Attack player directly
      defender.health -= attackerCard.power;
    }

    // Check win condition
    this.checkWinCondition(gameState);
  }

  /**
   * End turn
   */
  endTurn(gameState: GameState, playerKey: 'player1' | 'player2'): void {
    // Validate it's player's turn
    if (gameState.currentTurn !== playerKey) {
      throw new Error('Not your turn');
    }

    const player = gameState[playerKey];

    // Switch turns
    const nextPlayerKey = playerKey === 'player1' ? 'player2' : 'player1';
    gameState.currentTurn = nextPlayerKey;
    gameState.turnNumber += 1;

    // Draw card for next player
    const nextPlayer = gameState[nextPlayerKey];
    if (nextPlayer.deck.length > 0) {
      const drawnCard = nextPlayer.deck.shift()!;
      nextPlayer.hand.push(drawnCard);
    }

    // Set gold for next turn (min of turn number and 10)
    nextPlayer.gold = Math.min(gameState.turnNumber, 10);
  }

  /**
   * Check win condition
   */
  private checkWinCondition(gameState: GameState): void {
    if (gameState.player1.health <= 0) {
      gameState.status = 'finished';
      gameState.winner = gameState.player2.userId;
    } else if (gameState.player2.health <= 0) {
      gameState.status = 'finished';
      gameState.winner = gameState.player1.userId;
    }
  }
}
