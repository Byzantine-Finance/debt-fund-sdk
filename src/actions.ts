/**
 * Actions namespace — pure calldata builders for the Vault contract.
 *
 * Each function returns the encoded calldata (or an array of calldatas for
 * composite "instant*" actions). They can be passed to `vault.multicall(...)`
 * to batch many operations into a single transaction.
 *
 * Roles are organisational (autocomplete + docs); all actions hit the same
 * underlying contract surface. The vault's `multicall` uses `delegatecall`,
 * so the caller (`msg.sender`) must hold the relevant role for each action.
 */

import { AbiCoder, Interface, keccak256 } from "ethers";
import type { MarketParams } from "./clients/adapters";
import { VAULT_ABI } from "./constants/abis";

const I = new Interface(VAULT_ABI);
const enc = (fn: string, args: readonly unknown[]): string =>
	I.encodeFunctionData(fn, args as unknown[]);

const submitCalldata = (inner: string): string => enc("submit", [inner]);
const instant = (set: string): readonly [string, string] => [
	submitCalldata(set),
	set,
];

/**
 * An action is either a single calldata or an array of calldatas (for
 * composite actions like `instantX` which expands to `[submit(set), set]`).
 * `vault.multicall(...)` flattens arrays automatically.
 */
export type Action = string | readonly string[];

// ============================================================================
// ID DATA — helpers for cap-related actions
// ============================================================================

export type IdType = "this" | "collateralToken" | "this/marketParams";

const abi = AbiCoder.defaultAbiCoder();
const MARKET_PARAMS_TUPLE = "tuple(address,address,address,address,uint256)";

const marketParamsTuple = (m: MarketParams) =>
	[m.loanToken, m.collateralToken, m.oracle, m.irm, m.lltv] as const;

/**
 * Build the `idData` blob the vault hashes to derive a cap id.
 *
 * Three flavours, matching the buckets returned by
 * `MorphoMarketV1AdapterV2.ids(marketParams)`:
 * - `this` — single-id adapters; also the adapter-wide bucket on Morpho V1
 *   (= `keccak256(abi.encode("this", adapter))`).
 * - `collateralToken` — per-collateral cap, shared across adapters/markets.
 * - `this/marketParams` — per-market cap under this adapter.
 *
 * For `this/marketParams` the contract encodes the `MarketParams` struct
 * **inline** (not bytes-wrapped); we mirror that here so the round-trip
 * `keccak256(idData(...))` matches the adapter's bucket id exactly. See
 * `idHash` below.
 */
export function idData(type: "this", adapter: string): string;
export function idData(type: "collateralToken", token: string): string;
export function idData(
	type: "this/marketParams",
	adapter: string,
	marketParams: MarketParams,
): string;
export function idData(type: IdType, ...args: unknown[]): string {
	switch (type) {
		case "this":
			return abi.encode(["string", "address"], ["this", args[0] as string]);
		case "collateralToken":
			return abi.encode(
				["string", "address"],
				["collateralToken", args[0] as string],
			);
		case "this/marketParams":
			return abi.encode(
				["string", "address", MARKET_PARAMS_TUPLE],
				[
					"this/marketParams",
					args[0] as string,
					marketParamsTuple(args[1] as MarketParams),
				],
			);
	}
}

/**
 * Compute the bytes32 id the vault stores caps and allocations under for a
 * given `idData` flavour — i.e. `keccak256(idData(type, ...))`.
 *
 * Useful for matching vault ids against expected buckets without rebuilding
 * the encoding by hand.
 */
export function idHash(type: "this", adapter: string): string;
export function idHash(type: "collateralToken", token: string): string;
export function idHash(
	type: "this/marketParams",
	adapter: string,
	marketParams: MarketParams,
): string;
export function idHash(type: IdType, ...args: unknown[]): string {
	// Re-dispatch through the typed `idData` overloads. The cast is safe
	// because the public overloads above already constrain each shape.
	const blob = (idData as (...a: unknown[]) => string)(type, ...args);
	return keccak256(blob);
}

// ============================================================================
// TIMELOCK SELECTORS — used by increase/decrease/abdicate timelock actions
// ============================================================================

export type TimelockFunction =
	| "abdicate"
	| "addAdapter"
	| "removeAdapter"
	| "increaseTimelock"
	| "decreaseTimelock"
	| "increaseAbsoluteCap"
	| "increaseRelativeCap"
	| "setIsAllocator"
	| "setAdapterRegistry"
	| "setReceiveSharesGate"
	| "setSendSharesGate"
	| "setReceiveAssetsGate"
	| "setSendAssetsGate"
	| "setPerformanceFee"
	| "setPerformanceFeeRecipient"
	| "setManagementFee"
	| "setManagementFeeRecipient"
	| "setForceDeallocatePenalty";

const TIMELOCK_SELECTORS: Record<TimelockFunction, string> = {
	abdicate: "0xb2e32848",
	addAdapter: "0x60d54d41",
	removeAdapter: "0x585cd34b",
	increaseTimelock: "0x47966291",
	decreaseTimelock: "0x5c1a1a4f",
	increaseAbsoluteCap: "0xf6f98fd5",
	increaseRelativeCap: "0x2438525b",
	setIsAllocator: "0xb192a84a",
	setAdapterRegistry: "0x5b34b823",
	setReceiveSharesGate: "0x2cb19f98",
	setSendSharesGate: "0xc21ad028",
	setReceiveAssetsGate: "0x04dbf0ce",
	setSendAssetsGate: "0x871c979c",
	setPerformanceFee: "0x70897b23",
	setPerformanceFeeRecipient: "0x6a5f1aa2",
	setManagementFee: "0xfe56e232",
	setManagementFeeRecipient: "0x9faae464",
	setForceDeallocatePenalty: "0x3e9d2ac7",
};

export function timelockSelector(fn: TimelockFunction): string {
	return TIMELOCK_SELECTORS[fn];
}

// ============================================================================
// ACTIONS — grouped by role
// ============================================================================

export const Actions = {
	// ------------------------------------------------------------------
	// OWNER — instant actions (no timelock)
	// ------------------------------------------------------------------
	owner: {
		setOwner: (newOwner: string) => enc("setOwner", [newOwner]),
		setCurator: (newCurator: string) => enc("setCurator", [newCurator]),
		setIsSentinel: (account: string, is: boolean) =>
			enc("setIsSentinel", [account, is]),
		setName: (name: string) => enc("setName", [name]),
		setSymbol: (symbol: string) => enc("setSymbol", [symbol]),
	},

	// ------------------------------------------------------------------
	// CURATOR — every "set" goes through submit + execute (timelocked)
	// ------------------------------------------------------------------
	curator: {
		// Generic timelock primitives
		submit: submitCalldata,
		revoke: (data: string) => enc("revoke", [data]),

		// Adapter management
		addAdapter: (adapter: string) => enc("addAdapter", [adapter]),
		removeAdapter: (adapter: string) => enc("removeAdapter", [adapter]),

		// Caps
		increaseAbsoluteCap: (idData: string, cap: bigint) =>
			enc("increaseAbsoluteCap", [idData, cap]),
		decreaseAbsoluteCap: (idData: string, cap: bigint) =>
			enc("decreaseAbsoluteCap", [idData, cap]),
		increaseRelativeCap: (idData: string, cap: bigint) =>
			enc("increaseRelativeCap", [idData, cap]),
		decreaseRelativeCap: (idData: string, cap: bigint) =>
			enc("decreaseRelativeCap", [idData, cap]),

		// Roles
		setIsAllocator: (account: string, is: boolean) =>
			enc("setIsAllocator", [account, is]),

		// Gates
		setReceiveSharesGate: (gate: string) => enc("setReceiveSharesGate", [gate]),
		setSendSharesGate: (gate: string) => enc("setSendSharesGate", [gate]),
		setReceiveAssetsGate: (gate: string) => enc("setReceiveAssetsGate", [gate]),
		setSendAssetsGate: (gate: string) => enc("setSendAssetsGate", [gate]),

		// Adapter registry
		setAdapterRegistry: (registry: string) =>
			enc("setAdapterRegistry", [registry]),

		// Fees
		setPerformanceFee: (fee: bigint) => enc("setPerformanceFee", [fee]),
		setManagementFee: (fee: bigint) => enc("setManagementFee", [fee]),
		setPerformanceFeeRecipient: (r: string) =>
			enc("setPerformanceFeeRecipient", [r]),
		setManagementFeeRecipient: (r: string) =>
			enc("setManagementFeeRecipient", [r]),
		setForceDeallocatePenalty: (adapter: string, penalty: bigint) =>
			enc("setForceDeallocatePenalty", [adapter, penalty]),

		// Timelock management
		increaseTimelock: (fn: TimelockFunction, duration: bigint) =>
			enc("increaseTimelock", [TIMELOCK_SELECTORS[fn], duration]),
		decreaseTimelock: (fn: TimelockFunction, duration: bigint) =>
			enc("decreaseTimelock", [TIMELOCK_SELECTORS[fn], duration]),
		abdicate: (fn: TimelockFunction) =>
			enc("abdicate", [TIMELOCK_SELECTORS[fn]]),

		// ----- INSTANT — submit + execute in one multicall (only if timelock=0) -----
		instantAddAdapter: (adapter: string) =>
			instant(enc("addAdapter", [adapter])),
		instantRemoveAdapter: (adapter: string) =>
			instant(enc("removeAdapter", [adapter])),
		instantIncreaseAbsoluteCap: (idData: string, cap: bigint) =>
			instant(enc("increaseAbsoluteCap", [idData, cap])),
		instantIncreaseRelativeCap: (idData: string, cap: bigint) =>
			instant(enc("increaseRelativeCap", [idData, cap])),
		instantSetIsAllocator: (account: string, is: boolean) =>
			instant(enc("setIsAllocator", [account, is])),
		instantSetReceiveSharesGate: (gate: string) =>
			instant(enc("setReceiveSharesGate", [gate])),
		instantSetSendSharesGate: (gate: string) =>
			instant(enc("setSendSharesGate", [gate])),
		instantSetReceiveAssetsGate: (gate: string) =>
			instant(enc("setReceiveAssetsGate", [gate])),
		instantSetSendAssetsGate: (gate: string) =>
			instant(enc("setSendAssetsGate", [gate])),
		instantSetAdapterRegistry: (registry: string) =>
			instant(enc("setAdapterRegistry", [registry])),
		instantSetPerformanceFee: (fee: bigint) =>
			instant(enc("setPerformanceFee", [fee])),
		instantSetManagementFee: (fee: bigint) =>
			instant(enc("setManagementFee", [fee])),
		instantSetPerformanceFeeRecipient: (r: string) =>
			instant(enc("setPerformanceFeeRecipient", [r])),
		instantSetManagementFeeRecipient: (r: string) =>
			instant(enc("setManagementFeeRecipient", [r])),
		instantSetForceDeallocatePenalty: (adapter: string, penalty: bigint) =>
			instant(enc("setForceDeallocatePenalty", [adapter, penalty])),
		instantIncreaseTimelock: (fn: TimelockFunction, duration: bigint) =>
			instant(enc("increaseTimelock", [TIMELOCK_SELECTORS[fn], duration])),
		instantDecreaseTimelock: (fn: TimelockFunction, duration: bigint) =>
			instant(enc("decreaseTimelock", [TIMELOCK_SELECTORS[fn], duration])),
	},

	// ------------------------------------------------------------------
	// ALLOCATOR
	// ------------------------------------------------------------------
	allocator: {
		allocate: (adapter: string, data: string, assets: bigint) =>
			enc("allocate", [adapter, data, assets]),
		deallocate: (adapter: string, data: string, assets: bigint) =>
			enc("deallocate", [adapter, data, assets]),
		setLiquidityAdapterAndData: (adapter: string, data: string) =>
			enc("setLiquidityAdapterAndData", [adapter, data]),
		setMaxRate: (rate: bigint) => enc("setMaxRate", [rate]),
	},

	// ------------------------------------------------------------------
	// USER — anyone with assets/shares
	// ------------------------------------------------------------------
	user: {
		deposit: (assets: bigint, onBehalf: string) =>
			enc("deposit", [assets, onBehalf]),
		mint: (shares: bigint, onBehalf: string) => enc("mint", [shares, onBehalf]),
		withdraw: (assets: bigint, receiver: string, onBehalf: string) =>
			enc("withdraw", [assets, receiver, onBehalf]),
		redeem: (shares: bigint, receiver: string, onBehalf: string) =>
			enc("redeem", [shares, receiver, onBehalf]),
		transfer: (to: string, shares: bigint) => enc("transfer", [to, shares]),
		transferFrom: (from: string, to: string, shares: bigint) =>
			enc("transferFrom", [from, to, shares]),
		approve: (spender: string, shares: bigint) =>
			enc("approve", [spender, shares]),
		permit: (
			owner: string,
			spender: string,
			shares: bigint,
			deadline: bigint,
			v: number,
			r: string,
			s: string,
		) => enc("permit", [owner, spender, shares, deadline, v, r, s]),
		forceDeallocate: (
			adapter: string,
			data: string,
			assets: bigint,
			onBehalf: string,
		) => enc("forceDeallocate", [adapter, data, assets, onBehalf]),
		accrueInterest: () => enc("accrueInterest", []),
	},
} as const;

/**
 * Flatten an array of actions (which may contain string or string[]) into
 * a flat string[] suitable for the contract's `multicall(bytes[])` arg.
 */
export function flattenActions(actions: readonly Action[]): string[] {
	const out: string[] = [];
	for (const a of actions) {
		if (typeof a === "string") out.push(a);
		else out.push(...a);
	}
	return out;
}
