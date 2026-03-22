DROP TABLE IF EXISTS "session" CASCADE;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'sessions'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "sessions" jsonb DEFAULT '[]' NOT NULL;
  END IF;
END $$;