import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";

/**
 * Role management functions for vault owners
 */

/**
 * Set a new allocator for the vault
 * This function is used to submit a new allocator for the vault
 * Then the curator will have to call the setIsAllocatorAfterTimelock function to set the allocator
 * @param vaultContract The vault contract instance
 * @param newAllocator The address of the new allocator
 * @param isAllocator Whether the account is a allocator
 * @returns Transaction response
 */
export async function submitIsAllocator(
  vaultContract: ethers.Contract,
  newAllocator: string,
  isAllocator: boolean
): Promise<ethers.TransactionResponse> {
  const callData = vaultContract.interface.encodeFunctionData(
    "setIsAllocator",
    [newAllocator, isAllocator]
  );
  return await executeContractMethod(vaultContract, "submit", callData);
}

/**
 * Set a new allocator for the vault after timelock
 * This function is used to set a new allocator for the vault after the timelock has passed
 * @param vaultContract The vault contract instance
 * @param newAllocator The address of the new allocator
 * @param isAllocator Whether the account is a allocator
 * @returns Transaction response
 */
export async function setIsAllocatorAfterTimelock(
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

/**
 * Instant set a new allocator for the vault
 * This function is used to set a new allocator for the vault without timelock
 * @param vaultContract The vault contract instance
 * @param newAllocator The address of the new allocator
 * @param isAllocator Whether the account is a allocator
 * @returns Transaction response
 */
export async function instantSetIsAllocator(
  vaultContract: ethers.Contract,
  newAllocator: string,
  isAllocator: boolean
): Promise<ethers.TransactionResponse> {
  const calldataSet = vaultContract.interface.encodeFunctionData(
    "setIsAllocator",
    [newAllocator, isAllocator]
  );
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataSet,
  ]);
  return await executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataSet,
  ]);
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
