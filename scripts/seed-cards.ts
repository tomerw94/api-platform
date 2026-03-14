import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://cardgame_user:cardgame_password@localhost:5432/cardGameDb?schema=public';
const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedCards() {
  console.log('Seeding cards...');

  const existing = await prisma.card.count();

  if (existing === 0) {
    const cardData = Array.from({ length: 10 }, (_, i) => ({
      name: `test card ${i + 1}`,
      power: i + 1,
      health: i + 1,
      cost: i + 1,
      description: `test card ${i + 1}`,
      image: i < 5 ? 'shitzuLab.png' : 'shitzuStrong.png',
    }));

    await prisma.card.createMany({ data: cardData });
    console.log(`Seeded ${cardData.length} cards`);
  } else {
    // Update images for existing test cards
    console.log(`Updating images for existing cards...`);
    for (let i = 1; i <= 10; i++) {
      const image = i <= 5 ? 'shitzuLab.png' : 'shitzuStrong.png';
      await prisma.card.updateMany({
        where: { name: `test card ${i}` },
        data: { image },
      });
    }
    console.log(`Updated card images (${existing} cards found)`);
  }
}

seedCards()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
