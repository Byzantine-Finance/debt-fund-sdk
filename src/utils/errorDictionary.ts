/**
 * Ecosystem-wide revert decoder.
 *
 * A revert from a nested call bubbles its raw bytes up unchanged, but a
 * custom error can only be NAMED if its 4-byte selector is known to the
 * decoder. Decoding with just the called contract's ABI therefore misses
 * errors raised by children (vault -> adapter -> underlying protocol ->
 * token). Selectors hash the error signature alone, not the emitting
 * contract, so one merged dictionary decodes any call depth.
 *
 * This module unions every error fragment from the ABIs shipped with the
 * SDK, plus widely-deployed standards (OpenZeppelin v5, Solidity built-ins),
 * deduped by selector. `formatContractError` uses it as a fallback after
 * the called contract's own interface; apps can also call
 * `describeRevertData` directly on raw revert bytes (e.g. from viem).
 *
 * Adding a new ABI to `constants/abis.ts` and to `SHIPPED_ABIS` below is
 * the only wiring a future adapter needs.
 */

import { AbiCoder, Interface, type InterfaceAbi } from "ethers";
import {
	CompoundV3AdapterABI,
	CompoundV3AdapterFactoryABI,
	ERC4626MerklAdapterABI,
	ERC4626MerklAdapterFactoryABI,
	MorphoMarketV1AdapterV2ABI,
	MorphoMarketV1AdapterV2FactoryABI,
	MorphoVaultV1AdapterABI,
	MorphoVaultV1AdapterFactoryABI,
	VAULT_ABI,
	VAULT_FACTORY_ABI,
} from "../constants/abis";

const SHIPPED_ABIS: InterfaceAbi[] = [
	VAULT_ABI as InterfaceAbi,
	VAULT_FACTORY_ABI as InterfaceAbi,
	MorphoMarketV1AdapterV2ABI as InterfaceAbi,
	MorphoMarketV1AdapterV2FactoryABI as InterfaceAbi,
	MorphoVaultV1AdapterABI as InterfaceAbi,
	MorphoVaultV1AdapterFactoryABI as InterfaceAbi,
	CompoundV3AdapterABI as InterfaceAbi,
	CompoundV3AdapterFactoryABI as InterfaceAbi,
	ERC4626MerklAdapterABI as InterfaceAbi,
	ERC4626MerklAdapterFactoryABI as InterfaceAbi,
];

/**
 * Widely-deployed standard errors that children of our contracts commonly
 * raise but that no shipped ABI carries (OpenZeppelin v5 tokens/vaults,
 * access control, reentrancy guards). Signatures, not contract-bound.
 */
const STANDARD_ERRORS: string[] = [
	// OpenZeppelin ERC20
	"error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
	"error ERC20InvalidSender(address sender)",
	"error ERC20InvalidReceiver(address receiver)",
	"error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
	"error ERC20InvalidApprover(address approver)",
	"error ERC20InvalidSpender(address spender)",
	// OpenZeppelin ERC4626
	"error ERC4626ExceededMaxDeposit(address receiver, uint256 assets, uint256 max)",
	"error ERC4626ExceededMaxMint(address receiver, uint256 shares, uint256 max)",
	"error ERC4626ExceededMaxWithdraw(address owner, uint256 assets, uint256 max)",
	"error ERC4626ExceededMaxRedeem(address owner, uint256 shares, uint256 max)",
	// OpenZeppelin utils
	"error SafeERC20FailedOperation(address token)",
	"error AddressEmptyCode(address target)",
	"error AddressInsufficientBalance(address account)",
	"error FailedInnerCall()",
	"error ReentrancyGuardReentrantCall()",
	// OpenZeppelin access
	"error OwnableUnauthorizedAccount(address account)",
	"error OwnableInvalidOwner(address owner)",
	"error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
	// OpenZeppelin EIP-2612 / signatures
	"error ERC2612ExpiredSignature(uint256 deadline)",
	"error ERC2612InvalidSigner(address signer, address owner)",
	"error ECDSAInvalidSignature()",
];

function buildDictionary(): Interface {
	const seen = new Set<string>();
	const fragments: string[] = [];
	for (const abi of SHIPPED_ABIS) {
		new Interface(abi).forEachError((f) => {
			if (seen.has(f.selector)) return;
			seen.add(f.selector);
			fragments.push(f.format("full"));
		});
	}
	// Standards go through the same selector dedupe so a shipped ABI that
	// already declares one of them wins (identical layout either way).
	const std = new Interface(STANDARD_ERRORS);
	std.forEachError((f) => {
		if (seen.has(f.selector)) return;
		seen.add(f.selector);
		fragments.push(f.format("full"));
	});
	return new Interface(fragments.map((s) => `error ${s.replace(/^error /, "")}`));
}

/** Merged Interface of every custom error the SDK knows about. */
export const ERROR_DICTIONARY: Interface = buildDictionary();

const ERROR_STRING_SELECTOR = "0x08c379a0"; // Error(string)
const PANIC_SELECTOR = "0x4e487b71"; // Panic(uint256)

/** Solidity panic codes (see the Solidity docs / OpenZeppelin Panic.sol). */
const PANIC_REASONS: Record<number, string> = {
	0x00: "generic compiler panic",
	0x01: "assertion failed (assert)",
	0x11: "arithmetic overflow or underflow",
	0x12: "division or modulo by zero",
	0x21: "out-of-range enum conversion",
	0x22: "corrupted storage byte array",
	0x31: "pop() on an empty array",
	0x32: "array index out of bounds",
	0x41: "out of memory / allocation too large",
	0x51: "call to an uninitialized internal function",
};

/**
 * Decode raw revert bytes into a human-readable reason, regardless of how
 * deep in the call tree they were raised. Handles, in order: custom errors
 * known to the dictionary, `Error(string)` requires, and `Panic(uint256)`.
 * Returns null when the data is empty or matches nothing, so the caller
 * can fall back to its own message (keeping the raw selector visible).
 */
export function describeRevertData(data: string): string | null {
	if (!data || data === "0x" || data.length < 10) return null;

	// ethers' parseError also recognizes the two Solidity built-ins
	// (Error(string), Panic(uint256)); reformat those into something a
	// human reads at a glance, keep custom errors as name(args).
	try {
		const parsed = ERROR_DICTIONARY.parseError(data);
		if (parsed) {
			if (parsed.name === "Error") {
				return `reverted with reason "${parsed.args[0]}"`;
			}
			if (parsed.name === "Panic") {
				const code = Number(parsed.args[0]);
				return `Panic(0x${code.toString(16)}): ${PANIC_REASONS[code] ?? "unknown panic code"}`;
			}
			const args =
				parsed.args.length > 0
					? `(${parsed.args.map(String).join(", ")})`
					: "()";
			return `${parsed.name}${args}`;
		}
	} catch {
		/* fall through */
	}

	// Manual backup for the built-ins, in case a future ethers stops
	// recognizing them through parseError.
	const selector = data.slice(0, 10).toLowerCase();
	const coder = AbiCoder.defaultAbiCoder();
	if (selector === ERROR_STRING_SELECTOR) {
		try {
			const [reason] = coder.decode(["string"], `0x${data.slice(10)}`);
			return `reverted with reason "${reason}"`;
		} catch {
			/* fall through */
		}
	}
	if (selector === PANIC_SELECTOR) {
		try {
			const [code] = coder.decode(["uint256"], `0x${data.slice(10)}`);
			const c = Number(code);
			return `Panic(0x${c.toString(16)}): ${PANIC_REASONS[c] ?? "unknown panic code"}`;
		} catch {
			/* fall through */
		}
	}
	return null;
}
