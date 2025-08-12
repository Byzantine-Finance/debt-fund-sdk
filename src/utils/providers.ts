/**
 * Utility functions for working with providers and signers
 */

import { Wallet, HDNodeWallet } from "ethers";
import { Address } from "viem";

/**
 * Creates an ethers wallet from a mnemonic phrase
 * @param mnemonic - Mnemonic phrase
 * @param index - Account index (default: 0)
 * @returns Ethers wallet
 */
export function getWalletFromMnemonic(mnemonic: string): HDNodeWallet {
  // Use the simplest form to avoid API compatibility issues
  return Wallet.fromPhrase(mnemonic);
}

/**
 * Validates if a string is a valid Ethereum address
 * @param address - The address to validate
 * @returns True if the address is valid
 */
export function isValidAddress(address: string): address is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Formats an amount for display with a specified number of decimals
 * @param amount - Amount to format
 * @param decimals - Number of decimals
 * @param maxDecimals - Maximum number of decimals to display
 * @returns Formatted amount string
 */
export function formatAmount(
  amount: bigint,
  decimals: number,
  maxDecimals = 4
): string {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  // Convert to string and pad with leading zeros
  let fractionalStr = fractionalPart.toString().padStart(decimals, "0");

  // Trim trailing zeros
  fractionalStr = fractionalStr.replace(/0+$/, "");

  // Truncate to maxDecimals
  if (fractionalStr.length > maxDecimals) {
    fractionalStr = fractionalStr.substring(0, maxDecimals);
  }

  return `${integerPart}.${fractionalStr}`;
}
