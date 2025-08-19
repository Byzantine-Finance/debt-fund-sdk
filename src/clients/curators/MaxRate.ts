import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";
import { getTimelock } from "./Timelock";

// ========================================
// MAX RATE FUNCTIONS
// ========================================

export async function submitMaxRate(
  vaultContract: ethers.Contract,
  newMaxRate: bigint
) {
  const calldata = vaultContract.interface.encodeFunctionData("setMaxRate", [
    newMaxRate,
  ]);
  return executeContractMethod(vaultContract, "submit", calldata);
}

export async function setMaxRateAfterTimelock(
  vaultContract: ethers.Contract,
  newMaxRate: bigint
) {
  return executeContractMethod(vaultContract, "setMaxRate", newMaxRate);
}

export async function instantSetMaxRate(
  vaultContract: ethers.Contract,
  newMaxRate: bigint
) {
  const timelock = await getTimelock(vaultContract, "setMaxRate");
  if (timelock !== 0n) {
    throw new Error(
      `Cannot instantly set max rate. Current timelock is ${timelock} seconds, must be 0.`
    );
  }
  const calldataSet = vaultContract.interface.encodeFunctionData("setMaxRate", [
    newMaxRate,
  ]);
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataSet,
  ]);
  return executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataSet,
  ]);
}

// ========================================
// GENERAL MAX RATE FUNCTIONS
// ========================================

export async function getMaxRate(vaultContract: ethers.Contract) {
  return callContractMethod(vaultContract, "maxRate");
}
