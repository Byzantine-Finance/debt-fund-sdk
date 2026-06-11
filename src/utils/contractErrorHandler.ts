/**
 * Contract error handling — thin, decoder-aware helpers.
 *
 * `formatContractError` turns whatever ethers throws into a single readable
 * `Error` with the contract's custom-error name (e.g. `AbsoluteCapExceeded`)
 * when the ABI knows it.
 *
 * The decoding leans on:
 *   1. `error.revert` — already parsed by ethers when the contract's ABI
 *      contains the error definition (the common case).
 *   2. `iface.parseError(data)` — fallback when ethers couldn't parse it
 *      itself but we still have the raw data.
 *   3. `describeRevertData(data)`: ecosystem-wide dictionary covering
 *      custom errors raised by NESTED contracts (adapter, market, token),
 *      plus the Error(string) / Panic(uint256) built-ins.
 *   4. `error.shortMessage` / `error.reason` / `error.message`: generic
 *      fallbacks, keeping the raw selector greppable.
 */

import type { ethers } from "ethers";
import { describeRevertData } from "./errorDictionary";

/** Subset of ethers' parsed error shape we actually use. */
interface RevertInfo {
	name?: string;
	signature?: string;
	args?: readonly unknown[];
}

/**
 * Dig the raw revert bytes out of whatever ethers threw. The location
 * varies with the provider and the failure stage (send vs estimateGas vs
 * static call), so probe the known spots in order.
 */
function extractRevertData(e: unknown): string | undefined {
	const err = e as {
		data?: unknown;
		error?: { data?: unknown };
		info?: { error?: { data?: unknown } };
	};
	const candidates = [err?.data, err?.error?.data, err?.info?.error?.data];
	for (const c of candidates) {
		if (typeof c === "string" && c.startsWith("0x") && c.length >= 10) {
			return c;
		}
	}
	return undefined;
}

function describeRevert(revert: RevertInfo): string {
	// Prefer the parsed name + args ("AbsoluteCapExceeded(1, 2)").
	if (revert.name) {
		const args =
			revert.args && revert.args.length > 0
				? `(${revert.args.map(String).join(", ")})`
				: "()";
		return `${revert.name}${args}`;
	}
	// Fallback: ethers' `signature` already has parentheses baked in.
	if (revert.signature) return revert.signature;
	return "revert";
}

/**
 * Format any contract-call error into a single, readable `Error`.
 *
 * @param method  Caller-supplied label (e.g. function name) prepended to
 *                the message.
 * @param error   Whatever was thrown by ethers (untyped on purpose —
 *                ethers' error shape varies).
 * @param iface   Optional contract `Interface` used as a fallback decoder
 *                when ethers couldn't parse the error itself.
 */
export function formatContractError(
	method: string,
	error: unknown,
	iface?: ethers.Interface,
): Error {
	const e = error as {
		revert?: RevertInfo;
		shortMessage?: string;
		reason?: string;
		message?: string;
	};
	const data = extractRevertData(error);

	// 1. ethers already parsed it (the common case for known ABIs).
	if (e?.revert) {
		return new Error(`${method} failed: ${describeRevert(e.revert)}`);
	}

	// 2. We have raw revert data — try to parse it with the provided ABI.
	if (data && iface) {
		try {
			const parsed = iface.parseError(data);
			if (parsed) {
				return new Error(
					`${method} failed: ${describeRevert({
						name: parsed.name,
						signature: parsed.signature,
						args: parsed.args as readonly unknown[],
					})}`,
				);
			}
		} catch {
			/* fall through */
		}
	}

	// 3. Ecosystem-wide fallback. The called contract's ABI only names ITS
	// errors; a revert bubbling up from a nested call (adapter, underlying
	// market, token) carries the CHILD's selector, which is contract-
	// independent: the merged dictionary names it regardless of call
	// depth, and also covers Error(string) and Panic(uint256).
	if (data) {
		const described = describeRevertData(data);
		if (described) {
			return new Error(`${method} failed: ${described}`);
		}
	}

	// 4. Generic fallbacks ethers exposes. If an unrecognized custom error
	// slipped through, keep its selector + raw data greppable (the selector
	// can be looked up on openchain.xyz / 4byte.directory).
	const msg = e?.shortMessage ?? e?.reason ?? e?.message ?? "unknown error";
	if (data) {
		return new Error(
			`${method} failed: ${msg} (unrecognized custom error, selector ${data.slice(0, 10)}, data ${data})`,
		);
	}
	return new Error(`${method} failed: ${msg}`);
}

/**
 * Send a contract write and forward any revert through `formatContractError`.
 * No static-call simulation, no auto tx-overrides detection — pass any
 * overrides as the final argument and ethers handles them natively.
 *
 * @example
 * await executeContractMethod(vaultContract, "deposit", amount, onBehalf);
 * await executeContractMethod(factory, "createVaultV2", owner, asset, salt, { gasLimit: 500_000n });
 */
export async function executeContractMethod(
	contract: ethers.Contract,
	method: string,
	...args: unknown[]
): Promise<ethers.TransactionResponse> {
	try {
		return await contract[method](...args);
	} catch (error) {
		throw formatContractError(method, error, contract.interface);
	}
}

/**
 * Read a contract view/pure method and forward any error through
 * `formatContractError`.
 */
export async function callContractMethod<T = unknown>(
	contract: ethers.Contract,
	method: string,
	...args: unknown[]
): Promise<T> {
	try {
		return (await contract[method](...args)) as T;
	} catch (error) {
		throw formatContractError(method, error, contract.interface);
	}
}
