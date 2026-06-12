import { db } from "./firebase";
import {
  collection,
  doc,
  runTransaction,
  addDoc,
  getDocs,
  query,
  where,
  writeBatch
} from "firebase/firestore";

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  currentBalance: number;
  createdBy: string;
  createdAt: string;
}

export interface AccountAdjustment {
  id: string;
  accountId: string;
  accountName: string;
  type: "in" | "out";
  amount: number;
  reason: string;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  date: string;
}

/**
 * Resolves an account ID by matching the name.
 * Used for backward compatibility with historical sales.
 */
export async function getAccountIdByName(name: string): Promise<string | null> {
  try {
    const q = query(collection(db, "accounts"), where("name", "==", name));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id;
    }
  } catch (err) {
    console.error("Error in getAccountIdByName:", err);
  }
  return null;
}

/**
 * Automatically creates default 'Kpay' and 'Aya' accounts if no accounts exist.
 */
export async function initializeDefaultAccounts(createdBy: string) {
  try {
    const accountsRef = collection(db, "accounts");
    const snap = await getDocs(accountsRef);
    if (snap.empty) {
      console.log("Initializing default accounts 'Kpay' and 'Aya'...");
      await addDoc(accountsRef, {
        name: "Kpay",
        initialBalance: 0,
        currentBalance: 0,
        createdBy,
        createdAt: new Date().toISOString()
      });
      await addDoc(accountsRef, {
        name: "Aya",
        initialBalance: 0,
        currentBalance: 0,
        createdBy,
        createdAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error("Failed to initialize default accounts:", err);
  }
}

/**
 * Creates a new account.
 */
export async function createAccount(name: string, initialBalance: number, createdBy: string) {
  const normalizedName = name.trim();
  const q = query(collection(db, "accounts"), where("name", "==", normalizedName));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error(`Account with name "${normalizedName}" already exists.`);
  }

  const accountsRef = collection(db, "accounts");
  await addDoc(accountsRef, {
    name: normalizedName,
    initialBalance,
    currentBalance: initialBalance,
    createdBy,
    createdAt: new Date().toISOString()
  });
}

/**
 * Adjusts the balance of an account and logs the adjustment.
 */
export async function adjustAccountBalance(
  accountId: string,
  type: "in" | "out",
  amount: number,
  reason: string,
  createdBy: string,
  createdByEmail: string
) {
  await runTransaction(db, async (transaction) => {
    const accountRef = doc(db, "accounts", accountId);
    const accountSnap = await transaction.get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Account does not exist.");
    }
    const accountData = accountSnap.data();
    
    let newBalance = accountData.currentBalance || 0;
    if (type === "in") {
      newBalance += amount;
    } else {
      newBalance -= amount;
    }

    const adjustmentsCollectionRef = collection(db, "account_adjustments");
    const newAdjustmentRef = doc(adjustmentsCollectionRef);

    transaction.update(accountRef, {
      currentBalance: newBalance
    });

    transaction.set(newAdjustmentRef, {
      accountId,
      accountName: accountData.name,
      type,
      amount,
      reason: reason.trim(),
      createdBy,
      createdByEmail,
      createdAt: new Date().toISOString(),
      date: new Date().toISOString().split("T")[0]
    });
  });
}

/**
 * Records a sale transaction and updates the account balance.
 */
export async function createSaleTransaction(saleData: any, accountId: string) {
  await runTransaction(db, async (transaction) => {
    const accountRef = doc(db, "accounts", accountId);
    const accountSnap = await transaction.get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Account does not exist.");
    }
    const accountData = accountSnap.data();
    const newBalance = (accountData.currentBalance || 0) + saleData.total;

    const salesCollectionRef = collection(db, "sales");
    const newSaleRef = doc(salesCollectionRef);

    transaction.set(newSaleRef, {
      ...saleData,
      accountId,
      transactionMethod: accountData.name
    });

    transaction.update(accountRef, {
      currentBalance: newBalance
    });
  });
}

/**
 * Updates a sale transaction and adjusts account balances accordingly.
 */
export async function updateSaleTransaction(
  saleId: string,
  updatedSaleData: any,
  oldSaleData: any
) {
  await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    
    const oldAccountId = oldSaleData.accountId;
    const newAccountId = updatedSaleData.accountId;

    if (oldAccountId && oldAccountId === newAccountId) {
      // Same account, update balance by the difference
      const accountRef = doc(db, "accounts", newAccountId);
      const accountSnap = await transaction.get(accountRef);
      if (!accountSnap.exists()) {
        throw new Error("Account does not exist.");
      }
      const accountData = accountSnap.data();
      const difference = updatedSaleData.total - (oldSaleData.total || 0);
      const newBalance = (accountData.currentBalance || 0) + difference;

      transaction.update(saleRef, {
        ...updatedSaleData,
        transactionMethod: accountData.name
      });
      transaction.update(accountRef, {
        currentBalance: newBalance
      });
    } else {
      // Account changed or old sale did not have an accountId
      
      // 1. Perform all reads first
      let oldAccountSnap = null;
      if (oldAccountId) {
        const oldAccountRef = doc(db, "accounts", oldAccountId);
        oldAccountSnap = await transaction.get(oldAccountRef);
      }

      const newAccountRef = doc(db, "accounts", newAccountId);
      const newAccountSnap = await transaction.get(newAccountRef);
      
      // 2. Perform all writes next
      if (oldAccountId && oldAccountSnap && oldAccountSnap.exists()) {
        const oldAccountData = oldAccountSnap.data();
        const newOldBalance = (oldAccountData.currentBalance || 0) - (oldSaleData.total || 0);
        const oldAccountRef = doc(db, "accounts", oldAccountId);
        transaction.update(oldAccountRef, {
          currentBalance: newOldBalance
        });
      }

      if (!newAccountSnap.exists()) {
        throw new Error("New account does not exist.");
      }
      const newAccountData = newAccountSnap.data();
      const newNewBalance = (newAccountData.currentBalance || 0) + updatedSaleData.total;

      transaction.update(saleRef, {
        ...updatedSaleData,
        transactionMethod: newAccountData.name
      });
      transaction.update(newAccountRef, {
        currentBalance: newNewBalance
      });
    }
  });
}

/**
 * Deletes a sale transaction and removes its total from the associated account balance.
 */
export async function deleteSaleTransaction(saleId: string, saleData: any) {
  await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const accountId = saleData.accountId;

    if (accountId) {
      const accountRef = doc(db, "accounts", accountId);
      const accountSnap = await transaction.get(accountRef);
      if (accountSnap.exists()) {
        const accountData = accountSnap.data();
        const newBalance = (accountData.currentBalance || 0) - (saleData.total || 0);
        transaction.update(accountRef, {
          currentBalance: newBalance
        });
      }
    }
    
    transaction.delete(saleRef);
  });
}

/**
 * Updates an account's name and synchronizes the change to all associated sales and adjustments.
 */
export async function updateAccountName(accountId: string, oldName: string, newName: string) {
  const normalizedNewName = newName.trim();
  if (!normalizedNewName) {
    throw new Error("Account name cannot be empty.");
  }
  if (normalizedNewName.toLowerCase() === oldName.toLowerCase()) {
    if (normalizedNewName === oldName) return;
  } else {
    // Check if new name already exists
    const q = query(collection(db, "accounts"), where("name", "==", normalizedNewName));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`Account with name "${normalizedNewName}" already exists.`);
    }
  }

  // 1. Get all sales referencing this account (by accountId, or by oldName for historical sales)
  const salesQuery1 = query(collection(db, "sales"), where("accountId", "==", accountId));
  const salesQuery2 = query(collection(db, "sales"), where("transactionMethod", "==", oldName));
  
  // Get adjustments matching this account
  const adjustmentsQuery = query(collection(db, "account_adjustments"), where("accountId", "==", accountId));

  const [snap1, snap2, adjSnap] = await Promise.all([
    getDocs(salesQuery1),
    getDocs(salesQuery2),
    getDocs(adjustmentsQuery)
  ]);

  // Combine unique sales
  const saleDocsMap = new Map();
  snap1.docs.forEach((doc) => saleDocsMap.set(doc.id, doc));
  snap2.docs.forEach((doc) => saleDocsMap.set(doc.id, doc));

  const batch = writeBatch(db);

  // Update the account doc
  const accountRef = doc(db, "accounts", accountId);
  batch.update(accountRef, { name: normalizedNewName });

  // Update all referencing sales
  saleDocsMap.forEach((saleDoc) => {
    batch.update(saleDoc.ref, { transactionMethod: normalizedNewName });
  });

  // Update all referencing adjustments
  adjSnap.docs.forEach((adjDoc) => {
    batch.update(adjDoc.ref, { accountName: normalizedNewName });
  });

  await batch.commit();
}

/**
 * Recalculates all account balances by aggregating all sales, adjustments, and expenses,
 * and updates old sales records with the corresponding account ID if missing.
 */
export async function recalculateAccountBalances() {
  const accountsRef = collection(db, "accounts");
  const salesRef = collection(db, "sales");
  const adjustmentsRef = collection(db, "account_adjustments");
  const expensesRef = collection(db, "expenses");

  const [accountsSnap, salesSnap, adjustmentsSnap, expensesSnap] = await Promise.all([
    getDocs(accountsRef),
    getDocs(salesRef),
    getDocs(adjustmentsRef),
    getDocs(expensesRef)
  ]);

  const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  const sales = salesSnap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() } as any));
  const adjustments = adjustmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  const expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  // Initialize helper map for account current balances: accountId -> balance
  const accountBalances: { [key: string]: number } = {};
  const accountNamesToIds: { [key: string]: string } = {};

  accounts.forEach(acc => {
    accountBalances[acc.id] = acc.initialBalance || 0;
    accountNamesToIds[acc.name.toLowerCase()] = acc.id;
  });

  const salesToUpdate: { ref: any; updates: any }[] = [];

  // Accumulate sales
  sales.forEach(sale => {
    let targetAccountId = sale.accountId;

    // If no accountId, try to match by transactionMethod
    if (!targetAccountId && sale.transactionMethod) {
      targetAccountId = accountNamesToIds[sale.transactionMethod.toLowerCase()];
      if (targetAccountId) {
        salesToUpdate.push({
          ref: sale.ref,
          updates: { accountId: targetAccountId }
        });
      }
    }

    if (targetAccountId && accountBalances[targetAccountId] !== undefined) {
      accountBalances[targetAccountId] += (sale.total || 0);
    }
  });

  // Accumulate adjustments
  adjustments.forEach(adj => {
    const targetAccountId = adj.accountId;
    if (targetAccountId && accountBalances[targetAccountId] !== undefined) {
      if (adj.type === "in") {
        accountBalances[targetAccountId] += (adj.amount || 0);
      } else if (adj.type === "out") {
        accountBalances[targetAccountId] -= (adj.amount || 0);
      }
    }
  });

  // Deduct expenses
  expenses.forEach(exp => {
    const targetAccountId = exp.accountId;
    if (targetAccountId && accountBalances[targetAccountId] !== undefined) {
      accountBalances[targetAccountId] -= (exp.amount || 0);
    }
  });

  // Commit updates using batch writes
  let batch = writeBatch(db);
  let opCount = 0;

  // 1. Update account balances
  for (const accId of Object.keys(accountBalances)) {
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    const accRef = doc(db, "accounts", accId);
    batch.update(accRef, { currentBalance: accountBalances[accId] });
    opCount++;
  }

  // 2. Update sales needing account ID link
  for (const saleUpdate of salesToUpdate) {
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    batch.update(saleUpdate.ref, saleUpdate.updates);
    opCount++;
  }

  if (opCount > 0) {
    await batch.commit();
  }
}

/**
 * Records an expense transaction and subtracts the amount from the account balance.
 */
export async function createExpenseTransaction(expenseData: any, accountId: string) {
  await runTransaction(db, async (transaction) => {
    const accountRef = doc(db, "accounts", accountId);
    const accountSnap = await transaction.get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Account does not exist.");
    }
    const accountData = accountSnap.data();
    const newBalance = (accountData.currentBalance || 0) - expenseData.amount;

    const expensesCollectionRef = collection(db, "expenses");
    const newExpenseRef = doc(expensesCollectionRef);

    transaction.set(newExpenseRef, {
      ...expenseData,
      accountId,
      accountName: accountData.name
    });

    transaction.update(accountRef, {
      currentBalance: newBalance
    });
  });
}

/**
 * Updates an expense transaction and adjusts account balances accordingly.
 */
export async function updateExpenseTransaction(
  expenseId: string,
  updatedExpenseData: any,
  oldExpenseData: any
) {
  await runTransaction(db, async (transaction) => {
    const expenseRef = doc(db, "expenses", expenseId);
    const oldAccountId = oldExpenseData.accountId;
    const newAccountId = updatedExpenseData.accountId;

    if (oldAccountId && oldAccountId === newAccountId) {
      // Same account, update balance by the difference
      const accountRef = doc(db, "accounts", newAccountId);
      const accountSnap = await transaction.get(accountRef);
      if (!accountSnap.exists()) {
        throw new Error("Account does not exist.");
      }
      const accountData = accountSnap.data();
      const difference = updatedExpenseData.amount - (oldExpenseData.amount || 0);
      const newBalance = (accountData.currentBalance || 0) - difference;

      transaction.update(expenseRef, {
        ...updatedExpenseData,
        accountName: accountData.name
      });
      transaction.update(accountRef, {
        currentBalance: newBalance
      });
    } else {
      // Account changed or old expense did not have an accountId
      
      // 1. Perform all reads first
      let oldAccountSnap = null;
      if (oldAccountId) {
        const oldAccountRef = doc(db, "accounts", oldAccountId);
        oldAccountSnap = await transaction.get(oldAccountRef);
      }

      const newAccountRef = doc(db, "accounts", newAccountId);
      const newAccountSnap = await transaction.get(newAccountRef);

      // 2. Perform all writes next
      if (oldAccountId && oldAccountSnap && oldAccountSnap.exists()) {
        const oldAccountData = oldAccountSnap.data();
        const newOldBalance = (oldAccountData.currentBalance || 0) + (oldExpenseData.amount || 0);
        const oldAccountRef = doc(db, "accounts", oldAccountId);
        transaction.update(oldAccountRef, {
          currentBalance: newOldBalance
        });
      }

      if (!newAccountSnap.exists()) {
        throw new Error("New account does not exist.");
      }
      const newAccountData = newAccountSnap.data();
      const newNewBalance = (newAccountData.currentBalance || 0) - updatedExpenseData.amount;

      transaction.update(expenseRef, {
        ...updatedExpenseData,
        accountName: newAccountData.name
      });
      transaction.update(newAccountRef, {
        currentBalance: newNewBalance
      });
    }
  });
}

/**
 * Deletes an expense transaction and adds its amount back to the associated account balance.
 */
export async function deleteExpenseTransaction(expenseId: string, expenseData: any) {
  await runTransaction(db, async (transaction) => {
    const expenseRef = doc(db, "expenses", expenseId);
    const accountId = expenseData.accountId;

    if (accountId) {
      const accountRef = doc(db, "accounts", accountId);
      const accountSnap = await transaction.get(accountRef);
      if (accountSnap.exists()) {
        const accountData = accountSnap.data();
        const newBalance = (accountData.currentBalance || 0) + (expenseData.amount || 0);
        transaction.update(accountRef, {
          currentBalance: newBalance
        });
      }
    }

    transaction.delete(expenseRef);
  });
}

/**
 * Updates an account adjustment record and adjusts account balances accordingly.
 */
export async function updateAdjustmentTransaction(
  adjustmentId: string,
  updatedAdjData: any,
  oldAdjData: any
) {
  await runTransaction(db, async (transaction) => {
    const adjRef = doc(db, "account_adjustments", adjustmentId);
    const oldAccountId = oldAdjData.accountId;
    const newAccountId = updatedAdjData.accountId;

    if (oldAccountId && oldAccountId === newAccountId) {
      // Same account
      const accountRef = doc(db, "accounts", newAccountId);
      const accountSnap = await transaction.get(accountRef);
      if (!accountSnap.exists()) {
        throw new Error("Account does not exist.");
      }
      const accountData = accountSnap.data();

      // Revert old effect and apply new effect
      let balanceChange = 0;
      // Revert old
      if (oldAdjData.type === "in") {
        balanceChange -= (oldAdjData.amount || 0);
      } else {
        balanceChange += (oldAdjData.amount || 0);
      }
      // Apply new
      if (updatedAdjData.type === "in") {
        balanceChange += (updatedAdjData.amount || 0);
      } else {
        balanceChange -= (updatedAdjData.amount || 0);
      }

      const newBalance = (accountData.currentBalance || 0) + balanceChange;

      transaction.update(adjRef, {
        ...updatedAdjData,
        accountName: accountData.name
      });
      transaction.update(accountRef, {
        currentBalance: newBalance
      });
    } else {
      // Account changed
      
      // 1. Perform all reads first
      let oldAccountSnap = null;
      if (oldAccountId) {
        const oldAccountRef = doc(db, "accounts", oldAccountId);
        oldAccountSnap = await transaction.get(oldAccountRef);
      }

      const newAccountRef = doc(db, "accounts", newAccountId);
      const newAccountSnap = await transaction.get(newAccountRef);

      // 2. Perform all writes next
      if (oldAccountId && oldAccountSnap && oldAccountSnap.exists()) {
        const oldAccountData = oldAccountSnap.data();
        let oldAccountNewBalance = oldAccountData.currentBalance || 0;
        // Revert old effect
        if (oldAdjData.type === "in") {
          oldAccountNewBalance -= (oldAdjData.amount || 0);
        } else {
          oldAccountNewBalance += (oldAdjData.amount || 0);
        }
        transaction.update(doc(db, "accounts", oldAccountId), {
          currentBalance: oldAccountNewBalance
        });
      }

      if (!newAccountSnap.exists()) {
        throw new Error("New account does not exist.");
      }
      const newAccountData = newAccountSnap.data();
      let newAccountNewBalance = newAccountData.currentBalance || 0;
      // Apply new effect
      if (updatedAdjData.type === "in") {
        newAccountNewBalance += (updatedAdjData.amount || 0);
      } else {
        newAccountNewBalance -= (updatedAdjData.amount || 0);
      }

      transaction.update(adjRef, {
        ...updatedAdjData,
        accountName: newAccountData.name
      });
      transaction.update(newAccountRef, {
        currentBalance: newAccountNewBalance
      });
    }
  });
}

/**
 * Deletes an account adjustment record and reverts its effect on the account balance.
 */
export async function deleteAdjustmentTransaction(adjustmentId: string, adjData: any) {
  await runTransaction(db, async (transaction) => {
    const adjRef = doc(db, "account_adjustments", adjustmentId);
    const accountId = adjData.accountId;

    if (accountId) {
      const accountRef = doc(db, "accounts", accountId);
      const accountSnap = await transaction.get(accountRef);
      if (accountSnap.exists()) {
        const accountData = accountSnap.data();
        let newBalance = accountData.currentBalance || 0;
        // Revert effect
        if (adjData.type === "in") {
          newBalance -= (adjData.amount || 0);
        } else {
          newBalance += (adjData.amount || 0);
        }
        transaction.update(accountRef, {
          currentBalance: newBalance
        });
      }
    }

    transaction.delete(adjRef);
  });
}

/**
 * Updates an account's name and/or initial balance, adjusting current balance accordingly,
 * and records an adjustment log if the initial balance is edited.
 */
export async function updateAccountDetails(
  accountId: string,
  oldName: string,
  newName: string,
  oldInitialBalance: number,
  newInitialBalance: number,
  createdBy: string,
  createdByEmail: string
) {
  const normalizedNewName = newName.trim();
  if (!normalizedNewName) {
    throw new Error("Account name cannot be empty.");
  }

  // 1. Verify name uniqueness if changed
  if (normalizedNewName.toLowerCase() !== oldName.toLowerCase()) {
    const q = query(collection(db, "accounts"), where("name", "==", normalizedNewName));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`Account with name "${normalizedNewName}" already exists.`);
    }
  }

  // 2. Perform updates in a transaction
  await runTransaction(db, async (transaction) => {
    const accountRef = doc(db, "accounts", accountId);
    const accountSnap = await transaction.get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Account does not exist.");
    }
    const accountData = accountSnap.data();

    // Calculate current balance change if initial balance changed
    const initialBalanceDiff = newInitialBalance - oldInitialBalance;
    const newCurrentBalance = (accountData.currentBalance || 0) + initialBalanceDiff;

    // Update account doc
    transaction.update(accountRef, {
      name: normalizedNewName,
      initialBalance: newInitialBalance,
      currentBalance: newCurrentBalance
    });

    // If initial balance changed, create a log record
    if (initialBalanceDiff !== 0) {
      const adjustmentsCollectionRef = collection(db, "account_adjustments");
      const newAdjustmentRef = doc(adjustmentsCollectionRef);
      transaction.set(newAdjustmentRef, {
        accountId,
        accountName: normalizedNewName,
        type: "initial_balance",
        amount: newInitialBalance,
        reason: `Initial balance updated from Ks ${oldInitialBalance.toLocaleString()} to Ks ${newInitialBalance.toLocaleString()}`,
        createdBy,
        createdByEmail,
        createdAt: new Date().toISOString(),
        date: new Date().toISOString().split("T")[0]
      });
    }
  });

  // 3. If name changed, rename associated records in batch
  if (normalizedNewName.toLowerCase() !== oldName.toLowerCase()) {
    const salesQuery1 = query(collection(db, "sales"), where("accountId", "==", accountId));
    const salesQuery2 = query(collection(db, "sales"), where("transactionMethod", "==", oldName));
    const adjustmentsQuery = query(collection(db, "account_adjustments"), where("accountId", "==", accountId));

    const [snap1, snap2, adjSnap] = await Promise.all([
      getDocs(salesQuery1),
      getDocs(salesQuery2),
      getDocs(adjustmentsQuery)
    ]);

    const saleDocsMap = new Map();
    snap1.docs.forEach((doc) => saleDocsMap.set(doc.id, doc));
    snap2.docs.forEach((doc) => saleDocsMap.set(doc.id, doc));

    const batch = writeBatch(db);

    saleDocsMap.forEach((saleDoc) => {
      batch.update(saleDoc.ref, { transactionMethod: normalizedNewName });
    });

    adjSnap.docs.forEach((adjDoc) => {
      batch.update(adjDoc.ref, { accountName: normalizedNewName });
    });

    await batch.commit();
  }
}


