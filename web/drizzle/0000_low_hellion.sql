CREATE TABLE "tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_uuid" text NOT NULL,
	"event" text NOT NULL,
	"context" text,
	"country" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
