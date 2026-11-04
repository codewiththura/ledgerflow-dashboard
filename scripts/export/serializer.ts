/**
 * Safe serializer for Firestore records.
 * Pure in-memory transformation with ZERO database operations.
 */

import type { SerializedDocument } from './types.ts';



/**
 * Checks if a value is a Firestore Timestamp-like object (has .toDate() or seconds/nanoseconds)
 */
export function isTimestampLike(val: unknown): val is { toDate?: () => Date; seconds: number; nanoseconds: number } {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  if (typeof obj.toDate === 'function') return true;
  if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') return true;
  if (typeof obj._seconds === 'number' && typeof obj._nanoseconds === 'number') return true;
  return false;
}

/**
 * Converts a Firestore Timestamp-like object to an ISO 8601 string.
 */
export function timestampToISO(val: unknown): string {
  if (!val || typeof val !== 'object') return '';
  const obj = val as Record<string, unknown>;
  if (typeof obj.toDate === 'function') {
    return (obj.toDate as () => Date)().toISOString();
  }
  const seconds = typeof obj.seconds === 'number' ? obj.seconds : (obj._seconds as number | undefined);
  const nanoseconds = typeof obj.nanoseconds === 'number' ? obj.nanoseconds : ((obj._nanoseconds as number | undefined) || 0);
  if (seconds === undefined) return '';
  const millis = seconds * 1000 + Math.floor(nanoseconds / 1000000);
  return new Date(millis).toISOString();
}


/**
 * Recursively serializes Firestore data into standard JSON-friendly format.
 * Preserves arrays, nested objects, and translates timestamps into clean ISO strings.
 */
export function serializeFirestoreData(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isTimestampLike(value)) {
    return timestampToISO(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreData(item));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serializeFirestoreData(val);
    }
    return result;
  }

  return value;
}

/**
 * Serializes a single document with its Firestore ID and normalized fields.
 */
export function serializeDocument(id: string, rawData: Record<string, unknown>): SerializedDocument {
  const serialized = serializeFirestoreData(rawData) as Record<string, unknown>;
  return {
    id,
    ...serialized,
  };
}
