import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";

/**
 * Supported timelock functions with their hardcoded selectors
 */
export type TimelockFunction =
  | "addAdapter" // 0x60d54d41
  | "removeAdapter" // 0x585cd34b
  //
  | "increaseTimelock" // 0x47966291
  | "decreaseTimelock" // 0x5c1a1a4f
  //
  | "increaseAbsoluteCap" // 0xf6f98fd5
  | "increaseRelativeCap" // 0x2438525b
  //
  | "setIsAllocator" // 0xb192a84a
  //
  | "setAdapterRegistry" // 0x5b34b823
  //
  | "setReceiveSharesGate" // 0x2cb19f98
  | "setSendSharesGate" // 0xc21ad028
  | "setReceiveAssetsGate" // 0x04dbf0ce
  | "setSendAssetsGate" // 0x871c979c
  //
  | "setPerformanceFee" // 0x70897b23
  | "setPerformanceFeeRecipient" // 0x6a5f1aa2
  | "setManagementFee" // 0xfe56e232
  | "setManagementFeeRecipient" // 0x9faae464
  //
  | "setForceDeallocatePenalty"; // 0x3e9d2ac7

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get the function selector for a timelock function
 * @param functionName The timelock function name
 * @returns The function selector (bytes4)
 */
export function getTimelockFunctionSelector(
  functionName: TimelockFunction
): string {
  switch (functionName) {
    case "addAdapter":
      return "0x60d54d41";
    case "removeAdapter":
      return "0x585cd34b";
    case "increaseTimelock":
      return "0x47966291";
    case "decreaseTimelock":
      return "0x5c1a1a4f";
    case "increaseAbsoluteCap":
      return "0xf6f98fd5";
    case "increaseRelativeCap":
      return "0x2438525b";
    case "setIsAllocator":
      return "0xb192a84a";
    case "setAdapterRegistry":
      return "0x5b34b823";
    case "setReceiveSharesGate":
      return "0x2cb19f98";
    case "setSendSharesGate":
      return "0xc21ad028";
    case "setReceiveAssetsGate":
      return "0x04dbf0ce";
    case "setSendAssetsGate":
      return "0x871c979c";
    case "setPerformanceFee":
      return "0x70897b23";
    case "setPerformanceFeeRecipient":
      return "0x6a5f1aa2";
    case "setManagementFee":
      return "0xfe56e232";
    case "setManagementFeeRecipient":
      return "0x9faae464";
    case "setForceDeallocatePenalty":
      return "0x3e9d2ac7";
    default:
      throw new Error(`Unknown function name: ${functionName}`);
  }
}

/**
 * Get the current timelock duration for a function
 * @param vaultContract The vault contract instance
 * @param functionName The function name
 * @returns The timelock duration in seconds
 */
export async function getTimelock(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction
): Promise<bigint> {
  const selector = getTimelockFunctionSelector(functionName);
  return await callContractMethod(vaultContract, "timelock", selector);
}

/**
 * Get the executable timestamp for specific calldata
 * @param vaultContract The vault contract instance
 * @param data The calldata
 * @returns The timestamp when the data can be executed
 */
export async function getExecutableAt(
  vaultContract: ethers.Contract,
  data: string
): Promise<bigint> {
  return await callContractMethod(vaultContract, "executableAt", data);
}

// ========================================
// TIMELOCK MANAGEMENT FUNCTIONS
// ========================================

/**
 * Submit a request to increase timelock duration (requires timelock)
 * @param vaultContract The vault contract instance
 * @param functionName The function to modify timelock for
 * @param newDuration The new timelock duration in seconds
 * @returns Transaction response
 */
export async function submitIncreaseTimelock(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  newDuration: bigint
) {
  const selector = getTimelockFunctionSelector(functionName);
  const calldata = vaultContract.interface.encodeFunctionData(
    "increaseTimelock",
    [selector, newDuration]
  );
  return await executeContractMethod(vaultContract, "submit", calldata);
}

/**
 * Execute timelock increase after timelock period expires
 * @param vaultContract The vault contract instance
 * @param functionName The function to modify timelock for
 * @param newDuration The new timelock duration in seconds
 * @returns Transaction response
 */
export async function increaseTimelockAfterTimelock(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  newDuration: bigint
) {
  const selector = getTimelockFunctionSelector(functionName);
  return await executeContractMethod(
    vaultContract,
    "increaseTimelock",
    selector,
    newDuration
  );
}

/**
 * Instantly increase timelock if current timelock is 0 (multicall submit + execute)
 * @param vaultContract The vault contract instance
 * @param functionName The function to modify timelock for
 * @param newDuration The new timelock duration in seconds
 * @returns Transaction response
 */
export async function instantIncreaseTimelock(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  newDuration: bigint
) {
  const selector = getTimelockFunctionSelector(functionName);
  const calldataIncrease = vaultContract.interface.encodeFunctionData(
    "increaseTimelock",
    [selector, newDuration]
  );
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataIncrease,
  ]);

  return await executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataIncrease,
  ]);
}

/**
 * Submit a request to decrease timelock duration (requires timelock)
 * @param vaultContract The vault contract instance
 * @param functionName The function to modify timelock for
 * @param newDuration The new timelock duration in seconds
 * @returns Transaction response
 */
export async function submitDecreaseTimelock(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  newDuration: bigint
) {
  const selector = getTimelockFunctionSelector(functionName);
  const calldata = vaultContract.interface.encodeFunctionData(
    "decreaseTimelock",
    [selector, newDuration]
  );
  return await executeContractMethod(vaultContract, "submit", calldata);
}

/**
 * Execute timelock decrease after timelock period expires
 * @param vaultContract The vault contract instance
 * @param functionName The function to modify timelock for
 * @param newDuration The new timelock duration in seconds
 * @returns Transaction response
 */
export async function setDecreaseTimelockAfterTimelock(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  newDuration: bigint
) {
  const selector = getTimelockFunctionSelector(functionName);
  return await executeContractMethod(
    vaultContract,
    "decreaseTimelock",
    selector,
    newDuration
  );
}

/**
 * Instantly decrease timelock if current timelock is 0 (multicall submit + execute)
 * @param vaultContract The vault contract instance
 * @param functionName The function to modify timelock for
 * @param newDuration The new timelock duration in seconds
 * @returns Transaction response
 */
// export async function instantDecreaseTimelock(
//   vaultContract: ethers.Contract,
//   functionName: TimelockFunction,
//   newDuration: bigint
// ) {
//   const selector = getTimelockFunctionSelector(functionName);

//   // Use multicall to submit and execute in one transaction
//   const calldataSet = vaultContract.interface.encodeFunctionData(
//     "decreaseTimelock",
//     [selector, newDuration]
//   );
//   const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
//     calldataSet,
//   ]);

//   return await executeContractMethod(vaultContract, "multicall", [
//     calldataSubmit,
//     calldataSet,
//   ]);
// }

// ========================================
// GENERAL TIMELOCK FUNCTIONS
// ========================================

/**
 * Submit any function call for timelock
 * @param vaultContract The vault contract instance
 * @param data The encoded function call data
 * @returns Transaction response
 */
export async function submit(vaultContract: ethers.Contract, data: string) {
  return await executeContractMethod(vaultContract, "submit", data);
}

/**
 * Revoke a pending timelock submission
 * @param vaultContract The vault contract instance
 * @param functionName The function name
 * @param params The parameters for the function
 * @returns Transaction response
 */
export async function revoke(
  vaultContract: ethers.Contract,
  functionName: TimelockFunction,
  params: any[]
) {
  const calldata = vaultContract.interface.encodeFunctionData(
    functionName,
    params
  );
  return await executeContractMethod(vaultContract, "revoke", calldata);
}
