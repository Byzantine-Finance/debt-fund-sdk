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
 *   3. `error.shortMessage` / `error.reason` / `error.message` — generic
 *      fallbacks when no custom error is reachable.
 */

import type { ethers } from "ethers";

/** Subset of ethers' parsed error shape we actually use. */
interface RevertInfo {
	name?: string;
	signature?: string;
	args?: readonly unknown[];
}

function describeRevert(revert: RevertInfo): string {
	const head = revert.name ?? revert.signature ?? "revert";
	const args = revert.args && revert.args.length > 0
		? `(${revert.args.map(String).join(", ")})`
		: "()";
	return `${head}${args}`;
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
		data?: string;
		shortMessage?: string;
		reason?: string;
		message?: string;
	};

	// 1. ethers already parsed it (the common case for known ABIs).
	if (e?.revert) {
		return new Error(`${method} failed: ${describeRevert(e.revert)}`);
	}

	// 2. We have raw revert data — try to parse it with the provided ABI.
	if (e?.data && e.data !== "0x" && iface) {
		try {
			const parsed = iface.parseError(e.data);
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

	// 3. Generic fallbacks ethers exposes.
	const msg = e?.shortMessage ?? e?.reason ?? e?.message ?? "unknown error";
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
