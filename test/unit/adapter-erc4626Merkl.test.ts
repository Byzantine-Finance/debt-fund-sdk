/**
 * ERC4626Merkl adapter — unit tests for the surface exposed via
 * `getAdapterContract` and `AdapterInstance`. No RPC.
 *
 * On top of the common skim surface, this adapter has its own rewards
 * surface: claim / setClaimer / claimer / MERKL_DISTRIBUTOR.
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

function makeStubProvider(chainId: ChainsOptions = 1): ContractProvider {
	const provider = new JsonRpcProvider("http://127.0.0.1:0");
	const cp = new ContractProvider(provider);
	// @ts-expect-error — touching a private field for test stubbing
	cp.chainIdCache = chainId;
	return cp;
}

describe("ERC4626Merkl adapter — ABI surface", () => {
	const cp = makeStubProvider();
	const c = getAdapterContract(cp, ADAPTER_ADDR, "erc4626Merkl");

	it("exposes the common read surface", () => {
		for (const fn of [
			"ids",
			"erc4626Vault",
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

	it("exposes the rewards-specific reads (claimer, MERKL_DISTRIBUTOR)", () => {
		expect(c.interface.getFunction("claimer")).not.toBeNull();
		expect(c.interface.getFunction("MERKL_DISTRIBUTOR")).not.toBeNull();
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

	it("does NOT expose comet/cometRewards/submit/abdicate", () => {
		for (const fn of [
			"comet",
			"cometRewards",
			"submit",
			"abdicate",
			"increaseTimelock",
			"morphoVaultV1",
		]) {
			expect(c.interface.getFunction(fn), fn).toBeNull();
		}
	});
});

describe("ERC4626Merkl adapter — AdapterInstance", () => {
	const cp = makeStubProvider();
	const inst = new AdapterInstance(cp, ADAPTER_ADDR, "erc4626Merkl");

	it("exposes the common skim + per-type reads", () => {
		expect(typeof inst.getSkimRecipient).toBe("function");
		expect(typeof inst.setSkimRecipient).toBe("function");
		expect(typeof inst.skim).toBe("function");
		expect(typeof inst.getIdsERC4626Merkl).toBe("function");
		expect(typeof inst.getUnderlyingERC4626Merkl).toBe("function");
		expect(typeof inst.getVaultStateERC4626Merkl).toBe("function");
	});

	it("exposes the universal adapterId getter", () => {
		expect(typeof inst.getAdapterId).toBe("function");
		const p = inst.getAdapterId();
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("getVaultStateERC4626Merkl returns a Promise (lazy — does NOT send)", () => {
		const p = inst.getVaultStateERC4626Merkl();
		expect(p).toBeInstanceOf(Promise);
		p.catch(() => {});
	});

	it("exposes the rewards surface (claim, setClaimer, getClaimer, getMerklDistributor)", () => {
		expect(typeof inst.claim).toBe("function");
		expect(typeof inst.setClaimer).toBe("function");
		expect(typeof inst.getClaimer).toBe("function");
		expect(typeof inst.getMerklDistributor).toBe("function");
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

	it("rejects compoundV3-specific methods", () => {
		expect(() => inst.getCometRewards()).toThrow(/compoundV3/);
		expect(() => inst.getCometState()).toThrow(/compoundV3/);
	});

	it("rejects erc4626-specific methods", () => {
		expect(() => inst.getVaultStateERC4626()).toThrow(/erc4626/);
	});

	it("rejects morphoMarketV1-specific methods", () => {
		expect(() => inst.submit("0x")).toThrow(/morphoMarketV1/);
		expect(() => inst.abdicate("0x00000000")).toThrow(/morphoMarketV1/);
		expect(() => inst.getTimelock("0x00000000")).toThrow(/morphoMarketV1/);
		expect(() => inst.getAbdicated("0x00000000")).toThrow(/morphoMarketV1/);
		expect(() =>
			inst.getMarketState(
				"0x0000000000000000000000000000000000000000000000000000000000000000",
			),
		).toThrow(/morphoMarketV1/);
	});
});
