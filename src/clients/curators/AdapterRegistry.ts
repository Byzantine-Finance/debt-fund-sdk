import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";
import { getTimelock } from "./Timelock";

// ========================================
// ADAPTER REGISTRY
// ========================================

/**
 * Submit a request to set adapter registry (requires timelock)
 * @param vaultContract The vault contract instance
 * @param newAdapterRegistry The new adapter registry address
 * @returns Transaction response
 */
export async function submitAdapterRegistry(
  vaultContract: ethers.Contract,
  newAdapterRegistry: string
): Promise<ethers.TransactionResponse> {
  const calldata = vaultContract.interface.encodeFunctionData(
    "setAdapterRegistry",
    [newAdapterRegistry]
  );
  return await executeContractMethod(vaultContract, "submit", calldata);
}

/**
 * Execute adapter registry change after timelock period expires
 * @param vaultContract The vault contract instance
 * @param newAdapterRegistry The new adapter registry address
 * @returns Transaction response
 */
export async function setAdapterRegistryAfterTimelock(
  vaultContract: ethers.Contract,
  newAdapterRegistry: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "setAdapterRegistry",
    newAdapterRegistry
  );
}

/**
 * Instantly set adapter registry if current timelock is 0 (multicall submit + execute)
 * @param vaultContract The vault contract instance
 * @param newAdapterRegistry The new adapter registry address
 * @returns Transaction response
 */
export async function instantSetAdapterRegistry(
  vaultContract: ethers.Contract,
  newAdapterRegistry: string
): Promise<ethers.TransactionResponse> {
  // Check if timelock is 0
  const timelock = await getTimelock(vaultContract, "setAdapterRegistry");

  if (timelock !== 0n) {
    throw new Error(
      `Cannot instant set: timelock for setAdapterRegistry is not 0 (current: ${timelock})`
    );
  }

  // Use multicall to submit and execute in one transaction
  const calldataSet = vaultContract.interface.encodeFunctionData(
    "setAdapterRegistry",
    [newAdapterRegistry]
  );
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataSet,
  ]);

  return await executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataSet,
  ]);
}

/**
 * Get the current adapter registry address
 * @param vaultContract The vault contract instance
 * @returns The adapter registry address
 */
export async function getAdapterRegistry(
  vaultContract: ethers.Contract
): Promise<string> {
  return await callContractMethod(vaultContract, "adapterRegistry");
}
