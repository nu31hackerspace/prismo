DROP TABLE IF EXISTS "session" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sessions" jsonb DEFAULT '[]' NOT NULL;