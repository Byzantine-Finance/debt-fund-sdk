import { AbiCoder, ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";
import { getTimelock } from "./Timelock";
import { TimelockFunction } from "./Timelock";

// ========================================
// HELPERS - to reduce repetitive code
// ========================================

// MorphoVaultV1Adapter: Single ID based on keccak256(abi.encode("this", adapterAddress))
// MorphoMarketV1Adapter: Three IDs:
// Adapter ID: keccak256(abi.encode("this", adapterAddress))
// Collateral ID: keccak256(abi.encode("collateralToken", collateralAddress))
// Market ID: keccak256(abi.encode("this/marketParams", adapterAddress, marketParams))

type idType = "this" | "collateralToken" | "this/marketParams";

/**
 * Helper to get the ID data for the cap function
 * @param idType - The type of ID to get ("this", "collateralToken", or "this/marketParams")
 * @param args - The arguments to pass to the ID function
 * @returns The encoded ID data as a string
 *
 * @example
 * // For MorphoVaultV1Adapter: single ID based on adapter address
 * getIdData("this", [adapterAddress]);
 *
 * // For MorphoMarketV1Adapter: collateral token ID
 * Adapter ID: getIdData("collateralToken", [adapterAddress]);
 * Collateral ID: getIdData("collateralToken", [collateralAddress]);
 * Market ID: getIdData("this/marketParams", [adapterAddress, marketParams]);
 */

export function getIdData(idType: idType, args: string[]): string {
  const abiCoder = new AbiCoder();
  if (idType === "this") {
    return abiCoder.encode(["string", "address"], ["this", args[0]]);
  }
  if (idType === "collateralToken") {
    return abiCoder.encode(["string", "address"], ["collateralToken", args[0]]);
  }
  if (idType === "this/marketParams") {
    return abiCoder.encode(
      ["string", "address", "bytes"],
      ["this/marketParams", args[0], args[1]]
    );
  }
  throw new Error(`Invalid idType: ${idType}`);
}

/**
 * Helper for submit increase cap functions
 */
async function submitIncreaseCapFunction(
  vaultContract: ethers.Contract,
  functionName: string,
  idData: string,
  newCap: bigint
): Promise<ethers.TransactionResponse> {
  const calldata = vaultContract.interface.encodeFunctionData(functionName, [
    idData,
    newCap,
  ]);
  return executeContractMethod(vaultContract, "submit", calldata);
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
  return executeContractMethod(
    vaultContract,
    "increaseAbsoluteCap",
    idData,
    newAbsoluteCap
  );
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
  return executeContractMethod(
    vaultContract,
    "increaseRelativeCap",
    idData,
    newRelativeCap
  );
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
  return executeContractMethod(
    vaultContract,
    "decreaseAbsoluteCap",
    idData,
    newAbsoluteCap
  );
}

// ========================================
// DECREASE RELATIVE CAP
// ========================================

export async function decreaseRelativeCap(
  vaultContract: ethers.Contract,
  idData: string,
  newRelativeCap: bigint
): Promise<ethers.TransactionResponse> {
  return executeContractMethod(
    vaultContract,
    "decreaseRelativeCap",
    idData,
    newRelativeCap
  );
}

// ========================================
// READ FUNCTIONS
// ========================================

export async function getAbsoluteCap(
  vaultContract: ethers.Contract,
  id: string
): Promise<bigint> {
  return callContractMethod(vaultContract, "absoluteCap", id);
}

export async function getRelativeCap(
  vaultContract: ethers.Contract,
  id: string
): Promise<bigint> {
  // Convert the number id to bytes32
  return callContractMethod(vaultContract, "relativeCap", id);
}
