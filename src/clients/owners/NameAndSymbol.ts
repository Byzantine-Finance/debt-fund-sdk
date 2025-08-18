import { ethers } from "ethers";
import { executeContractMethod } from "../../utils";

/**
 * Name and Symbol management functions for vault owners
 */

/**
 * Set a new name for the vault
 * @param vaultContract The vault contract instance
 * @param newName The new name for the vault
 * @returns Transaction response
 */
export async function setName(
  vaultContract: ethers.Contract,
  newName: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(vaultContract, "setName", newName);
}

/**
 * Set a new symbol for the vault
 * @param vaultContract The vault contract instance
 * @param newSymbol The new symbol for the vault
 * @returns Transaction response
 */
export async function setSymbol(
  vaultContract: ethers.Contract,
  newSymbol: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(vaultContract, "setSymbol", newSymbol);
}

/**
 * Set both name and symbol for the vault in a single transaction using multicall
 * @param vaultContract The vault contract instance
 * @param newName The new name for the vault
 * @param newSymbol The new symbol for the vault
 * @returns Transaction response
 */
export async function setNameAndSymbol(
  vaultContract: ethers.Contract,
  newName: string,
  newSymbol: string
): Promise<ethers.TransactionResponse> {
  // Encode the setName call
  const calldataSetName = vaultContract.interface.encodeFunctionData(
    "setName",
    [newName]
  );

  // Encode the setSymbol call
  const calldataSetSymbol = vaultContract.interface.encodeFunctionData(
    "setSymbol",
    [newSymbol]
  );

  // Execute multicall with both operations
  return await executeContractMethod(vaultContract, "multicall", [
    calldataSetName,
    calldataSetSymbol,
  ]);
}

export async function getVaultName(
  vaultContract: ethers.Contract
): Promise<string> {
  return await vaultContract.name();
}

export async function getVaultSymbol(
  vaultContract: ethers.Contract
): Promise<string> {
  return await vaultContract.symbol();
}
