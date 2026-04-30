/**
 * MorphoMarketV1 V2 adapter — unit tests for the surface exposed via
 * `getAdapterContract` and `AdapterInstance`. No RPC.
 *
 * This adapter has its OWN timelock + abdicate machinery on top of the
 * common skim surface — distinct from (and parallel to) the parent
 * vault's timelock. None of these calls can be bundled into the vault's
 * multicall (different target contract).
 */

import { JsonRpcProvider } from "ethers";
import { describe, expect, it } from "vitest";
import { getAdapterContract } from "../../src/clients/adapters/_contracts";
import { AdapterInstance } from "../../src/clients/adapters/AdaptersClient";
import type { ChainsOptions } from "../../src/types";
import { ContractProvider } from "../../src/utils";
import {
	ADDR_A as ADAPTER_ADDR,
	RAW_DATA,
	ADDR_B as RECIPIENT,
} from "../_fixtures";

const SOME_SELECTOR = "0xdeadbeef";

function makeStubProvider(chainId: ChainsOptions = 1): ContractProvider {
	const provider = new JsonRpcProvider("http://127.0.0.1:0");
	const cp = new ContractProvider(provider);
	// @ts-expect-error — touching a private field for test stubbing
	cp.chainIdCache = chainId;
	return cp;
}

describe("MorphoMarketV1 V2 adapter — ABI surface", () => {
	const cp = makeStubProvider();
	const c = getAdapterContract(cp, ADAPTER_ADDR, "morphoMarketV1");

	it("exposes the common read surface", () => {
		for (const fn of [
			"ids",
			"morpho",
			"skimRecipient",
			"factory",
			"parentVault",
			"adapterId",
			"asset",
			"realAssets",
			"allocation",
			"adaptiveCurveIrm",
		]) {
			expect(c.interface.getFunction(fn), fn).not.toBeNull();
		}
	});

	it("exposes the marketIds read surface (V2 — replaces marketParamsList)", () => {
		expect(c.interface.getFunction("marketIds")).not.toBeNull();
		expect(c.interface.getFunction("marketIdsLength")).not.toBeNull();
		expect(c.interface.getFunction("marketParamsList")).toBeNull();
		expect(c.interface.getFunction("marketParamsListLength")).toBeNull();
	});

	it("exposes the timelock read surface (timelock, abdicated, executableAt)", () => {
		expect(c.interface.getFunction("timelock")).not.toBeNull();
		expect(c.interface.getFunction("abdicated")).not.toBeNull();
		expect(c.interface.getFunction("executableAt")).not.toBeNull();
	});

	it("exposes the timelock write surface", () => {
		for (const fn of [
			"submit",
			"revoke",
			"abdicate",
			"increaseTimelock",
			"decreaseTimelock",
			"setSkimRecipient",
			"skim",
		]) {
			expect(c.interface.getFunction(fn), fn).not.toBeNull();
		}
	});

	it("submit / revoke take `bytes data`", () => {
		for (const fn of ["submit", "revoke"]) {
			const f = c.interface.getFunction(fn);
			expect(f?.inputs, fn).toHaveLength(1);
			expect(f?.inputs[0].type, fn).toBe("bytes");
		}
	});

	it("abdicate takes one `bytes4 selector`", () => {
		const f = c.interface.getFunction("abdicate");
		expect(f?.inputs).toHaveLength(1);
		expect(f?.inputs[0].type).toBe("bytes4");
	});

	it("increaseTimelock / decreaseTimelock take (bytes4, uint256)", () => {
		for (const fn of ["increaseTimelock", "decreaseTimelock"]) {
			const f = c.interface.getFunction(fn);
			expect(
				f?.inputs.map((i) => i.type),
				fn,
			).toEqual(["bytes4", "uint256"]);
		}
	});

	it("does NOT expose claim/setClaimer/comet (specific to other types)", () => {
		for (const fn of [
			"claim",
			"setClaimer",
			"claimer",
			"comet",
			"cometRewards",
			"erc4626Vault",
			"morphoVaultV1",
		]) {
			expect(c.interface.getFunction(fn), fn).toBeNull();
		}
	});
});

describe("MorphoMarketV1 V2 adapter — AdapterInstance", () => {
	const cp = makeStubProvider();
	const inst = new AdapterInstance(cp, ADAPTER_ADDR, "morphoMarketV1");

	it("exposes the common skim + per-type reads", () => {
		expect(typeof inst.getSkimRecipient).toBe("function");
		expect(typeof inst.setSkimRecipient).toBe("function");
		expect(typeof inst.skim).toBe("function");
		expect(typeof inst.getIdsMarketV1).toBe("function");
		expect(typeof inst.getUnderlyingMarketFromAdapterV1).toBe("function");
		expect(typeof inst.getMarketId).toBe("function");
		expect(typeof inst.getMarketIdsLength).toBe("function");
		expect(typeof inst.getMarketState).toBe("function");
	});

	it("exposes the universal adapterId getter", () => {
		expect(typeof inst.getAdapterId).toBe("function");
		const p = inst.getAdapterId();
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("getMarketState returns a Promise (lazy — does NOT send)", () => {
		const p = inst.getMarketState(
			"0x0000000000000000000000000000000000000000000000000000000000000000",
		);
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("exposes the timelock surface (submit, revoke, abdicate, [in|de]creaseTimelock)", () => {
		expect(typeof inst.submit).toBe("function");
		expect(typeof inst.revoke).toBe("function");
		expect(typeof inst.abdicate).toBe("function");
		expect(typeof inst.increaseTimelock).toBe("function");
		expect(typeof inst.decreaseTimelock).toBe("function");
		expect(typeof inst.getTimelock).toBe("function");
		expect(typeof inst.getAbdicated).toBe("function");
		expect(typeof inst.getExecutableAt).toBe("function");
	});

	it("submit returns a Promise (lazy — does NOT send)", () => {
		const p = inst.submit(RAW_DATA);
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("abdicate returns a Promise", () => {
		const p = inst.abdicate(SOME_SELECTOR);
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("increaseTimelock returns a Promise and accepts bigint duration", () => {
		const p = inst.increaseTimelock(SOME_SELECTOR, 86_400n);
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("setSkimRecipient returns a Promise", () => {
		const p = inst.setSkimRecipient(RECIPIENT);
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("rejects compoundV3-specific methods", () => {
		expect(() => inst.getCometRewards()).toThrow(/compoundV3/);
		expect(() => inst.getCometState()).toThrow(/compoundV3/);
	});

	it("rejects erc4626-specific methods", () => {
		expect(() => inst.getVaultStateERC4626()).toThrow(/erc4626/);
	});

	it("rejects erc4626Merkl-specific methods", () => {
		expect(() => inst.getMerklDistributor()).toThrow(/erc4626Merkl/);
		expect(() => inst.getVaultStateERC4626Merkl()).toThrow(/erc4626Merkl/);
	});

	it("rejects rewards methods (claim/setClaimer/getClaimer)", () => {
		expect(() => inst.claim(RAW_DATA)).toThrow(/not supported/);
		expect(() => inst.setClaimer(RECIPIENT)).toThrow(/not supported/);
		expect(() => inst.getClaimer()).toThrow(/not supported/);
	});

	it("getMarketIdsLength does NOT throw (it's the right type)", () => {
		// Method exists and is callable — actual RPC is stubbed so we only
		// assert no synchronous throw from requireType.
		const p = inst.getMarketIdsLength();
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});
});
