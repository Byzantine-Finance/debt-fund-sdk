import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";

/**
 * Role management functions for vault owners
 */

// Set a new owner	setOwner	address newOwner	Owner	Only one owner
// Set a new curator	setCurator	address newCurator	Owner	Only one curator
// Set or add a sentinel	setIsSentinel	address account, bool newIsSentinel	Owner	Can have multiple sentinels

/**
 * Set a new owner for the vault
 * @param vaultContract The vault contract instance
 * @param newOwner The address of the new owner
 * @returns Transaction response
 */
export async function setOwner(
  vaultContract: ethers.Contract,
  newOwner: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(vaultContract, "setOwner", newOwner);
}

/**
 * Set a new curator for the vault
 * @param vaultContract The vault contract instance
 * @param newCurator The address of the new curator
 * @returns Transaction response
 */
export async function setCurator(
  vaultContract: ethers.Contract,
  newCurator: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(vaultContract, "setCurator", newCurator);
}

/**
 * Add an account as a sentinel
 * @param vaultContract The vault contract instance
 * @param account The account address to add as sentinel
 * @param isSentinel Whether the account is a sentinel
 * @returns Transaction response
 */
export async function setIsSentinel(
  vaultContract: ethers.Contract,
  account: string,
  isSentinel: boolean
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "setIsSentinel",
    account,
    isSentinel
  );
}

// ========================================
// READ FUNCTIONS - Role Information
// ========================================

/**
 * Get the current owner of the vault
 * @param vaultContract The vault contract instance
 * @returns The owner address
 */
export async function getOwner(
  vaultContract: ethers.Contract
): Promise<string> {
  return await callContractMethod(vaultContract, "owner");
}

/**
 * Get the current curator of the vault
 * @param vaultContract The vault contract instance
 * @returns The curator address
 */
export async function getCurator(
  vaultContract: ethers.Contract
): Promise<string> {
  return await callContractMethod(vaultContract, "curator");
}

/**
 * Check if an account is a sentinel
 * @param vaultContract The vault contract instance
 * @param account The account address to check
 * @returns True if the account is a sentinel
 */
export async function isSentinel(
  vaultContract: ethers.Contract,
  account: string
): Promise<boolean> {
  return await callContractMethod(vaultContract, "isSentinel", account);
}
