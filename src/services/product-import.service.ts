import * as XLSX from "xlsx";
import { productRepository } from "@/repositories/product.repository";
import { categoryRepository } from "@/repositories/category.repository";
import { db, type ProductImportJobSchema } from "@/database/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportRow {
  rowIndex: number;
  name: string;
  code?: string;
  sku?: string;
  barcode?: string;
  category?: string;
  brand?: string;
  manufacturer?: string;
  baseUnit: string;
  trackExpiry?: boolean;
  lowStockThreshold?: number;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  supplyPrice: number;
  description?: string;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportPreview {
  valid: ImportRow[];
  invalid: Array<{ row: ImportRow | null; rowIndex: number; errors: ImportValidationError[] }>;
  totalRows: number;
}

// ---------------------------------------------------------------------------
// Excel column header map (case-insensitive)
// ---------------------------------------------------------------------------
const COLUMN_MAP: Record<string, keyof ImportRow> = {
  "name": "name",
  "product name": "name",
  "code": "code",
  "product code": "code",
  "sku": "sku",
  "barcode": "barcode",
  "category": "category",
  "brand": "brand",
  "manufacturer": "manufacturer",
  "base unit": "baseUnit",
  "unit": "baseUnit",
  "track expiry": "trackExpiry",
  "expiry": "trackExpiry",
  "low stock threshold": "lowStockThreshold",
  "threshold": "lowStockThreshold",
  "cost price": "costPrice",
  "cost": "costPrice",
  "retail price": "retailPrice",
  "retail": "retailPrice",
  "wholesale price": "wholesalePrice",
  "wholesale": "wholesalePrice",
  "supply price": "supplyPrice",
  "supply": "supplyPrice",
  "description": "description",
};

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function toNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return ["yes", "true", "1", "y"].includes(val.toLowerCase());
  return Boolean(val);
}

// ---------------------------------------------------------------------------
// Parse Excel file → raw row objects
// ---------------------------------------------------------------------------

export function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ---------------------------------------------------------------------------
// Normalize a raw row using COLUMN_MAP
// ---------------------------------------------------------------------------

function normalizeRow(raw: Record<string, unknown>, rowIndex: number): ImportRow {
  const normalized: Partial<ImportRow> & { rowIndex: number } = { rowIndex };

  for (const [rawKey, rawVal] of Object.entries(raw)) {
    const mappedKey = COLUMN_MAP[rawKey.toLowerCase().trim()];
    if (!mappedKey) continue;

    switch (mappedKey) {
      case "costPrice":
      case "retailPrice":
      case "wholesalePrice":
      case "supplyPrice":
      case "lowStockThreshold":
        (normalized as Record<string, unknown>)[mappedKey] = toNum(rawVal);
        break;
      case "trackExpiry":
        normalized.trackExpiry = toBool(rawVal);
        break;
      default:
        (normalized as Record<string, unknown>)[mappedKey] = String(rawVal ?? "").trim();
    }
  }

  return normalized as ImportRow;
}

// ---------------------------------------------------------------------------
// Validate a single row
// ---------------------------------------------------------------------------

async function validateRow(
  row: ImportRow,
  existingCodes: Set<string>,
  categoryNames: Set<string>
): Promise<ImportValidationError[]> {
  const errors: ImportValidationError[] = [];

  if (!row.name?.trim()) {
    errors.push({ row: row.rowIndex, field: "name", message: "Product name is required" });
  }

  if (!row.baseUnit?.trim()) {
    errors.push({ row: row.rowIndex, field: "baseUnit", message: "Base unit is required" });
  }

  if (row.code && existingCodes.has(row.code.trim())) {
    errors.push({ row: row.rowIndex, field: "code", message: `Duplicate product code: ${row.code}` });
  }

  if (row.category && !categoryNames.has(row.category.toLowerCase().trim())) {
    errors.push({ row: row.rowIndex, field: "category", message: `Unknown category: "${row.category}"` });
  }

  if (row.costPrice < 0) {
    errors.push({ row: row.rowIndex, field: "costPrice", message: "Cost price cannot be negative" });
  }
  if (row.retailPrice < 0) {
    errors.push({ row: row.rowIndex, field: "retailPrice", message: "Retail price cannot be negative" });
  }
  if (row.wholesalePrice < 0) {
    errors.push({ row: row.rowIndex, field: "wholesalePrice", message: "Wholesale price cannot be negative" });
  }
  if (row.supplyPrice < 0) {
    errors.push({ row: row.rowIndex, field: "supplyPrice", message: "Supply price cannot be negative" });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Build a downloadable import template
// ---------------------------------------------------------------------------

export function generateImportTemplate(): void {
  const headers = [
    "name",
    "code",
    "sku",
    "barcode",
    "category",
    "brand",
    "manufacturer",
    "base unit",
    "track expiry",
    "low stock threshold",
    "cost price",
    "retail price",
    "wholesale price",
    "supply price",
    "description",
  ];

  const example = [
    "Coca-Cola 35cl",
    "JSP-0001",
    "COKE-35CL",
    "5000112632625",
    "Beverages",
    "Coca-Cola",
    "TCCC Nigeria",
    "Bottle",
    "No",
    "10",
    "150",
    "200",
    "180",
    "160",
    "Carbonated soft drink 35cl",
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  XLSX.writeFile(wb, "just-sly-product-import-template.xlsx");
}

// ---------------------------------------------------------------------------
// Main import service
// ---------------------------------------------------------------------------

export class ProductImportService {
  /**
   * Parse an Excel file and validate each row.
   * Returns a preview object for the user to review before committing.
   */
  async preview(file: File): Promise<ImportPreview> {
    const rawRows = await parseExcelFile(file);

    // Load reference data for validation
    const [existingProducts, allCategories] = await Promise.all([
      db.products.toArray(),
      categoryRepository.getActiveCategories(),
    ]);

    const existingCodes = new Set(existingProducts.map((p) => p.code));
    const categoryNames = new Set(allCategories.map((c) => c.name.toLowerCase()));

    const valid: ImportRow[] = [];
    const invalid: ImportPreview["invalid"] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = normalizeRow(rawRows[i], i + 2); // +2 for header row offset
      const errors = await validateRow(row, existingCodes, categoryNames);

      if (errors.length === 0) {
        valid.push(row);
        // Track codes to catch intra-file duplicates
        if (row.code) existingCodes.add(row.code);
      } else {
        invalid.push({ row, rowIndex: i + 2, errors });
      }
    }

    return { valid, invalid, totalRows: rawRows.length };
  }

  /**
   * Commit a validated set of rows as product records.
   * Creates a ProductImportJob to track the result.
   */
  async importRows(
    rows: ImportRow[],
    fileName: string,
    userId: string,
    userName?: string
  ): Promise<ProductImportJobSchema> {
    const now = Date.now();
    const job: ProductImportJobSchema = {
      id: crypto.randomUUID(),
      status: "processing",
      fileName,
      totalRows: rows.length,
      importedRows: 0,
      failedRows: 0,
      errors: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await db.product_import_jobs.put(job);

    const allCategories = await categoryRepository.getActiveCategories();
    const categoryMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c.id]));

    for (const row of rows) {
      try {
        await productRepository.createProduct({
          code: row.code?.trim() || undefined,
          sku: row.sku?.trim() || undefined,
          barcode: row.barcode?.trim() || undefined,
          name: row.name.trim(),
          description: row.description?.trim(),
          categoryId: row.category ? (categoryMap.get(row.category.toLowerCase()) ?? null) : null,
          brand: row.brand?.trim(),
          manufacturer: row.manufacturer?.trim(),
          baseUnit: row.baseUnit.trim(),
          trackExpiry: row.trackExpiry ?? false,
          lowStockThreshold: row.lowStockThreshold ?? 0,
          costPrice: row.costPrice,
          retailPrice: row.retailPrice,
          wholesalePrice: row.wholesalePrice,
          supplyPrice: row.supplyPrice,
          createdByUserId: userId,
          createdByName: userName,
        });
        job.importedRows += 1;
      } catch (err) {
        job.failedRows += 1;
        job.errors.push({
          row: row.rowIndex,
          field: "general",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    job.status = job.failedRows === 0 ? "completed" : "completed";
    job.updatedAt = Date.now();
    await db.product_import_jobs.put(job);

    return job;
  }
}

export const productImportService = new ProductImportService();
