import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

if (!connectionString) {
  throw new Error('No database connection string found');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function fixMigration() {
  try {
    console.log('Adding missing columns to Document table...');

    // Add updatedAt column
    await db.execute(sql`
      ALTER TABLE "Document"
      ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL
    `);
    console.log('Added updatedAt column');

    // Add isAutosave column
    await db.execute(sql`
      ALTER TABLE "Document"
      ADD COLUMN IF NOT EXISTS "isAutosave" boolean DEFAULT true NOT NULL
    `);
    console.log('Added isAutosave column');

    // Add versionType column
    await db.execute(sql`
      ALTER TABLE "Document"
      ADD COLUMN IF NOT EXISTS "versionType" varchar DEFAULT 'autosave' NOT NULL
    `);
    console.log('Added versionType column');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

fixMigration();