/**
 * Types and interfaces for the LedgerFlow isolated database export tool.
 * Strict Read-Only Operations.
 */

export const KNOWN_COLLECTIONS = [
  'accounts',
  'account_adjustments',
  'sales',
  'incomes',
  'expenses',
  'products',
  'categories',
  'services',
  'discounts',
  'users',
] as const;

export type KnownCollection = typeof KNOWN_COLLECTIONS[number];

export interface ExportOptions {
  /** Output directory for exported files. Defaults to ./exports/export-<timestamp> */
  outDir?: string;
  /** Specific collections to export. Defaults to all KNOWN_COLLECTIONS */
  collections?: string[];
  /** Whether to format JSON with indentation. Defaults to true */
  pretty?: boolean;
  /** Suppress console output */
  silent?: boolean;
  /** Firebase Auth User Email for authenticated reads */
  email?: string;
  /** Firebase Auth User Password for authenticated reads */
  password?: string;
}


export interface CollectionSummary {
  collectionName: string;
  documentCount: number;
  fileName: string;
  fileSizeBytes: number;
  durationMs: number;
}

export interface ExportManifest {
  version: string;
  application: string;
  exportedAt: string;
  projectId: string;
  totalCollections: number;
  totalDocuments: number;
  durationMs: number;
  collections: Record<string, CollectionSummary>;
  files: {
    manifest: string;
    combinedData: string;
    collectionFiles: string[];
  };
}

export interface SerializedDocument {
  id: string;
  [key: string]: unknown;
}
