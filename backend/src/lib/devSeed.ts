import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

export const DEV_SEED_EMAIL = process.env.DEV_SEED_EMAIL || 'slide@example.com';
export const DEV_SEED_PASSWORD = process.env.DEV_SEED_PASSWORD || 'devpass123';
export const DEV_SEED_NAME = process.env.DEV_SEED_NAME || 'Slide User';

export async function seedDevelopmentUser() {
  if (process.env.NODE_ENV === 'production') return;

  const existing = await User.findOne({ email: DEV_SEED_EMAIL });
  if (!existing) {
    await User.create({
      email: DEV_SEED_EMAIL,
      password: await bcrypt.hash(DEV_SEED_PASSWORD, 12),
      name: DEV_SEED_NAME,
    });
    console.log(`Seeded development user ${DEV_SEED_EMAIL}`);
  }

  console.log(`Development login: ${DEV_SEED_EMAIL} / ${DEV_SEED_PASSWORD}`);
}
