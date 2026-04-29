/**
 * ERC4626 adapter (= MorphoVaultV1Adapter) — unit tests for the surface
 * exposed via `getAdapterContract` and `AdapterInstance`. No RPC.
 *
 * The ERC4626 adapter has the smallest surface: just the common
 * `setSkimRecipient` / `skim` and the read views.
 */

import { JsonRpcProvider } from "ethers";
import { describe, expect, it } from "vitest";
import { AdapterInstance } from "../../src/clients/adapters/AdaptersClient";
import { getAdapterContract } from "../../src/clients/adapters/_contracts";
import type { ChainsOptions } from "../../src/types";
import { ContractProvider } from "../../src/utils";
import { ADDR_A as ADAPTER_ADDR, ADDR_B as RECIPIENT } from "../_fixtures";

function makeStubProvider(chainId: ChainsOptions = 1): ContractProvider {
	const provider = new JsonRpcProvider("http://127.0.0.1:0");
	const cp = new ContractProvider(provider);
	// @ts-expect-error — touching a private field for test stubbing
	cp.chainIdCache = chainId;
	return cp;
}

describe("ERC4626 adapter — ABI surface", () => {
	const cp = makeStubProvider();
	const c = getAdapterContract(cp, ADAPTER_ADDR, "erc4626");

	it("exposes the read surface (ids, morphoVaultV1, skimRecipient, factory, parentVault)", () => {
		for (const fn of [
			"ids",
			"morphoVaultV1",
			"skimRecipient",
			"factory",
			"parentVault",
			"adapterId",
			"realAssets",
			"allocation",
		]) {
			expect(c.interface.getFunction(fn), fn).not.toBeNull();
		}
	});

	it("exposes the write surface (setSkimRecipient, skim, allocate, deallocate)", () => {
		for (const fn of ["setSkimRecipient", "skim", "allocate", "deallocate"]) {
			expect(c.interface.getFunction(fn), fn).not.toBeNull();
		}
	});

	it("setSkimRecipient takes one address argument", () => {
		const fn = c.interface.getFunction("setSkimRecipient");
		expect(fn?.inputs).toHaveLength(1);
		expect(fn?.inputs[0].type).toBe("address");
	});

	it("skim takes one address (token) argument", () => {
		const fn = c.interface.getFunction("skim");
		expect(fn?.inputs).toHaveLength(1);
		expect(fn?.inputs[0].type).toBe("address");
	});

	it("does NOT expose claim/setClaimer/submit/abdicate (specific to other types)", () => {
		for (const fn of ["claim", "setClaimer", "submit", "abdicate", "increaseTimelock"]) {
			expect(c.interface.getFunction(fn), fn).toBeNull();
		}
	});
});

describe("ERC4626 adapter — AdapterInstance", () => {
	const cp = makeStubProvider();
	const inst = new AdapterInstance(cp, ADAPTER_ADDR, "erc4626");

	it("exposes the common skim methods", () => {
		expect(typeof inst.getSkimRecipient).toBe("function");
		expect(typeof inst.setSkimRecipient).toBe("function");
		expect(typeof inst.skim).toBe("function");
	});

	it("exposes the per-type reads", () => {
		expect(typeof inst.getIdsERC4626).toBe("function");
		expect(typeof inst.getUnderlyingERC4626).toBe("function");
	});

	it("setSkimRecipient returns a Promise (lazy — does NOT send)", () => {
		// We call the method but never await it; the stub provider has no
		// signer, so awaiting would fail. The point here is that the method
		// builds without throwing synchronously.
		const p = inst.setSkimRecipient(RECIPIENT);
		expect(p).toBeInstanceOf(Promise);
		// Suppress unhandled rejection
		p.catch(() => {});
	});

	it("rejects type-specific methods that don't apply to erc4626", () => {
		expect(() => inst.getClaimer()).toThrow(/not supported/);
		expect(() => inst.setClaimer(RECIPIENT)).toThrow(/not supported/);
		expect(() => inst.claim("0x")).toThrow(/not supported/);
		expect(() => inst.getCometRewards()).toThrow(/compoundV3/);
		expect(() => inst.getMerklDistributor()).toThrow(/erc4626Merkl/);
		expect(() => inst.submit("0x")).toThrow(/morphoMarketV1/);
		expect(() => inst.abdicate("0x00000000")).toThrow(/morphoMarketV1/);
		expect(() => inst.getTimelock("0x00000000")).toThrow(/morphoMarketV1/);
		expect(() => inst.getMarketIdsLength()).toThrow(/morphoMarketV1/);
	});
});
