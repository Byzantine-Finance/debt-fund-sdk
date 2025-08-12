/**
 * Contract Error Handler Utility
 *
 * Helper functions to standardize contract error handling across the SDK
 */

import { ethers, TransactionResponse } from "ethers";
import { ErrorCodeMapping } from "./errorCodeMapping";

/**
 * Format a contract error with helpful context
 * @param method The method name that failed
 * @param error The error object
 * @returns Formatted error with context
 */
export function formatContractError(method: string, error: any): Error {
  // If the error has revert data, try to decode it
  if (error.revert) {
    try {
      const decodedError = error.revert;
      const selector = decodedError.signature;
      const errorName = ErrorCodeMapping[selector] || selector;
      return new Error(
        `${method} failed: ${errorName} - ${decodedError.args.join(", ")}`
      );
    } catch (decodeError) {
      return new Error(
        `${method} failed: ${error.revert.signature || error.revert}`
      );
    }
  }

  // Check for reason string
  if (error.reason) {
    return new Error(`${method} failed: ${error.reason}`);
  }

  // Check for error data and try to decode it
  if (error.data && error.data !== "0x") {
    try {
      const selector = error.data.slice(0, 10);
      const errorName = ErrorCodeMapping[selector];
      if (errorName) {
        return new Error(`${method} failed: ${errorName}`);
      }
    } catch (decodeError) {
      // Ignore decode errors
    }
  }

  // Handle specific error patterns
  if (error.message && error.message.includes("missing revert data")) {
    if (method === "createMetaVault") {
      return new Error(
        `Failed to create MetaVault - missing revert data. This usually means:\n` +
          `  • Sub-vault addresses don't exist on this network\n` +
          `  • Sub-vaults are not valid ERC4626 contracts\n` +
          `  • Sub-vault assets don't match the MetaVault asset\n` +
          `  • Invalid contract addresses or parameters\n` +
          `  • Network connectivity issues`
      );
    }
    return new Error(
      `Contract call failed - missing revert data. This usually indicates:\n` +
        `  • Invalid contract address\n` +
        `  • Contract doesn't exist on this network\n` +
        `  • Invalid function parameters\n` +
        `  • Network connectivity issues`
    );
  }

  return new Error(
    `Failed to execute ${method}: ${error.message || "Unknown error"}`
  );
}

/**
 * Execute a contract method with error handling and gas estimation
 * @param contract The contract instance
 * @param method The method name to call
 * @param args The method arguments
 * @returns Transaction response
 */
export async function executeContractMethod(
  contract: ethers.Contract,
  method: string,
  ...args: any[]
): Promise<TransactionResponse> {
  try {
    // Separate transaction options from method arguments
    const lastArg = args[args.length - 1];
    let txOptions = {};
    let methodArgs = args;

    if (
      lastArg &&
      typeof lastArg === "object" &&
      !Array.isArray(lastArg) &&
      (lastArg.gasLimit ||
        lastArg.gasPrice ||
        lastArg.maxFeePerGas ||
        lastArg.maxPriorityFeePerGas ||
        lastArg.value)
    ) {
      txOptions = lastArg;
      methodArgs = args.slice(0, -1);
    }

    // Try static call first to catch errors early
    try {
      await contract[method].staticCall(...methodArgs);
    } catch (staticError: any) {
      // If static call fails, try the actual transaction anyway to get better error info
      try {
        if (Object.keys(txOptions).length > 0) {
          return await contract[method](...methodArgs, txOptions);
        } else {
          return await contract[method](...methodArgs);
        }
      } catch (actualError: any) {
        // Use the actual error if it has better info, otherwise use static error
        if (
          actualError.revert ||
          actualError.reason ||
          (actualError.data && actualError.data !== staticError.data)
        ) {
          throw formatContractError(method, actualError);
        }
        throw formatContractError(method, staticError);
      }
    }

    // Execute the actual transaction
    if (Object.keys(txOptions).length > 0) {
      return await contract[method](...methodArgs, txOptions);
    } else {
      return await contract[method](...methodArgs);
    }
  } catch (error) {
    throw formatContractError(method, error);
  }
}

/**
 * Call a contract method (read-only) with error handling
 * @param contract The contract instance
 * @param method The method name to call
 * @param args The method arguments
 * @returns The result of the contract call
 */
export async function callContractMethod(
  contract: ethers.Contract,
  method: string,
  ...args: any[]
): Promise<any> {
  try {
    return await contract[method](...args);
  } catch (error) {
    throw formatContractError(method, error);
  }
}
