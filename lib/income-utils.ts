/**
 * Utility functions, validation, and permissions for Custom Income operations.
 */

export interface Income {
  id: string;
  title: string;
  amount: number;
  accountId: string;
  accountName?: string;
  date: string;
  note?: string;
  incomeType?: "business" | "personal" | "other";
  shared: boolean;
  createdBy: string;
  createdByEmail?: string;
  createdAt: string;
}

export interface IncomeValidationInput {
  title: string;
  amount: string | number;
  accountId: string;
  date: string;
}

export interface IncomeValidationResult {
  isValid: boolean;
  error: string | null;
  parsedAmount: number;
}

/**
 * Validates income form fields for create and edit operations.
 */
export function validateIncomeInput(
  input: IncomeValidationInput
): IncomeValidationResult {
  const trimmedTitle = (input.title || "").trim();
  if (!trimmedTitle) {
    return {
      isValid: false,
      error: "Income title is required.",
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
      error: "Please select a deposit account.",
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
 * Determines whether a user profile is authorized to edit or delete an income entry in the UI.
 * Consistent with sales and expenses permissions where both admin and moderator
 * can manage records.
 */
export function canManageIncome(
  userRole?: "admin" | "moderator" | string | null
): boolean {
  return userRole === "admin" || userRole === "moderator";
}

