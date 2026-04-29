/**
 * Lightweight helpers for ethers providers / signers.
 *
 * Note: amount/percentage formatting helpers live in `./conversions.ts`.
 */

import { type HDNodeWallet, Wallet } from "ethers";
import type { Address } from "viem";

/**
 * Create an ethers `Wallet` from a BIP-39 mnemonic.
 *
 * @param mnemonic  The 12/24-word mnemonic phrase.
 * @returns         A connected-less `HDNodeWallet`. Use `.connect(provider)`
 *                  to attach a provider before sending transactions.
 *
 * @example
 * const wallet = getWalletFromMnemonic(MNEMONIC).connect(provider);
 */
export function getWalletFromMnemonic(mnemonic: string): HDNodeWallet {
	return Wallet.fromPhrase(mnemonic);
}

/**
 * Type guard for EVM addresses.
 *
 * Validates the format only (`0x` prefix + 40 hex chars). Does **not**
 * validate the EIP-55 checksum.
 *
 * @example
 * if (isValidAddress(input)) { /* input is now typed as `Address` *\/ }
 */
export function isValidAddress(address: string): address is Address {
	return /^0x[a-fA-F0-9]{40}$/.test(address);
}
