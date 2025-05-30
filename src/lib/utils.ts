import { inArray } from "drizzle-orm";
import { db } from "./db";
import { userAddress } from "./db/schema";

export async function fetchKnownAddresses(addresses: string[]) {
  const result = await db
    .select({
      address: userAddress.address,
      nickname: userAddress.nickname,
      hideActivity: userAddress.hideActivity,
    })
    .from(userAddress)
    .where(
      inArray(
        userAddress.address,
        addresses.map((a) => a.toLowerCase())
      )
    );
  return result;
}
