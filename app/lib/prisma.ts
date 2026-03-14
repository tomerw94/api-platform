import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://cardgame_user:cardgame_password@localhost:5432/cardGameDb?schema=public';

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
