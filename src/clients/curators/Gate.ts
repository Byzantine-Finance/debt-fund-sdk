import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";
import { getTimelock } from "./Timelock";
import { TimelockFunction } from "./Timelock";

// ========================================
// HELPERS - to reduce repetitive code
// ========================================

/**
 * Helper for submit gate functions
 */
async function submitGateFunction(
  vaultContract: ethers.Contract,
  functionName: string,
  gate: string
): Promise<ethers.TransactionResponse> {
  const calldata = vaultContract.interface.encodeFunctionData(functionName, [
    gate,
  ]);
  return executeContractMethod(vaultContract, "submit", calldata);
}

/**
 * Helper for instant gate functions
 */
async function instantSetGateFunction(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  gate: string
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
    gate,
  ]);
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataSet,
  ]);

  return await executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataSet,
  ]);
}

// ========================================
// RECEIVE SHARES GATE
// ========================================

export async function submitReceiveSharesGate(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return submitGateFunction(vaultContract, "setReceiveSharesGate", gate);
}

export async function setReceiveSharesGateAfterTimelock(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "setReceiveSharesGate", gate);
}

export async function instantSetReceiveSharesGate(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return instantSetGateFunction(vaultContract, "setReceiveSharesGate", gate);
}

// ========================================
// SEND SHARES GATE
// ========================================

export async function submitSendSharesGate(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return submitGateFunction(vaultContract, "setSendSharesGate", gate);
}

export async function setSendSharesGateAfterTimelock(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "setSendSharesGate", gate);
}

export async function instantSetSendSharesGate(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return instantSetGateFunction(vaultContract, "setSendSharesGate", gate);
}

// ========================================
// RECEIVE ASSETS GATE
// ========================================

export async function submitReceiveAssetsGate(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return submitGateFunction(vaultContract, "setReceiveAssetsGate", gate);
}

export async function setReceiveAssetsGateAfterTimelock(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "setReceiveAssetsGate", gate);
}

export async function instantSetReceiveAssetsGate(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return instantSetGateFunction(vaultContract, "setReceiveAssetsGate", gate);
}

// ========================================
// SEND ASSETS GATE
// ========================================

export async function submitSendAssetsGate(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return submitGateFunction(vaultContract, "setSendAssetsGate", gate);
}

export async function setSendAssetsGateAfterTimelock(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(vaultContract, "setSendAssetsGate", gate);
}

export async function instantSetSendAssetsGate(
  vaultContract: ethers.Contract,
  gate: string
): Promise<ethers.TransactionResponse> {
  return instantSetGateFunction(vaultContract, "setSendAssetsGate", gate);
}

// ========================================
// READ FUNCTIONS
// ========================================

export async function getReceiveSharesGate(
  vaultContract: ethers.Contract
): Promise<string> {
  return callContractMethod(vaultContract, "receiveSharesGate");
}

export async function getSendSharesGate(
  vaultContract: ethers.Contract
): Promise<string> {
  return callContractMethod(vaultContract, "sendSharesGate");
}

export async function getReceiveAssetsGate(
  vaultContract: ethers.Contract
): Promise<string> {
  return callContractMethod(vaultContract, "receiveAssetsGate");
}

export async function getSendAssetsGate(
  vaultContract: ethers.Contract
): Promise<string> {
  return callContractMethod(vaultContract, "sendAssetsGate");
}
