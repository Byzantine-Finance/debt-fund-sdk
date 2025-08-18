import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";
import { getTimelock } from "./Timelock";
import { TimelockFunction } from "./Timelock";

// ========================================
// HELPERS - to reduce repetitive code
// ========================================

/**
 * Helper for submit increase cap functions
 */
async function submitIncreaseCapFunction(
  vaultContract: ethers.Contract,
  functionName: string,
  idData: string,
  newCap: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "submit", [
    vaultContract.interface.encodeFunctionData(functionName, [idData, newCap]),
  ]);
}

/**
 * Helper for instant increase cap functions
 */
async function instantIncreaseCapFunction(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  idData: string,
  newCap: bigint
): Promise<ethers.TransactionResponse> {
  try {
    // Use multicall to submit and execute in one transaction
    const calldataSet = vaultContract.interface.encodeFunctionData(
      functionName,
      [idData, newCap]
    );
    const calldataSubmit = vaultContract.interface.encodeFunctionData(
      "submit",
      [calldataSet]
    );

    return await executeContractMethod(vaultContract, "multicall", [
      calldataSubmit,
      calldataSet,
    ]);
  } catch (error) {
    // If error, it might be because the timelock is not 0
    const timelock = await getTimelock(vaultContract, functionName);

    if (timelock !== 0n) {
      throw new Error(
        `Cannot instant set: timelock for ${functionName} is not 0 (current: ${timelock})`
      );
    }
    throw error;
  }
}

// ========================================
// INCREASE ABSOLUTE CAP
// ========================================

export async function submitIncreaseAbsoluteCap(
  vaultContract: ethers.Contract,
  idData: string,
  newAbsoluteCap: bigint
): Promise<ethers.TransactionResponse> {
  return submitIncreaseCapFunction(
    vaultContract,
    "increaseAbsoluteCap",
    idData,
    newAbsoluteCap
  );
}

export async function setIncreaseAbsoluteCapAfterTimelock(
  vaultContract: ethers.Contract,
  idData: string,
  newAbsoluteCap: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "increaseAbsoluteCap", [
    idData,
    newAbsoluteCap,
  ]);
}

export async function instantIncreaseAbsoluteCap(
  vaultContract: ethers.Contract,
  idData: string,
  newAbsoluteCap: bigint
): Promise<ethers.TransactionResponse> {
  return instantIncreaseCapFunction(
    vaultContract,
    "increaseAbsoluteCap",
    idData,
    newAbsoluteCap
  );
}

// ========================================
// INCREASE RELATIVE CAP
// ========================================

export async function submitIncreaseRelativeCap(
  vaultContract: ethers.Contract,
  idData: string,
  newRelativeCap: bigint
): Promise<ethers.TransactionResponse> {
  return submitIncreaseCapFunction(
    vaultContract,
    "increaseRelativeCap",
    idData,
    newRelativeCap
  );
}

export async function setIncreaseRelativeCapAfterTimelock(
  vaultContract: ethers.Contract,
  idData: string,
  newRelativeCap: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "increaseRelativeCap", [
    idData,
    newRelativeCap,
  ]);
}

export async function instantIncreaseRelativeCap(
  vaultContract: ethers.Contract,
  idData: string,
  newRelativeCap: bigint
): Promise<ethers.TransactionResponse> {
  return instantIncreaseCapFunction(
    vaultContract,
    "increaseRelativeCap",
    idData,
    newRelativeCap
  );
}

// ========================================
// DECREASE ABSOLUTE CAP
// ========================================

export async function decreaseAbsoluteCap(
  vaultContract: ethers.Contract,
  idData: string,
  newAbsoluteCap: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "decreaseAbsoluteCap", [
    idData,
    newAbsoluteCap,
  ]);
}

// ========================================
// DECREASE RELATIVE CAP
// ========================================

export async function decreaseRelativeCap(
  vaultContract: ethers.Contract,
  idData: string,
  newRelativeCap: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "decreaseRelativeCap", [
    idData,
    newRelativeCap,
  ]);
}

// ========================================
// READ FUNCTIONS
// ========================================

export async function getAbsoluteCap(
  vaultContract: ethers.Contract,
  id: number
): Promise<bigint> {
  // Convert the number id to bytes32
  const idBytes32 = ethers.zeroPadValue(ethers.toBeHex(id), 32);
  return callContractMethod(vaultContract, "absoluteCap", [idBytes32]);
}

export async function getRelativeCap(
  vaultContract: ethers.Contract,
  id: number
): Promise<bigint> {
  // Convert the number id to bytes32
  const idBytes32 = ethers.zeroPadValue(ethers.toBeHex(id), 32);
  return callContractMethod(vaultContract, "relativeCap", [idBytes32]);
}
