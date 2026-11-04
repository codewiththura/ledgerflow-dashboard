/**
 * CLI Argument parser and execution entry point for database export.
 */

import { KNOWN_COLLECTIONS } from "./types.ts";
import type { ExportOptions } from "./types.ts";
import {
  initializeReadOnlyFirestore,
  authenticateIfCredentialsProvided,
} from "./firebase-client.ts";
import { exportDatabase } from "./exporter.ts";

export function parseCliArgs(
  args: string[],
): ExportOptions & { help?: boolean } {
  const options: ExportOptions & { help?: boolean } = {
    pretty: true,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }
    if (arg.startsWith("--collections=") || arg.startsWith("--collection=")) {
      const val = arg.split("=")[1];
      if (val) {
        options.collections = val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else if (arg.startsWith("--outDir=") || arg.startsWith("--out=")) {
      const val = arg.split("=")[1];
      if (val) {
        options.outDir = val.trim();
      }
    } else if (arg.startsWith("--email=")) {
      options.email = arg.split("=")[1]?.trim();
    } else if (arg.startsWith("--password=")) {
      options.password = arg.split("=")[1]?.trim();
    } else if (arg === "--compact" || arg === "--minified") {
      options.pretty = false;
    } else if (arg === "--silent") {
      options.silent = true;
    }
  }

  return options;
}

export function printHelp(): void {
  console.log(`
LedgerFlow Database Export Tool
===============================
Safely exports backend Firestore database records to JSON files in strict READ-ONLY mode.
Guarantees zero writes, zero mutations, and complete data safety.

Usage:
  npm run export:data [options]

Authentication Options (for secured Firestore rules):
  --email=<email>       Firebase user email to authenticate read access
  --password=<pass>     Firebase user password to authenticate read access
  (Or set EXPORT_AUTH_EMAIL and EXPORT_AUTH_PASSWORD in .env.local)

Export Options:
  --collections=<list>  Comma-separated list of collections to export (e.g. --collections=sales,expenses,accounts)
  --outDir=<path>       Custom directory to save exported JSON files (default: ./exports/export-<timestamp>)
  --compact             Save minified JSON without indentation (default: pretty-printed)
  --silent              Run silently without stdout logs
  -h, --help            Show this help message

Known Collections Available:
  ${KNOWN_COLLECTIONS.join(", ")}
`);
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseCliArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  try {
    const { db, auth, projectId } = initializeReadOnlyFirestore();

    // Authenticate if credentials are provided
    const authedEmail = await authenticateIfCredentialsProvided(
      auth,
      options.email,
      options.password,
    );

    if (authedEmail && !options.silent) {
      console.log(`🔐 Authenticated as: ${authedEmail}`);
    }

    await exportDatabase(db, projectId, options);
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes("Missing or insufficient permissions") ||
      message.includes("permission-denied")
    ) {
      console.error(`\n🔒 Permission Denied by Firestore Security Rules.`);
      console.error(
        `Your Firestore rules require an authenticated user to read database records.`,
      );
      console.error(
        `\nTo resolve, run the export with your user login credentials:`,
      );
      console.error(
        `  npm run export:data -- --email=your-email@example.com --password=your-password`,
      );
      console.error(
        `\nOr add the following variables to your .env.local file:`,
      );
      console.error(`  EXPORT_AUTH_EMAIL=your-email@example.com`);
      console.error(`  EXPORT_AUTH_PASSWORD=your-password\n`);
    } else {
      console.error(`\n❌ Export Failed:`, message);
    }

    process.exit(1);
  }
}
