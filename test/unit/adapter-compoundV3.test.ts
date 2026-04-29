/**
 * CompoundV3 adapter — unit tests for the surface exposed via
 * `getAdapterContract` and `AdapterInstance`. No RPC.
 *
 * Specific to this adapter: claim / setClaimer / claimer plus
 * `cometRewards` (the rewards distributor address baked in at deploy).
 */

import { JsonRpcProvider } from "ethers";
import { describe, expect, it } from "vitest";
import { AdapterInstance } from "../../src/clients/adapters/AdaptersClient";
import { getAdapterContract } from "../../src/clients/adapters/_contracts";
import type { ChainsOptions } from "../../src/types";
import { ContractProvider } from "../../src/utils";
import {
	ADDR_A as ADAPTER_ADDR,
	ADDR_B as RECIPIENT,
	RAW_DATA,
} from "../_fixtures";

function makeStubProvider(chainId: ChainsOptions = 1): ContractProvider {
	const provider = new JsonRpcProvider("http://127.0.0.1:0");
	const cp = new ContractProvider(provider);
	// @ts-expect-error — touching a private field for test stubbing
	cp.chainIdCache = chainId;
	return cp;
}

describe("CompoundV3 adapter — ABI surface", () => {
	const cp = makeStubProvider();
	const c = getAdapterContract(cp, ADAPTER_ADDR, "compoundV3");

	it("exposes the common read surface", () => {
		for (const fn of [
			"ids",
			"comet",
			"skimRecipient",
			"factory",
			"parentVault",
			"adapterId",
			"asset",
			"realAssets",
			"allocation",
		]) {
			expect(c.interface.getFunction(fn), fn).not.toBeNull();
		}
	});

	it("exposes the rewards-specific reads (claimer, cometRewards)", () => {
		expect(c.interface.getFunction("claimer")).not.toBeNull();
		expect(c.interface.getFunction("cometRewards")).not.toBeNull();
	});

	it("exposes the write surface (claim, setClaimer, setSkimRecipient, skim)", () => {
		for (const fn of ["claim", "setClaimer", "setSkimRecipient", "skim"]) {
			expect(c.interface.getFunction(fn), fn).not.toBeNull();
		}
	});

	it("claim takes a `bytes data` argument", () => {
		const fn = c.interface.getFunction("claim");
		expect(fn?.inputs).toHaveLength(1);
		expect(fn?.inputs[0].type).toBe("bytes");
	});

	it("setClaimer takes one address argument", () => {
		const fn = c.interface.getFunction("setClaimer");
		expect(fn?.inputs).toHaveLength(1);
		expect(fn?.inputs[0].type).toBe("address");
	});

	it("does NOT expose Merkl/morphoMarketV1-specific functions", () => {
		for (const fn of [
			"MERKL_DISTRIBUTOR",
			"erc4626Vault",
			"submit",
			"abdicate",
			"increaseTimelock",
			"morphoVaultV1",
		]) {
			expect(c.interface.getFunction(fn), fn).toBeNull();
		}
	});
});

describe("CompoundV3 adapter — AdapterInstance", () => {
	const cp = makeStubProvider();
	const inst = new AdapterInstance(cp, ADAPTER_ADDR, "compoundV3");

	it("exposes the common skim + per-type reads", () => {
		expect(typeof inst.getSkimRecipient).toBe("function");
		expect(typeof inst.setSkimRecipient).toBe("function");
		expect(typeof inst.skim).toBe("function");
		expect(typeof inst.getIdsCompoundV3).toBe("function");
		expect(typeof inst.getUnderlyingCompoundV3).toBe("function");
	});

	it("exposes the rewards surface (claim, setClaimer, getClaimer, getCometRewards)", () => {
		expect(typeof inst.claim).toBe("function");
		expect(typeof inst.setClaimer).toBe("function");
		expect(typeof inst.getClaimer).toBe("function");
		expect(typeof inst.getCometRewards).toBe("function");
	});

	it("claim returns a Promise (lazy — does NOT send)", () => {
		const p = inst.claim(RAW_DATA);
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("setClaimer returns a Promise (lazy — does NOT send)", () => {
		const p = inst.setClaimer(RECIPIENT);
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("rejects erc4626Merkl-specific methods", () => {
		expect(() => inst.getMerklDistributor()).toThrow(/erc4626Merkl/);
	});

	it("rejects morphoMarketV1-specific methods", () => {
		expect(() => inst.submit("0x")).toThrow(/morphoMarketV1/);
		expect(() => inst.abdicate("0x00000000")).toThrow(/morphoMarketV1/);
		expect(() => inst.getTimelock("0x00000000")).toThrow(/morphoMarketV1/);
		expect(() => inst.getMarketIdsLength()).toThrow(/morphoMarketV1/);
	});
});
