import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';

export interface QueuedPlayer {
  userId: string;
  socket: WebSocket;
  queuedAt: Date;
}

class GameQueue {
  private queue: QueuedPlayer[] = [];

  /**
   * Add a player to the matchmaking queue
   */
  enqueue(player: QueuedPlayer): void {
    // Remove player if already in queue
    this.dequeue(player.userId);
    
    this.queue.push(player);
    console.log(`Player ${player.userId} joined queue. Queue size: ${this.queue.length}`);
  }

  /**
   * Remove a player from the queue
   */
  dequeue(userId: string): QueuedPlayer | null {
    const index = this.queue.findIndex(p => p.userId === userId);
    if (index !== -1) {
      const player = this.queue[index];
      this.queue.splice(index, 1);
      console.log(`Player ${userId} left queue. Queue size: ${this.queue.length}`);
      return player;
    }
    return null;
  }

  /**
   * Try to match two players. Returns matched players or null if not enough players.
   */
  tryMatch(): { player1: QueuedPlayer; player2: QueuedPlayer } | null {
    if (this.queue.length >= 2) {
      const player1 = this.queue.shift()!;
      const player2 = this.queue.shift()!;
      console.log(`Matched players: ${player1.userId} vs ${player2.userId}`);
      return { player1, player2 };
    }
    return null;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if a player is in the queue
   */
  isInQueue(userId: string): boolean {
    return this.queue.some(p => p.userId === userId);
  }

  /**
   * Remove all players (cleanup on server restart)
   */
  clear(): void {
    this.queue = [];
  }
}

export const gameQueue = new GameQueue();
