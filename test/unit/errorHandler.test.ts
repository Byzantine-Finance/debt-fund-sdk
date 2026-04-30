/**
 * formatContractError unit tests — exercises every decoding path with
 * fabricated error objects (no contract / no RPC).
 */

import { Interface } from "ethers";
import { describe, expect, it } from "vitest";
import { VAULT_ABI } from "../../src/constants";
import { formatContractError } from "../../src/utils/contractErrorHandler";

const VAULT_IFACE = new Interface(VAULT_ABI);

describe("formatContractError — path 1: error.revert (ethers already parsed)", () => {
	it("formats name + args from a parsed revert", () => {
		const error = {
			revert: {
				name: "AbsoluteCapExceeded",
				signature: "AbsoluteCapExceeded()",
				args: [],
			},
		};
		const out = formatContractError("setSomething", error);
		expect(out.message).toBe("setSomething failed: AbsoluteCapExceeded()");
	});

	it("includes args when present", () => {
		const error = {
			revert: {
				name: "TimelockNotExpired",
				signature: "TimelockNotExpired(uint256,uint256)",
				args: [1n, 2n],
			},
		};
		const out = formatContractError("doX", error);
		expect(out.message).toContain("TimelockNotExpired(1, 2)");
	});

	it("falls back to signature when name is missing", () => {
		const error = { revert: { signature: "RawSig()", args: [] } };
		const out = formatContractError("call", error);
		expect(out.message).toBe("call failed: RawSig()");
	});
});

describe("formatContractError — path 2: iface.parseError fallback", () => {
	/**
	 * Build raw error-data bytes for `Unauthorized()` to feed into the
	 * fallback decoder. We use the contract's own ABI to encode it.
	 */
	const unauthorizedData = VAULT_IFACE.encodeErrorResult("Unauthorized", []);

	it("decodes raw data via the provided Interface", () => {
		const error = { data: unauthorizedData };
		const out = formatContractError("xyz", error, VAULT_IFACE);
		expect(out.message).toContain("Unauthorized");
	});

	it("ignores parsing failure and falls through to message", () => {
		const error = { data: "0xdeadbeef", message: "something else" };
		const out = formatContractError("xyz", error, VAULT_IFACE);
		// Couldn't parse 0xdeadbeef as a known custom error → shortMessage/message path
		expect(out.message).toBe("xyz failed: something else");
	});

	it("does nothing if data is empty", () => {
		const error = { data: "0x", message: "raw error" };
		const out = formatContractError("xyz", error, VAULT_IFACE);
		expect(out.message).toBe("xyz failed: raw error");
	});
});

describe("formatContractError — path 3: generic fallbacks", () => {
	it("uses shortMessage when present", () => {
		const out = formatContractError("call", {
			shortMessage: "transaction failed",
		});
		expect(out.message).toBe("call failed: transaction failed");
	});

	it("uses reason if shortMessage is missing", () => {
		const out = formatContractError("call", { reason: "execution reverted" });
		expect(out.message).toBe("call failed: execution reverted");
	});

	it("uses message if everything else is missing", () => {
		const out = formatContractError("call", { message: "boom" });
		expect(out.message).toBe("call failed: boom");
	});

	it("falls back to 'unknown error' when nothing is available", () => {
		const out = formatContractError("call", {});
		expect(out.message).toBe("call failed: unknown error");
	});

	it("handles `null` and `undefined` gracefully", () => {
		expect(formatContractError("call", null).message).toBe(
			"call failed: unknown error",
		);
		expect(formatContractError("call", undefined).message).toBe(
			"call failed: unknown error",
		);
	});
});

describe("formatContractError — priority order", () => {
	it("revert > data > shortMessage > reason > message", () => {
		const error = {
			revert: { name: "FromRevert", args: [] },
			data: VAULT_IFACE.encodeErrorResult("Unauthorized", []),
			shortMessage: "from-shortMessage",
			reason: "from-reason",
			message: "from-message",
		};
		const out = formatContractError("x", error, VAULT_IFACE);
		expect(out.message).toContain("FromRevert");
	});

	it("data > shortMessage when no revert", () => {
		const error = {
			data: VAULT_IFACE.encodeErrorResult("Unauthorized", []),
			shortMessage: "from-shortMessage",
		};
		const out = formatContractError("x", error, VAULT_IFACE);
		expect(out.message).toContain("Unauthorized");
	});
});

describe("formatContractError — return value is always a real Error", () => {
	it("returns an instance of Error", () => {
		const out = formatContractError("call", {
			revert: { name: "X", args: [] },
		});
		expect(out).toBeInstanceOf(Error);
	});
	it("the prefix is the method name", () => {
		const out = formatContractError("MY_METHOD_NAME", {
			message: "anything",
		});
		expect(out.message.startsWith("MY_METHOD_NAME failed:")).toBe(true);
	});
});
