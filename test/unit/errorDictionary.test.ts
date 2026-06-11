/**
 * Ecosystem-wide revert decoding — no RPC.
 *
 * The point under test: a custom error raised by a NESTED contract
 * (adapter, underlying market, token) bubbles its raw bytes up unchanged,
 * and `formatContractError` must name it even though the CALLED contract's
 * ABI does not declare it. Also covers the Solidity built-ins
 * (Error(string), Panic) and the greppable-selector fallback.
 */

import { AbiCoder, Interface, concat } from "ethers";
import { describe, expect, it } from "vitest";
import {
	MorphoMarketV1AdapterV2ABI,
	VAULT_ABI,
} from "../../src/constants/abis";
import {
	describeRevertData,
	ERROR_DICTIONARY,
	formatContractError,
} from "../../src/utils";

const coder = AbiCoder.defaultAbiCoder();
const vaultIface = new Interface(VAULT_ABI);
const adapterIface = new Interface(MorphoMarketV1AdapterV2ABI);

/** Build the raw revert bytes for a known custom error. */
function encodeError(iface: Interface, name: string, args: unknown[] = []) {
	return iface.encodeErrorResult(name, args);
}

describe("ERROR_DICTIONARY", () => {
	it("knows the vault's own errors", () => {
		const data = encodeError(vaultIface, "AbsoluteCapExceeded");
		expect(ERROR_DICTIONARY.parseError(data)?.name).toBe(
			"AbsoluteCapExceeded",
		);
	});

	it("knows adapter errors (a child of the vault on allocate/deposit paths)", () => {
		const data = encodeError(adapterIface, "LoanAssetMismatch");
		expect(ERROR_DICTIONARY.parseError(data)?.name).toBe("LoanAssetMismatch");
	});

	it("knows the hand-added OpenZeppelin standards", () => {
		const data = ERROR_DICTIONARY.encodeErrorResult(
			"ERC4626ExceededMaxDeposit",
			["0x000000000000000000000000000000000000dead", 5n, 3n],
		);
		const parsed = ERROR_DICTIONARY.parseError(data);
		expect(parsed?.name).toBe("ERC4626ExceededMaxDeposit");
		expect(parsed?.args.map(String)).toContain("5");
	});
});

describe("describeRevertData", () => {
	it("decodes Error(string) requires (e.g. Morpho Blue reasons)", () => {
		const data = concat(["0x08c379a0", coder.encode(["string"], ["insufficient liquidity"])]);
		expect(describeRevertData(data)).toBe(
			'reverted with reason "insufficient liquidity"',
		);
	});

	it("decodes Panic codes with a human label", () => {
		const data = concat(["0x4e487b71", coder.encode(["uint256"], [0x11])]);
		expect(describeRevertData(data)).toBe(
			"Panic(0x11): arithmetic overflow or underflow",
		);
	});

	it("returns null on empty or unknown data", () => {
		expect(describeRevertData("0x")).toBeNull();
		expect(describeRevertData("0xdeadbeef")).toBeNull();
	});
});

describe("formatContractError — nested revert paths", () => {
	it("names a child error even when decoding with the parent's interface", () => {
		// Simulate: user calls vault.deposit, the adapter reverts. The
		// error object carries the adapter's bytes; the caller passes the
		// VAULT interface, which does not declare NotAuthorized.
		const err = { data: encodeError(adapterIface, "LoanAssetMismatch") };
		const formatted = formatContractError("deposit", err, vaultIface);
		expect(formatted.message).toContain("LoanAssetMismatch");
	});

	it("digs revert data out of nested ethers shapes (info.error.data)", () => {
		const err = {
			message: "execution reverted",
			info: { error: { data: encodeError(adapterIface, "LoanAssetMismatch") } },
		};
		const formatted = formatContractError("deposit", err, vaultIface);
		expect(formatted.message).toContain("LoanAssetMismatch");
	});

	it("keeps the selector greppable for unknown custom errors", () => {
		const err = { message: "execution reverted", data: "0x12345678" };
		const formatted = formatContractError("deposit", err, vaultIface);
		expect(formatted.message).toContain("selector 0x12345678");
	});

	it("still prefers the called contract's parse when available", () => {
		const err = { data: encodeError(vaultIface, "AbsoluteCapExceeded") };
		const formatted = formatContractError("allocate", err, vaultIface);
		expect(formatted.message).toContain("AbsoluteCapExceeded");
	});
});
