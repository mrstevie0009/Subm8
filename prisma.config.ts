// prisma.config.ts
import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Pfad zu deinem Schema (Standard bei dir)
  schema: path.join('prisma', 'schema.prisma'),

  // Optional, aber nice explizit:
  migrations: {
    path: path.join('prisma', 'migrations'),
    // das war vorher in package.json unter "prisma.seed"
    seed: 'tsx prisma/seed.ts',
  },

  // Empfehlung der neuen Config: DB-URL hier setzen
  datasource: {
    url: env('DATABASE_URL'),
  },
});
