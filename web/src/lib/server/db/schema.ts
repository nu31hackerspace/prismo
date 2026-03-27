import { pgTable, serial, text, timestamp, jsonb, integer, varchar, customType } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  googleId: text('google_id').unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  sessions: jsonb('sessions').default('[]').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tracking = pgTable('tracking', {
  id: serial('id').primaryKey(),
  deviceUuid: text('device_uuid').notNull(),
  event: text('event').notNull(),
  context: text('context'),
  country: text('country'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const devices = pgTable('devices', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  tokenKey: text('token_key').notNull(),
  ownerId: integer('owner_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const files = pgTable('files', {
  id: serial('id').primaryKey(),
  content: bytea('content').notNull(),
  contentType: varchar('content_type', { length: 255 }).notNull().default('application/octet-stream'),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workerJobs = pgTable('worker_jobs', {
  id: serial('id').primaryKey(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attemptCount: integer('attempt_count').notNull().default(0),
  maxAttemptCount: integer('max_attempt_count').notNull().default(3),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  inputPayload: jsonb('input_payload').notNull(),
  outputPayload: jsonb('output_payload'),
});
