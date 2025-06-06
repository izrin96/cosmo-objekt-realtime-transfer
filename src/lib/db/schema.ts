import { pgTable, boolean } from "drizzle-orm/pg-core";
import { citext } from "./custom-type";

export const userAddress = pgTable("user_address", {
  address: citext("address", { length: 42 }).notNull(),
  nickname: citext("nickname", { length: 24 }).notNull(),
  hideActivity: boolean("hide_activity").default(false),
});

export type UserAddress = typeof userAddress.$inferSelect;
