export * from "./schema";
export { db } from "./schema";

export async function clearLocalDatabase(): Promise<void> {
  const { db } = await import("./schema");
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
