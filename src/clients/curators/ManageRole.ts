import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";

/**
 * Role management functions for vault owners
 */

/**
 * Set a new allocator for the vault
 * @param vaultContract The vault contract instance
 * @param newAllocator The address of the new allocator
 * @param isAllocator Whether the account is a allocator
 * @returns Transaction response
 */
export async function setIsAllocator(
  vaultContract: ethers.Contract,
  newAllocator: string,
  isAllocator: boolean
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "setIsAllocator",
    newAllocator,
    isAllocator
  );
}

// ========================================
// READ FUNCTIONS - Role Information
// ========================================

/**
 * Check if an account is a allocator
 * @param vaultContract The vault contract instance
 * @param account The account address to check
 * @returns True if the account is a allocator
 */
export async function getIsAllocator(
  vaultContract: ethers.Contract,
  account: string
): Promise<boolean> {
  return await callContractMethod(vaultContract, "isAllocator", account);
}
