// function submitPerformanceFee(underlyingVault: string, performanceFee: bigint)
// function setPerformanceFeeAfterTimelock(underlyingVault: string, performanceFee: bigint)
// function instantSetPerformanceFee(underlyingVault: string, performanceFee: bigint) // qui va faire submitPerformanceFee et setPerformanceFeeAfterTimelock dans un multicall, mais uniquement si le timelock est à 0, tu vas check avant

// function submitManagementFee(underlyingVault: string, managementFee: bigint)
// function setManagementFeeAfterTimelock(underlyingVault: string, managementFee: bigint)
// function instantSetManagementFee(underlyingVault: string, managementFee: bigint) // qui va faire submitManagementFee et setManagementFeeAfterTimelock dans un multicall, mais uniquement si le timelock est à 0, tu vas check avant

// function submitPerformanceFeeRecipient(underlyingVault: string, newFeeRecipient: string)
// function setPerformanceFeeRecipientAfterTimelock(underlyingVault: string, newFeeRecipient: string)
// function instantSetPerformanceFeeRecipient(underlyingVault: string, newFeeRecipient: string) // qui va faire submitPerformanceFeeRecipient et setPerformanceFeeRecipientAfterTimelock dans un multicall, mais uniquement si le timelock est à 0, tu vas check avant

// function submitManagementFeeRecipient(underlyingVault: string, newFeeRecipient: string)
// function setManagementFeeRecipientAfterTimelock(underlyingVault: string, newFeeRecipient: string)
// function instantSetManagementFeeRecipient(underlyingVault: string, newFeeRecipient: string) // qui va faire submitManagementFeeRecipient et setManagementFeeRecipientAfterTimelock dans un multicall, mais uniquement si le timelock est à 0, tu vas check avant

// function submitForceDeallocatePenalty(underlyingVault: string, adapter: string, newForceDeallocatePenalty: bigint)
// function setForceDeallocatePenaltyAfterTimelock(underlyingVault: string, adapter: string, newForceDeallocatePenalty: bigint)
// function instantSetForceDeallocatePenalty(underlyingVault: string, adapter: string, newForceDeallocatePenalty: bigint) // qui va faire submitForceDeallocatePenalty et setForceDeallocatePenaltyAfterTimelock dans un multicall, mais uniquement si le timelock est à 0, tu vas check avant

// function getPerformanceFee(underlyingVault: string) // return performanceFee
// function getPerformanceFeeRecipient(underlyingVault: string) // return performanceFeeRecipient
// function getManagementFee(underlyingVault: string) // return managementFee
// function getManagementFeeRecipient(underlyingVault: string) // return managementFeeRecipient
// function getForceDeallocatePenalty(underlyingVault: string) // return forceDeallocatePenalty

import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";
import { getTimelock } from "./Timelock";
import { TimelockFunction } from "./Timelock";

// ========================================
// HELPERS - to reduce repetitive code
// ========================================

/**
 * Helper for submit functions with bigint parameter
 */
async function submitFeeFunction(
  vaultContract: ethers.Contract,
  functionName: string,
  value: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "submit", [
    vaultContract.interface.encodeFunctionData(functionName, [value]),
  ]);
}

/**
 * Helper for submit functions with string parameter
 */
async function submitFeeRecipientFunction(
  vaultContract: ethers.Contract,
  functionName: string,
  receiver: string
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "submit", [
    vaultContract.interface.encodeFunctionData(functionName, [receiver]),
  ]);
}

/**
 * Helper for submit functions with string and bigint parameters
 */
async function submitForceDeallocatePenaltyFunction(
  vaultContract: ethers.Contract,
  adapter: string,
  penalty: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "submit", [
    vaultContract.interface.encodeFunctionData("setForceDeallocatePenalty", [
      adapter,
      penalty,
    ]),
  ]);
}

/**
 * Helper for instant functions
 */
async function instantSetFeeFunction(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  value: bigint
): Promise<ethers.TransactionResponse> {
  // Check if timelock is 0
  const timelock = await getTimelock(vaultContract, functionName);

  if (timelock !== 0n) {
    throw new Error(
      `Cannot instant set: timelock for ${functionName} is not 0 (current: ${timelock})`
    );
  }

  // Use multicall to submit and execute in one transaction
  const calldataSet = vaultContract.interface.encodeFunctionData(functionName, [
    value,
  ]);
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataSet,
  ]);

  return executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataSet,
  ]);
}

/**
 * Helper for instant receiver functions
 */
async function instantSetFeeRecipientFunction(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  receiver: string
): Promise<ethers.TransactionResponse> {
  // Check if timelock is 0
  const timelock = await getTimelock(vaultContract, functionName);

  if (timelock !== 0n) {
    throw new Error(
      `Cannot instant set: timelock for ${functionName} is not 0 (current: ${timelock})`
    );
  }

  // Use multicall to submit and execute in one transaction
  const calldataSet = vaultContract.interface.encodeFunctionData(functionName, [
    receiver,
  ]);
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataSet,
  ]);

  return executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataSet,
  ]);
}

/**
 * Helper for instant force deallocate penalty function
 */
async function instantSetForceDeallocatePenaltyFunction(
  vaultContract: ethers.Contract,
  adapter: string,
  penalty: bigint
): Promise<ethers.TransactionResponse> {
  // Check if timelock is 0
  const timelock = await getTimelock(
    vaultContract,
    "setForceDeallocatePenalty"
  );

  if (timelock !== 0n) {
    throw new Error(
      `Cannot instant set: timelock for setForceDeallocatePenalty is not 0 (current: ${timelock})`
    );
  }

  // Use multicall to submit and execute in one transaction
  const calldataSet = vaultContract.interface.encodeFunctionData(
    "setForceDeallocatePenalty",
    [adapter, penalty]
  );
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataSet,
  ]);

  return executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataSet,
  ]);
}

// ========================================
// PERFORMANCE FEE
// ========================================

export async function submitPerformanceFee(
  vaultContract: ethers.Contract,
  performanceFee: bigint
): Promise<ethers.TransactionResponse> {
  return submitFeeFunction(vaultContract, "setPerformanceFee", performanceFee);
}

export async function setPerformanceFeeAfterTimelock(
  vaultContract: ethers.Contract,
  performanceFee: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "setPerformanceFee", [
    performanceFee,
  ]);
}

export async function instantSetPerformanceFee(
  vaultContract: ethers.Contract,
  performanceFee: bigint
): Promise<ethers.TransactionResponse> {
  return instantSetFeeFunction(
    vaultContract,
    "setPerformanceFee",
    performanceFee
  );
}

// ========================================
// MANAGEMENT FEE
// ========================================

export async function submitManagementFee(
  vaultContract: ethers.Contract,
  managementFee: bigint
): Promise<ethers.TransactionResponse> {
  return submitFeeFunction(vaultContract, "setManagementFee", managementFee);
}

export async function setManagementFeeAfterTimelock(
  vaultContract: ethers.Contract,
  managementFee: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "setManagementFee", [
    managementFee,
  ]);
}

export async function instantSetManagementFee(
  vaultContract: ethers.Contract,
  managementFee: bigint
): Promise<ethers.TransactionResponse> {
  return instantSetFeeFunction(
    vaultContract,
    "setManagementFee",
    managementFee
  );
}

// ========================================
// PERFORMANCE FEE RECEIVER
// ========================================

export async function submitPerformanceFeeRecipient(
  vaultContract: ethers.Contract,
  newFeeRecipient: string
): Promise<ethers.TransactionResponse> {
  return submitFeeRecipientFunction(
    vaultContract,
    "setPerformanceFeeRecipient",
    newFeeRecipient
  );
}

export async function setPerformanceFeeRecipientAfterTimelock(
  vaultContract: ethers.Contract,
  newFeeRecipient: string
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "setPerformanceFeeRecipient", [
    newFeeRecipient,
  ]);
}

export async function instantSetPerformanceFeeRecipient(
  vaultContract: ethers.Contract,
  newFeeRecipient: string
): Promise<ethers.TransactionResponse> {
  return instantSetFeeRecipientFunction(
    vaultContract,
    "setPerformanceFeeRecipient",
    newFeeRecipient
  );
}

// ========================================
// MANAGEMENT FEE RECEIVER
// ========================================

export async function submitManagementFeeRecipient(
  vaultContract: ethers.Contract,
  newFeeRecipient: string
): Promise<ethers.TransactionResponse> {
  return submitFeeRecipientFunction(
    vaultContract,
    "setManagementFeeRecipient",
    newFeeRecipient
  );
}

export async function setManagementFeeRecipientAfterTimelock(
  vaultContract: ethers.Contract,
  newFeeRecipient: string
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "setManagementFeeRecipient", [
    newFeeRecipient,
  ]);
}

export async function instantSetManagementFeeRecipient(
  vaultContract: ethers.Contract,
  newFeeRecipient: string
): Promise<ethers.TransactionResponse> {
  return instantSetFeeRecipientFunction(
    vaultContract,
    "setManagementFeeRecipient",
    newFeeRecipient
  );
}

// ========================================
// FORCE DEALLOCATE PENALTY
// ========================================

export async function submitForceDeallocatePenalty(
  vaultContract: ethers.Contract,
  adapter: string,
  newForceDeallocatePenalty: bigint
): Promise<ethers.TransactionResponse> {
  return submitForceDeallocatePenaltyFunction(
    vaultContract,
    adapter,
    newForceDeallocatePenalty
  );
}

export async function setForceDeallocatePenaltyAfterTimelock(
  vaultContract: ethers.Contract,
  adapter: string,
  newForceDeallocatePenalty: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "setForceDeallocatePenalty", [
    adapter,
    newForceDeallocatePenalty,
  ]);
}

export async function instantSetForceDeallocatePenalty(
  vaultContract: ethers.Contract,
  adapter: string,
  newForceDeallocatePenalty: bigint
): Promise<ethers.TransactionResponse> {
  return instantSetForceDeallocatePenaltyFunction(
    vaultContract,
    adapter,
    newForceDeallocatePenalty
  );
}

// ========================================
// READ FUNCTIONS
// ========================================

export async function getPerformanceFee(
  vaultContract: ethers.Contract
): Promise<bigint> {
  return callContractMethod(vaultContract, "performanceFee");
}

export async function getPerformanceFeeRecipient(
  vaultContract: ethers.Contract
): Promise<string> {
  return callContractMethod(vaultContract, "performanceFeeRecipient");
}

export async function getManagementFee(
  vaultContract: ethers.Contract
): Promise<bigint> {
  return callContractMethod(vaultContract, "managementFee");
}

export async function getManagementFeeRecipient(
  vaultContract: ethers.Contract
): Promise<string> {
  return callContractMethod(vaultContract, "managementFeeRecipient");
}

export async function getForceDeallocatePenalty(
  vaultContract: ethers.Contract,
  adapter: string
): Promise<bigint> {
  return callContractMethod(vaultContract, "forceDeallocatePenalty", [adapter]);
}
