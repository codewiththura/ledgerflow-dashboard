import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateExpenseInput,
  canManageExpense,
} from "../lib/expense-utils.ts";

describe("Expense Validation Utility", () => {
  const validPayload = {
    title: "Office Internet Bill",
    amount: "45000",
    accountId: "acc-123",
    date: "2026-11-04",
  };

  it("passes validation with valid string amount", () => {
    const result = validateExpenseInput(validPayload);
    assert.equal(result.isValid, true);
    assert.equal(result.error, null);
    assert.equal(result.parsedAmount, 45000);
  });

  it("passes validation with valid numeric amount", () => {
    const result = validateExpenseInput({
      ...validPayload,
      amount: 45000.5,
    });
    assert.equal(result.isValid, true);
    assert.equal(result.error, null);
    assert.equal(result.parsedAmount, 45000.5);
  });

  it("fails when title is empty or only whitespace", () => {
    const result = validateExpenseInput({
      ...validPayload,
      title: "   ",
    });
    assert.equal(result.isValid, false);
    assert.equal(result.error, "Expense title is required.");
    assert.equal(result.parsedAmount, 0);
  });

  it("fails when amount is zero or negative", () => {
    const zeroResult = validateExpenseInput({
      ...validPayload,
      amount: "0",
    });
    assert.equal(zeroResult.isValid, false);
    assert.equal(zeroResult.error, "Amount must be a valid positive number.");

    const negativeResult = validateExpenseInput({
      ...validPayload,
      amount: "-500",
    });
    assert.equal(negativeResult.isValid, false);
    assert.equal(negativeResult.error, "Amount must be a valid positive number.");
  });

  it("fails when amount is not a number", () => {
    const result = validateExpenseInput({
      ...validPayload,
      amount: "invalid-number",
    });
    assert.equal(result.isValid, false);
    assert.equal(result.error, "Amount must be a valid positive number.");
  });

  it("fails when accountId is missing or empty", () => {
    const result = validateExpenseInput({
      ...validPayload,
      accountId: "",
    });
    assert.equal(result.isValid, false);
    assert.equal(result.error, "Please select a payment account.");
  });

  it("fails when date is missing or empty", () => {
    const result = validateExpenseInput({
      ...validPayload,
      date: "",
    });
    assert.equal(result.isValid, false);
    assert.equal(result.error, "Date is required.");
  });
});

describe("Expense Permission Utility (canManageExpense)", () => {
  it("allows admin role to edit and delete expenses", () => {
    assert.equal(canManageExpense("admin"), true);
  });

  it("allows user view (moderator role) to edit and delete expenses", () => {
    assert.equal(canManageExpense("moderator"), true);
  });

  it("disallows unauthenticated or null user role", () => {
    assert.equal(canManageExpense(null), false);
    assert.equal(canManageExpense(undefined), false);
    assert.equal(canManageExpense("guest"), false);
  });
});

