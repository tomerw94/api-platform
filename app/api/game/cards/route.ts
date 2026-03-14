import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const cards = await prisma.card.findMany({
      orderBy: { cost: 'asc' }
    });

    return NextResponse.json({
      cards: cards.map(card => ({
        id: card.id,
        name: card.name,
        power: card.power,
        health: card.health,
        cost: card.cost,
        description: card.description,
        image: card.image,
      }))
    });
  } catch (error) {
    console.error('Get cards error:', error);
    return NextResponse.json({
      error: 'Failed to fetch cards'
    }, { status: 500 });
  }
}
