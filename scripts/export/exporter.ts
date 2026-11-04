/**
 * Core Exporter for Firestore Collections.
 *
 * =========================================================================
 * SAFETY GUARANTEE: STRICTLY READ-ONLY
 * - Only uses Firestore `getDocs(collection(db, ...))`
 * - NO mutation methods (addDoc, setDoc, updateDoc, deleteDoc, writeBatch)
 * - Safe for live production single-database setups with zero backup risk
 * =========================================================================
 */

import * as fs from "fs";
import * as path from "path";
import { collection, getDocs, Firestore } from "firebase/firestore";
import { KNOWN_COLLECTIONS } from "./types.ts";
import type {
  ExportOptions,
  ExportManifest,
  CollectionSummary,
  SerializedDocument,
} from "./types.ts";
import { serializeDocument } from "./serializer.ts";


/**
 * Reads all documents from a Firestore collection in strict READ-ONLY mode.
 */
export async function readCollectionDocuments(
  db: Firestore,
  collectionName: string,
): Promise<SerializedDocument[]> {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);

  const documents: SerializedDocument[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    documents.push(serializeDocument(docSnap.id, data));
  });

  return documents;
}

/**
 * Formats a Date object into a filesystem-safe timestamp string.
 * Example: 2026-09-09_22-45-00
 */
export function getTimestampString(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * Runs the export process for all or selected collections.
 */
export async function exportDatabase(
  db: Firestore,
  projectId: string,
  options: ExportOptions = {},
): Promise<ExportManifest> {
  const startTime = Date.now();
  const collectionsToExport =
    options.collections && options.collections.length > 0
      ? options.collections
      : [...KNOWN_COLLECTIONS];

  const timestampStr = getTimestampString();
  const outputDirectory =
    options.outDir ||
    path.resolve(process.cwd(), "exports", `export-${timestampStr}`);

  // Ensure output directory exists
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  const space = options.pretty !== false ? 2 : 0;
  const collectionsSummary: Record<string, CollectionSummary> = {};
  const allData: Record<string, SerializedDocument[]> = {};
  const collectionFiles: string[] = [];
  let totalDocuments = 0;

  if (!options.silent) {
    console.log(`\n======================================================`);
    console.log(`  LedgerFlow Database Exporter (Read-Only Mode)`);
    console.log(`======================================================`);
    console.log(`- Project ID       : ${projectId}`);
    console.log(`- Target Directory : ${outputDirectory}`);
    console.log(
      `- Collections (${collectionsToExport.length}): ${collectionsToExport.join(", ")}`,
    );
    console.log(`------------------------------------------------------\n`);
  }

  for (const colName of collectionsToExport) {
    const colStart = Date.now();
    if (!options.silent) {
      process.stdout.write(`  [Reading] ${colName.padEnd(22, " ")} ... `);
    }

    // STRICT READ-ONLY FETCH
    const docs = await readCollectionDocuments(db, colName);
    const colDuration = Date.now() - colStart;

    allData[colName] = docs;
    totalDocuments += docs.length;

    // Write individual collection file
    const fileName = `${colName}.json`;
    const filePath = path.join(outputDirectory, fileName);
    const fileContent = JSON.stringify(docs, null, space);
    fs.writeFileSync(filePath, fileContent, "utf-8");
    const fileSizeBytes = Buffer.byteLength(fileContent, "utf-8");

    collectionFiles.push(fileName);

    collectionsSummary[colName] = {
      collectionName: colName,
      documentCount: docs.length,
      fileName,
      fileSizeBytes,
      durationMs: colDuration,
    };

    if (!options.silent) {
      const sizeKb = (fileSizeBytes / 1024).toFixed(1);
      console.log(
        `✓ ${String(docs.length).padStart(4, " ")} docs (${sizeKb} KB) [${colDuration}ms]`,
      );
    }
  }

  // Write combined all-data.json
  const combinedFileName = "all-data.json";
  const combinedFilePath = path.join(outputDirectory, combinedFileName);
  fs.writeFileSync(
    combinedFilePath,
    JSON.stringify(allData, null, space),
    "utf-8",
  );

  const totalDuration = Date.now() - startTime;

  // Build manifest
  const manifest: ExportManifest = {
    version: "1.0.0",
    application: "LedgerFlow",
    exportedAt: new Date().toISOString(),
    projectId,
    totalCollections: collectionsToExport.length,
    totalDocuments,
    durationMs: totalDuration,
    collections: collectionsSummary,
    files: {
      manifest: "manifest.json",
      combinedData: combinedFileName,
      collectionFiles,
    },
  };

  // Write manifest.json
  const manifestFilePath = path.join(outputDirectory, "manifest.json");
  fs.writeFileSync(
    manifestFilePath,
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );

  if (!options.silent) {
    console.log(`\n------------------------------------------------------`);
    console.log(`✓ Export Completed Successfully!`);
    console.log(`- Total Collections : ${collectionsToExport.length}`);
    console.log(`- Total Documents   : ${totalDocuments}`);
    console.log(`- Total Time        : ${totalDuration}ms`);
    console.log(`- Output Folder     : ${outputDirectory}`);
    console.log(`======================================================\n`);
  }

  return manifest;
}
