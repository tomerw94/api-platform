import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface SignupData {
  email: string;
  password?: string;
  googleId?: string;
  authProvider: 'EMAIL' | 'GOOGLE';
  displayname?: string;
}

export interface SigninData {
  email: string;
  password?: string;
  googleId?: string;
  authProvider: 'EMAIL' | 'GOOGLE';
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    displayname?: string | null;
  };
  token: string;
}

export class UserService {
  async signup(data: SignupData): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password if provided
    let passwordHash: string | null = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }

    // Create user and default deck in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email,
          password_hash: passwordHash,
          google_id: data.googleId || null,
          auth_provider: data.authProvider,
          displayname: data.displayname || null,
        },
      });

      // Get all cards (should be 10 cards)
      const cards = await tx.card.findMany();
      if (cards.length === 0) {
        throw new Error('No cards found in database. Please seed cards first.');
      }

      // Create default deck
      const deck = await tx.deck.create({
        data: {
          name: 'Default Deck',
          userId: user.id,
        },
      });

      // Add 2 copies of each card to the deck
      const cardToDeckPromises = [];
      for (const card of cards) {
        // Add first copy
        cardToDeckPromises.push(
          tx.cardToDeck.create({
            data: {
              deckId: deck.id,
              cardId: card.id,
            },
          })
        );
        // Add second copy
        cardToDeckPromises.push(
          tx.cardToDeck.create({
            data: {
              deckId: deck.id,
              cardId: card.id,
            },
          })
        );
      }
      await Promise.all(cardToDeckPromises);

      return user;
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.id, email: result.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: result.id,
        email: result.email,
        displayname: result.displayname,
      },
      token,
    };
  }

  async signin(data: SigninData): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password for email auth
    if (data.authProvider === 'EMAIL') {
      if (!data.password || !user.password_hash) {
        throw new Error('Invalid credentials');
      }
      const isValid = await bcrypt.compare(data.password, user.password_hash);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }
    }

    // Verify Google ID for Google auth
    if (data.authProvider === 'GOOGLE') {
      if (!data.googleId || user.google_id !== data.googleId) {
        throw new Error('Invalid credentials');
      }
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayname: user.displayname,
      },
      token,
    };
  }

  async deleteUser(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
  }
}
