CREATE TABLE "files" (
  "id" serial PRIMARY KEY NOT NULL,
  "content" bytea NOT NULL,
  "content_type" varchar(255) NOT NULL DEFAULT 'application/octet-stream',
  "owner_id" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "worker_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "max_attempt_count" integer NOT NULL DEFAULT 3,
  "owner_id" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "input_payload" jsonb NOT NULL,
  "output_payload" jsonb
);
