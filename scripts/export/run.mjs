#!/usr/bin/env node

/**
 * Isolated Database Export Runner for LedgerFlow
 * 
 * Safety & Isolation:
 * - Automatically loads .env.local if present
 * - Executes strictly read-only Firestore data retrieval
 * - Zero mutations, zero write operations
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local into process.env if variables are not already set
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvLocal();

// Dynamically import compiled or TypeScript modules
import('./cli.ts').then(({ main }) => {
  main();
}).catch((err) => {
  console.error('Failed to run export tool:', err);
  process.exit(1);
});
