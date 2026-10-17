import dotenv from 'dotenv';
import path from 'path';

// Load .env from cwd and monorepo root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5050,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY?.trim() || '',
  get hasGeminiKey(): boolean {
    return Boolean(this.GEMINI_API_KEY);
  },
};
