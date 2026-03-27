import { pgTable, serial, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

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
