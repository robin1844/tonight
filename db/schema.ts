import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const household = sqliteTable('household', {
  id: integer('id').primaryKey(),
  profile: text('profile').notNull(),
  revision: integer('revision').notNull().default(1)
});
