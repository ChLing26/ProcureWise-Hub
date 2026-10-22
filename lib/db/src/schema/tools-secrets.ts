import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { accounts } from "./accounts";

export const toolsSecrets = pgTable("tools_secrets", {
  name: text("name").primaryKey(),
  encryptedValue: text("encrypted_value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => accounts.id, { onDelete: "set null" }),
});
export const insertToolsSecretSchema = createInsertSchema(toolsSecrets);
export type ToolsSecret = typeof toolsSecrets.$inferSelect;

export const toolsSecretEvents = pgTable("tools_secret_events", {
  id: serial("id").primaryKey(),
  secretName: text("secret_name").notNull(),
  action: text("action").notNull(),
  actorId: integer("actor_id").references(() => accounts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertToolsSecretEventSchema = createInsertSchema(toolsSecretEvents);
export type ToolsSecretEvent = typeof toolsSecretEvents.$inferSelect;
