import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateIncomeInput,
  canManageIncome,
} from "../lib/income-utils.ts";

describe("Income Validation Utility", () => {
  const validPayload = {
    title: "Freelance Consulting",
    amount: "150000",
    accountId: "acc-456",
    date: "2026-11-04",
  };

  it("passes validation with valid string amount", () => {
    const result = validateIncomeInput(validPayload);
    assert.equal(result.isValid, true);
    assert.equal(result.error, null);
    assert.equal(result.parsedAmount, 150000);
  });

  it("passes validation with valid numeric amount", () => {
    const result = validateIncomeInput({
      ...validPayload,
      amount: 150000.75,
    });
    assert.equal(result.isValid, true);
    assert.equal(result.error, null);
    assert.equal(result.parsedAmount, 150000.75);
  });

  it("fails when title is empty or only whitespace", () => {
    const result = validateIncomeInput({
      ...validPayload,
      title: "   ",
    });
    assert.equal(result.isValid, false);
    assert.equal(result.error, "Income title is required.");
    assert.equal(result.parsedAmount, 0);
  });

  it("fails when amount is zero or negative", () => {
    const zeroResult = validateIncomeInput({
      ...validPayload,
      amount: "0",
    });
    assert.equal(zeroResult.isValid, false);
    assert.equal(zeroResult.error, "Amount must be a valid positive number.");

    const negativeResult = validateIncomeInput({
      ...validPayload,
      amount: "-100",
    });
    assert.equal(negativeResult.isValid, false);
    assert.equal(negativeResult.error, "Amount must be a valid positive number.");
  });

  it("fails when amount is not a number", () => {
    const result = validateIncomeInput({
      ...validPayload,
      amount: "abc",
    });
    assert.equal(result.isValid, false);
    assert.equal(result.error, "Amount must be a valid positive number.");
  });

  it("fails when accountId is missing or empty", () => {
    const result = validateIncomeInput({
      ...validPayload,
      accountId: "",
    });
    assert.equal(result.isValid, false);
    assert.equal(result.error, "Please select a deposit account.");
  });

  it("fails when date is missing or empty", () => {
    const result = validateIncomeInput({
      ...validPayload,
      date: "",
    });
    assert.equal(result.isValid, false);
    assert.equal(result.error, "Date is required.");
  });
});

describe("Income Permission Utility (canManageIncome)", () => {
  it("allows admin role to edit and delete custom incomes", () => {
    assert.equal(canManageIncome("admin"), true);
  });

  it("allows moderator role (user view) to edit and delete custom incomes", () => {
    assert.equal(canManageIncome("moderator"), true);
  });

  it("disallows unauthenticated or null user role", () => {
    assert.equal(canManageIncome(null), false);
    assert.equal(canManageIncome(undefined), false);
    assert.equal(canManageIncome("viewer"), false);
  });
});

