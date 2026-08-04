import { BaseRepository } from "./base.repository";
import { db, type UnitOfMeasureSchema } from "@/database/schema";

// ---------------------------------------------------------------------------
// Default system units of measure — seeded on first load.
// allowDecimals + precision fields support weighed/measured products.
// ---------------------------------------------------------------------------
export const DEFAULT_UNITS: Omit<UnitOfMeasureSchema, "createdAt" | "updatedAt" | "sync_status">[] = [
  { id: "uom-piece",      name: "Piece",      abbreviation: "pc",   allowDecimals: false, precision: 0, isSystem: true, status: "active" },
  { id: "uom-bottle",     name: "Bottle",     abbreviation: "btl",  allowDecimals: false, precision: 0, isSystem: true, status: "active" },
  { id: "uom-pack",       name: "Pack",       abbreviation: "pk",   allowDecimals: false, precision: 0, isSystem: true, status: "active" },
  { id: "uom-bag",        name: "Bag",        abbreviation: "bg",   allowDecimals: false, precision: 0, isSystem: true, status: "active" },
  { id: "uom-roll",       name: "Roll",       abbreviation: "rl",   allowDecimals: false, precision: 0, isSystem: true, status: "active" },
  { id: "uom-sachet",     name: "Sachet",     abbreviation: "sac",  allowDecimals: false, precision: 0, isSystem: true, status: "active" },
  { id: "uom-carton",     name: "Carton",     abbreviation: "ctn",  allowDecimals: false, precision: 0, isSystem: true, status: "active" },
  { id: "uom-box",        name: "Box",        abbreviation: "bx",   allowDecimals: false, precision: 0, isSystem: true, status: "active" },
  { id: "uom-kilogram",   name: "Kilogram",   abbreviation: "kg",   allowDecimals: true,  precision: 3, isSystem: true, status: "active" },
  { id: "uom-gram",       name: "Gram",       abbreviation: "g",    allowDecimals: true,  precision: 1, isSystem: true, status: "active" },
  { id: "uom-litre",      name: "Litre",      abbreviation: "L",    allowDecimals: true,  precision: 2, isSystem: true, status: "active" },
  { id: "uom-millilitre", name: "Millilitre", abbreviation: "mL",   allowDecimals: true,  precision: 1, isSystem: true, status: "active" },
  { id: "uom-meter",      name: "Meter",      abbreviation: "m",    allowDecimals: true,  precision: 2, isSystem: true, status: "active" },
  { id: "uom-centimeter", name: "Centimeter", abbreviation: "cm",   allowDecimals: true,  precision: 1, isSystem: true, status: "active" },
];

export class UnitOfMeasureRepository extends BaseRepository<UnitOfMeasureSchema> {
  constructor() {
    super("units_of_measure", db.units_of_measure);
  }

  /** Seed default system units on first load. Safe to call multiple times. */
  async ensureSeedUnits(): Promise<UnitOfMeasureSchema[]> {
    const existing = await db.units_of_measure.count();
    if (existing === 0) {
      const now = Date.now();
      const records: UnitOfMeasureSchema[] = DEFAULT_UNITS.map((u) => ({
        ...u,
        createdAt: now,
        updatedAt: now,
        sync_status: "synced" as const,
      }));
      await db.units_of_measure.bulkPut(records);
    }
    return db.units_of_measure.toArray();
  }

  async getActiveUnits(): Promise<UnitOfMeasureSchema[]> {
    const all = await this.ensureSeedUnits();
    return all.filter((u) => u.status === "active");
  }

  async getByName(name: string): Promise<UnitOfMeasureSchema | undefined> {
    const all = await db.units_of_measure.toArray();
    return all.find((u) => u.name.toLowerCase() === name.toLowerCase());
  }
}

export const unitOfMeasureRepository = new UnitOfMeasureRepository();
