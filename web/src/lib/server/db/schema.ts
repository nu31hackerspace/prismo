import { pgTable, serial, text, timestamp, json, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
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
