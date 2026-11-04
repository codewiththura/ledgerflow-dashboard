/**
 * Pure Unit Tests for Firestore Serialization and Isolation Logic.
 *
 * =========================================================================
 * SAFETY VERIFICATION:
 * - ZERO database or network operations are executed.
 * - Tests run strictly in-memory using pure functions and mock data.
 * =========================================================================
 */

import { test, describe } from "node:test";
import * as assert from "node:assert";
import {
  isTimestampLike,
  timestampToISO,
  serializeFirestoreData,
  serializeDocument,
} from "../serializer.ts";
import { parseCliArgs } from "../cli.ts";


describe("Serializer Unit Tests (Isolated / No DB)", () => {
  test("correctly identifies Firestore Timestamp objects with toDate()", () => {
    const mockTimestamp = {
      toDate: () => new Date("2026-09-09T12:00:00.000Z"),
      seconds: 1788955200,
      nanoseconds: 0,
    };
    assert.strictEqual(isTimestampLike(mockTimestamp), true);
    assert.strictEqual(
      timestampToISO(mockTimestamp),
      "2026-09-09T12:00:00.000Z",
    );
  });

  test("correctly identifies Firestore Timestamp objects with seconds and nanoseconds", () => {
    const rawTimestamp = {
      seconds: 1757419200, // 2025-09-09T12:00:00.000Z
      nanoseconds: 500000000,
    };
    assert.strictEqual(isTimestampLike(rawTimestamp), true);
    assert.strictEqual(
      timestampToISO(rawTimestamp),
      "2025-09-09T12:00:00.500Z",
    );
  });

  test("correctly identifies internal _seconds and _nanoseconds properties", () => {
    const internalTimestamp = {
      _seconds: 1757419200,
      _nanoseconds: 0,
    };
    assert.strictEqual(isTimestampLike(internalTimestamp), true);
    assert.strictEqual(
      timestampToISO(internalTimestamp),
      "2025-09-09T12:00:00.000Z",
    );
  });

  test("serializes JavaScript Date objects to ISO string", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const result = serializeFirestoreData(now);
    assert.strictEqual(result, "2026-01-01T00:00:00.000Z");
  });

  test("safely handles primitive types and null/undefined values", () => {
    assert.strictEqual(serializeFirestoreData("test"), "test");
    assert.strictEqual(serializeFirestoreData(12345), 12345);
    assert.strictEqual(serializeFirestoreData(true), true);
    assert.strictEqual(serializeFirestoreData(false), false);
    assert.strictEqual(serializeFirestoreData(null), null);
    assert.strictEqual(serializeFirestoreData(undefined), null);
  });

  test("serializes deeply nested objects and arrays containing Timestamps and Dates", () => {
    const complexData = {
      saleId: "SALE_001",
      customer: {
        name: "John Doe",
        registeredAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      items: [
        {
          productId: "PROD_1",
          name: "Item 1",
          price: 15000,
          details: {
            created: {
              toDate: () => new Date("2026-03-01T10:00:00.000Z"),
              seconds: 1772359200,
              nanoseconds: 0,
            },
          },
        },
      ],
      tags: ["pos", "in-store"],
    };

    const serialized = serializeFirestoreData(complexData) as {
      saleId: string;
      customer: { name: string; registeredAt: string };
      items: Array<{ name: string; details: { created: string } }>;
      tags: string[];
    };

    assert.strictEqual(serialized.saleId, "SALE_001");
    assert.strictEqual(serialized.customer.name, "John Doe");
    assert.strictEqual(
      serialized.customer.registeredAt,
      "2026-03-01T10:00:00.000Z",
    );
    assert.strictEqual(serialized.items[0].name, "Item 1");
    assert.strictEqual(
      serialized.items[0].details.created,
      "2026-03-01T10:00:00.000Z",
    );
    assert.deepStrictEqual(serialized.tags, ["pos", "in-store"]);
  });

  test("serializeDocument preserves document ID with normalized fields", () => {
    const raw = {
      title: "Office Supplies",
      amount: 45000,
      createdAt: new Date("2026-05-15T08:30:00.000Z"),
    };
    const doc = serializeDocument("DOC_123", raw);

    assert.strictEqual(doc.id, "DOC_123");
    assert.strictEqual(doc.title, "Office Supplies");
    assert.strictEqual(doc.amount, 45000);
    assert.strictEqual(doc.createdAt, "2026-05-15T08:30:00.000Z");
  });

  test("handles arrays of complex nested objects cleanly", () => {
    const arr = [
      { id: "1", date: new Date("2026-01-01T00:00:00.000Z") },
      { id: "2", amount: 100 },
    ];
    const res = serializeFirestoreData(arr) as Array<{
      id: string;
      date?: string;
      amount?: number;
    }>;
    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].date, "2026-01-01T00:00:00.000Z");
    assert.strictEqual(res[1].amount, 100);
  });
});

describe("CLI Argument Parser Unit Tests (Isolated / No DB)", () => {
  test("parses comma-separated collections correctly", () => {
    const options = parseCliArgs(["--collections=sales,expenses,accounts"]);
    assert.deepStrictEqual(options.collections, [
      "sales",
      "expenses",
      "accounts",
    ]);
    assert.strictEqual(options.pretty, true);
  });

  test("parses single collection option", () => {
    const options = parseCliArgs(["--collection=users"]);
    assert.deepStrictEqual(options.collections, ["users"]);
  });

  test("parses email and password credentials correctly", () => {
    const options = parseCliArgs([
      "--email=admin@ledgerflow.com",
      "--password=secret123",
    ]);
    assert.strictEqual(options.email, "admin@ledgerflow.com");
    assert.strictEqual(options.password, "secret123");
  });

  test("parses custom output directory and compact flag", () => {

    const options = parseCliArgs(["--outDir=./backup-data", "--compact"]);
    assert.strictEqual(options.outDir, "./backup-data");
    assert.strictEqual(options.pretty, false);
  });

  test("parses help flag correctly", () => {
    const options = parseCliArgs(["--help"]);
    assert.strictEqual(options.help, true);
  });
});
