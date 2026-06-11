/**
 * Live value / allocation surface — unit tests for the reads built on top
 * of the IAdapter-guaranteed `realAssets()`: type-agnostic getRealAssets /
 * getParentVault, the per-type lazy `allocation`, and the Morpho V1
 * per-market decomposition (expectedSupplyAssets / supplyShares). No RPC.
 *
 * Semantics under test (see GlobalAdapters JSDoc): `realAssets()` is part
 * of the `IAdapter` interface so it exists on every adapter type, while
 * `allocation` is a per-type convenience whose signature differs between
 * the single-id types (no args) and morphoMarketV1 (per-market params).
 */

import { JsonRpcProvider } from "ethers";
import { describe, expect, it } from "vitest";
import { getAdapterContract } from "../../src/clients/adapters/_contracts";
import type {
	AdapterType,
	MarketParams,
} from "../../src/clients/adapters";
import { AdapterInstance } from "../../src/clients/adapters/AdaptersClient";
import { ByzantineClient } from "../../src/clients/ByzantineClient";
import type { ChainsOptions } from "../../src/types";
import { ContractProvider } from "../../src/utils";
import {
	ADDR_A as ADAPTER_ADDR,
	ADDR_B,
	ADDR_C,
	ADDR_D,
	ID_DATA_ZERO,
	ZERO_ADDRESS,
} from "../_fixtures";

const ALL_TYPES: AdapterType[] = [
	"erc4626",
	"erc4626Merkl",
	"compoundV3",
	"morphoMarketV1",
];
const SINGLE_ID_TYPES: AdapterType[] = [
	"erc4626",
	"erc4626Merkl",
	"compoundV3",
];

const MARKET_PARAMS: MarketParams = {
	loanToken: ADDR_B,
	collateralToken: ADDR_C,
	oracle: ADDR_D,
	irm: ZERO_ADDRESS,
	lltv: "860000000000000000",
};

function makeStubProvider(chainId: ChainsOptions = 1): ContractProvider {
	const provider = new JsonRpcProvider("http://127.0.0.1:0");
	const cp = new ContractProvider(provider);
	// @ts-expect-error — touching a private field for test stubbing
	cp.chainIdCache = chainId;
	return cp;
}

/** Assert `p` is a Promise and swallow its (expected) network rejection. */
function expectLazyPromise(p: Promise<unknown>): void {
	expect(p).toBeInstanceOf(Promise);
	p.catch(() => {});
}

describe("live value reads — ABI surface", () => {
	const cp = makeStubProvider();

	it("every adapter type exposes realAssets() + parentVault()", () => {
		for (const t of ALL_TYPES) {
			const c = getAdapterContract(cp, ADAPTER_ADDR, t);
			expect(c.interface.getFunction("realAssets"), `${t}.realAssets`)
				.not.toBeNull();
			expect(c.interface.getFunction("parentVault"), `${t}.parentVault`)
				.not.toBeNull();
		}
	});

	it("single-id types expose allocation() with no inputs", () => {
		for (const t of SINGLE_ID_TYPES) {
			const c = getAdapterContract(cp, ADAPTER_ADDR, t);
			const fn = c.interface.getFunction("allocation");
			expect(fn, `${t}.allocation`).not.toBeNull();
			expect(fn?.inputs.length, `${t}.allocation arity`).toBe(0);
		}
	});

	it("morphoMarketV1 allocation takes MarketParams (per-market)", () => {
		const c = getAdapterContract(cp, ADAPTER_ADDR, "morphoMarketV1");
		const fn = c.interface.getFunction("allocation");
		expect(fn).not.toBeNull();
		expect(fn?.inputs.length).toBe(1);
		expect(fn?.inputs[0].type).toBe("tuple");
	});

	it("morphoMarketV1 exposes the per-market live reads + burnShares", () => {
		const c = getAdapterContract(cp, ADAPTER_ADDR, "morphoMarketV1");
		for (const name of [
			"expectedSupplyAssets",
			"supplyShares",
			"burnShares",
			"adaptiveCurveIrm",
			"asset",
		]) {
			expect(c.interface.getFunction(name), name).not.toBeNull();
		}
		// Both per-market reads are keyed by the raw bytes32 market id.
		expect(c.interface.getFunction("expectedSupplyAssets")?.inputs[0].type)
			.toBe("bytes32");
		expect(c.interface.getFunction("supplyShares")?.inputs[0].type)
			.toBe("bytes32");
	});

	it("single-id types do NOT expose the morpho per-market reads", () => {
		for (const t of SINGLE_ID_TYPES) {
			const c = getAdapterContract(cp, ADAPTER_ADDR, t);
			expect(c.interface.getFunction("expectedSupplyAssets"), t).toBeNull();
			expect(c.interface.getFunction("supplyShares"), t).toBeNull();
			expect(c.interface.getFunction("burnShares"), t).toBeNull();
		}
	});
});

describe("AdapterInstance — live value surface", () => {
	const cp = makeStubProvider();

	it("getRealAssets / getParentVault are lazy promises on every type", () => {
		for (const t of ALL_TYPES) {
			const inst = new AdapterInstance(cp, ADAPTER_ADDR, t);
			expectLazyPromise(inst.getRealAssets());
			expectLazyPromise(inst.getParentVault());
		}
	});

	it("getAllocation is a lazy promise on single-id types", () => {
		for (const t of SINGLE_ID_TYPES) {
			const inst = new AdapterInstance(cp, ADAPTER_ADDR, t);
			expectLazyPromise(inst.getAllocation());
		}
	});

	it("getAllocation on morphoMarketV1 throws, pointing at the per-market read", () => {
		const inst = new AdapterInstance(cp, ADAPTER_ADDR, "morphoMarketV1");
		expect(() => inst.getAllocation()).toThrow(/getAllocationMarketV1/);
	});

	it("morphoMarketV1 per-market reads are lazy promises", () => {
		const inst = new AdapterInstance(cp, ADAPTER_ADDR, "morphoMarketV1");
		expectLazyPromise(inst.getAllocationMarketV1(MARKET_PARAMS));
		expectLazyPromise(inst.getExpectedSupplyAssets(ID_DATA_ZERO));
		expectLazyPromise(inst.getSupplyShares(ID_DATA_ZERO));
		expectLazyPromise(inst.getAdaptiveCurveIrm());
		expectLazyPromise(inst.getAsset());
		expectLazyPromise(inst.burnShares(ID_DATA_ZERO));
	});

	it("morphoMarketV1-only methods reject other types", () => {
		const inst = new AdapterInstance(cp, ADAPTER_ADDR, "erc4626");
		expect(() => inst.getAllocationMarketV1(MARKET_PARAMS)).toThrow(
			/morphoMarketV1/,
		);
		expect(() => inst.getExpectedSupplyAssets(ID_DATA_ZERO)).toThrow(
			/morphoMarketV1/,
		);
		expect(() => inst.getSupplyShares(ID_DATA_ZERO)).toThrow(/morphoMarketV1/);
		expect(() => inst.getAdaptiveCurveIrm()).toThrow(/morphoMarketV1/);
		expect(() => inst.burnShares(ID_DATA_ZERO)).toThrow(/morphoMarketV1/);
	});

	it("getAsset works on morphoMarketV1 + compoundV3, throws on the others", () => {
		for (const t of ["morphoMarketV1", "compoundV3"] as const) {
			const inst = new AdapterInstance(cp, ADAPTER_ADDR, t);
			expectLazyPromise(inst.getAsset());
		}
		for (const t of ["erc4626", "erc4626Merkl"] as const) {
			const inst = new AdapterInstance(cp, ADAPTER_ADDR, t);
			expect(() => inst.getAsset(), t).toThrow(/not supported/);
		}
	});
});

describe("ByzantineClient — live value delegations", () => {
	const client = new ByzantineClient(new JsonRpcProvider("http://127.0.0.1:0"));

	it("exposes the type-agnostic reads (any adapter, even unknown type)", () => {
		expectLazyPromise(client.getRealAssets(ADAPTER_ADDR));
		expectLazyPromise(client.getParentVault(ADAPTER_ADDR));
	});

	it("exposes the allocation + per-market reads", () => {
		expectLazyPromise(client.getAllocation(ADAPTER_ADDR, "erc4626"));
		expectLazyPromise(
			client.getAllocationMarketV1(ADAPTER_ADDR, MARKET_PARAMS),
		);
		expectLazyPromise(
			client.getExpectedSupplyAssets(ADAPTER_ADDR, ID_DATA_ZERO),
		);
		expectLazyPromise(client.getSupplyShares(ADAPTER_ADDR, ID_DATA_ZERO));
	});

	it("getAllocation on morphoMarketV1 throws synchronously (per-market)", () => {
		expect(() => client.getAllocation(ADAPTER_ADDR, "morphoMarketV1")).toThrow(
			/getAllocationMarketV1/,
		);
	});
});
