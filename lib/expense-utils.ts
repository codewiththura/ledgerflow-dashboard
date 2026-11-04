/**
 * Utility functions, validation, and permissions for Expense operations.
 */

export interface ExpenseValidationInput {
  title: string;
  amount: string | number;
  accountId: string;
  date: string;
}

export interface ExpenseValidationResult {
  isValid: boolean;
  error: string | null;
  parsedAmount: number;
}

/**
 * Validates expense form fields for create and edit operations.
 */
export function validateExpenseInput(
  input: ExpenseValidationInput
): ExpenseValidationResult {
  const trimmedTitle = (input.title || "").trim();
  if (!trimmedTitle) {
    return {
      isValid: false,
      error: "Expense title is required.",
      parsedAmount: 0,
    };
  }

  const parsedAmount =
    typeof input.amount === "number" ? input.amount : parseFloat(input.amount);

  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return {
      isValid: false,
      error: "Amount must be a valid positive number.",
      parsedAmount: 0,
    };
  }

  if (!input.accountId || !input.accountId.trim()) {
    return {
      isValid: false,
      error: "Please select a payment account.",
      parsedAmount: 0,
    };
  }

  if (!input.date || !input.date.trim()) {
    return {
      isValid: false,
      error: "Date is required.",
      parsedAmount: 0,
    };
  }

  return {
    isValid: true,
    error: null,
    parsedAmount,
  };
}

/**
 * Determines whether a user profile is authorized to edit or delete an expense in the UI.
 * Consistent with sales permissions where both admin and user view (moderator)
 * can modify and delete accessible records.
 */
export function canManageExpense(
  userRole?: "admin" | "moderator" | string | null
): boolean {
  return userRole === "admin" || userRole === "moderator";
}

