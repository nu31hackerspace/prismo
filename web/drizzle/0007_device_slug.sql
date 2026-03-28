ALTER TABLE "devices" ADD COLUMN "device_slug" text;
--> statement-breakpoint
UPDATE "devices"
SET "device_slug" = regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g') || '-' || substring(md5(random()::text), 1, 6);
--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "device_slug" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_device_slug_unique" UNIQUE("device_slug");
