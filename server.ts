import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { gameQueue } from './app/modules/Game/queue';
import { GameService } from './app/modules/Game/services/GameService';
import { verifyToken } from './app/lib/auth';
import { GameState } from './app/modules/Game/entities/GameState';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const wsPort = parseInt(process.env.WS_PORT || '3001', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store active games and player connections
const activeGames = new Map<string, GameState>();
const playerConnections = new Map<string, { ws: any; gameId?: string; playerKey?: 'player1' | 'player2' }>();

const gameService = new GameService();

// WebSocket message types
interface WSMessage {
  type: string;
  payload?: any;
}

app.prepare().then(() => {
  // Create HTTP server for Next.js
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ port: wsPort });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');

    let userId: string | null = null;

    ws.on('message', async (message: Buffer) => {
      try {
        const data: WSMessage = JSON.parse(message.toString());
        console.log('Received message:', data.type);

        switch (data.type) {
          case 'AUTHENTICATE':
            // Authenticate user and add to queue
            try {
              const token = data.payload?.token;
              if (!token) {
                ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Token required' } }));
                return;
              }

              const payload = verifyToken(token);
              userId = payload.userId;

              // Store connection
              playerConnections.set(userId, { ws, gameId: undefined, playerKey: undefined });

              // Add to queue
              gameQueue.enqueue({ userId, socket: ws, queuedAt: new Date() });

              ws.send(JSON.stringify({ type: 'AUTHENTICATED', payload: { userId } }));

              // Try to match players
              const match = gameQueue.tryMatch();
              if (match) {
                await handleMatch(match.player1.userId, match.player2.userId);
              }
            } catch (error: any) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
            }
            break;

          case 'PLAY_CARD': {
            const conn = userId ? playerConnections.get(userId) : null;
            const gameId = conn?.gameId;
            const playerKey = conn?.playerKey;
            if (!userId || !gameId || !playerKey) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Not authenticated or not in game' } }));
              return;
            }

            try {
              const gameState = activeGames.get(gameId);
              if (!gameState) {
                ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Game not found' } }));
                return;
              }

              gameService.playCard(gameState, playerKey, data.payload.gameCardId);
              broadcastGameState(gameId, gameState);
            } catch (error: any) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
            }
            break;
          }

          case 'ATTACK': {
            const conn = userId ? playerConnections.get(userId) : null;
            const gameId = conn?.gameId;
            const playerKey = conn?.playerKey;
            if (!userId || !gameId || !playerKey) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Not authenticated or not in game' } }));
              return;
            }

            try {
              const gameState = activeGames.get(gameId);
              if (!gameState) {
                ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Game not found' } }));
                return;
              }

              gameService.attack(
                gameState,
                playerKey,
                data.payload.attackerGameCardId,
                data.payload.targetType,
                data.payload.targetGameCardId
              );
              broadcastGameState(gameId, gameState);

              if (gameState.status === 'finished') {
                broadcastGameEnd(gameId, gameState);
              }
            } catch (error: any) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
            }
            break;
          }

          case 'END_TURN': {
            const conn = userId ? playerConnections.get(userId) : null;
            const gameId = conn?.gameId;
            const playerKey = conn?.playerKey;
if (!userId || !gameId || !playerKey) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Not authenticated or not in game' } }));
              return;
            }

            try {
              const gameState = activeGames.get(gameId);
              if (!gameState) {
                ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Game not found' } }));
                return;
              }

              gameService.endTurn(gameState, playerKey);
              broadcastGameState(gameId, gameState);
            } catch (error: any) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
            }
            break;
          }

          default:
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unknown message type' } }));
        }
      } catch (error: any) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message || 'Invalid message format' } }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (userId) {
        gameQueue.dequeue(userId);
        playerConnections.delete(userId);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  async function handleMatch(player1Id: string, player2Id: string) {
    try {
      console.log(`Matching players: ${player1Id} vs ${player2Id}`);

      // Initialize game
      const gameState = await gameService.initializeGame(player1Id, player2Id);
      activeGames.set(gameState.id, gameState);

      // Get player connections
      const player1Conn = playerConnections.get(player1Id);
      const player2Conn = playerConnections.get(player2Id);

      if (!player1Conn || !player2Conn) {
        console.error('Player connections not found');
        return;
      }

      // Update connections with game info
      player1Conn.gameId = gameState.id;
      player1Conn.playerKey = 'player1';
      player2Conn.gameId = gameState.id;
      player2Conn.playerKey = 'player2';

      // Send game start to both players
      player1Conn.ws.send(JSON.stringify({ type: 'GAME_START', payload: buildStateForPlayer(gameState, 'player1') }));
      player2Conn.ws.send(JSON.stringify({ type: 'GAME_START', payload: buildStateForPlayer(gameState, 'player2') }));
    } catch (error) {
      console.error('Error matching players:', error);
    }
  }

  function buildStateForPlayer(gameState: GameState, playerKey: 'player1' | 'player2') {
    const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
    const isMyTurn = gameState.currentTurn === playerKey;
    const me = gameState[playerKey];
    const opponent = gameState[opponentKey];
    const canPlay = isMyTurn && me.board.length < 5;

    return {
      ...gameState,
      [playerKey]: {
        ...me,
        hand: me.hand.map(card => ({ ...card, playable: canPlay && card.cost <= me.gold })),
        board: me.board.map(card => ({ ...card, canAttack: isMyTurn })),
      },
      [opponentKey]: {
        ...opponent,
        // Send placeholder objects so the client knows how many cards the opponent holds,
        // without revealing any card data (name, cost, power, etc. are all hidden).
        hand: Array.from({ length: opponent.hand.length }, (_, i) => ({
          gameCardId: `hidden-${i}`,
          name: '',
          cost: 0,
          power: 0,
          health: 0,
        })),
        board: opponent.board.map(card => ({ ...card, canAttack: false })),
      },
    };
  }

  function broadcastGameState(gameId: string, gameState: GameState) {
    const player1Conn = playerConnections.get(gameState.player1.userId);
    const player2Conn = playerConnections.get(gameState.player2.userId);
    const events = gameService.drainEvents();

    if (player1Conn && player1Conn.gameId === gameId) {
      player1Conn.ws.send(JSON.stringify({ type: 'GAME_STATE', payload: { ...buildStateForPlayer(gameState, 'player1'), events } }));
    }

    if (player2Conn && player2Conn.gameId === gameId) {
      player2Conn.ws.send(JSON.stringify({ type: 'GAME_STATE', payload: { ...buildStateForPlayer(gameState, 'player2'), events } }));
    }
  }

  function broadcastGameEnd(gameId: string, gameState: GameState) {
    const player1Conn = playerConnections.get(gameState.player1.userId);
    const player2Conn = playerConnections.get(gameState.player2.userId);

    if (player1Conn && player1Conn.gameId === gameId) {
      player1Conn.ws.send(JSON.stringify({ type: 'GAME_END', payload: { winner: gameState.winner } }));
    }

    if (player2Conn && player2Conn.gameId === gameId) {
      player2Conn.ws.send(JSON.stringify({ type: 'GAME_END', payload: { winner: gameState.winner } }));
    }
  }

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server on ws://${hostname}:${wsPort}`);
  });
});
