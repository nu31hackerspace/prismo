import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function main() {
  console.log('Running database setup...');

  await sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" serial PRIMARY KEY NOT NULL,
      "google_id" text UNIQUE,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "sessions" jsonb NOT NULL DEFAULT '[]',
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "tracking" (
      "id" serial PRIMARY KEY NOT NULL,
      "device_uuid" text NOT NULL,
      "event" text NOT NULL,
      "context" text,
      "country" text,
      "payload" jsonb,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "devices" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "device_slug" text NOT NULL UNIQUE,
      "token_key" text NOT NULL,
      "owner_id" integer NOT NULL REFERENCES "users"("id"),
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "files" (
      "id" serial PRIMARY KEY NOT NULL,
      "content" bytea NOT NULL,
      "content_type" varchar(255) NOT NULL DEFAULT 'application/octet-stream',
      "owner_id" integer NOT NULL REFERENCES "users"("id"),
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "worker_jobs" (
      "id" serial PRIMARY KEY NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'pending',
      "attempt_count" integer NOT NULL DEFAULT 0,
      "max_attempt_count" integer NOT NULL DEFAULT 3,
      "owner_id" integer NOT NULL REFERENCES "users"("id"),
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      "input_payload" jsonb NOT NULL,
      "output_payload" jsonb
    )
  `;

  console.log('Database setup complete!');
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Database setup failed:', err);
  process.exit(1);
});
