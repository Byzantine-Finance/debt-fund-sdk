/**
 * Adapter routing tests — verifies that for every supported (chain,
 * adapter-type) pair, the SDK builds a contract with the correct address
 * and ABI surface, without hitting any RPC.
 *
 * Uses a stubbed ContractProvider that returns hard-coded chain configs.
 */

import { JsonRpcProvider } from "ethers";
import { describe, expect, it } from "vitest";
import { AdapterInstance } from "../../src/clients/adapters/AdaptersClient";
import {
	getAdapterContract,
	getAdapterFactoryContract,
} from "../../src/clients/adapters/_contracts";
import { NETWORKS } from "../../src/constants/networks";
import type { ChainsOptions } from "../../src/types";
import { ContractProvider } from "../../src/utils";
import { ADDR_A as ADAPTER_ADDR } from "../_fixtures";

const CHAINS: ChainsOptions[] = [1, 8453];
const TYPES = ["erc4626", "erc4626Merkl", "compoundV3", "morphoMarketV1"] as const;

/** Build a ContractProvider whose chain ID is locked without any RPC call. */
function makeStubProvider(chainId: ChainsOptions): ContractProvider {
	const provider = new JsonRpcProvider("http://127.0.0.1:0");
	const cp = new ContractProvider(provider);
	// Pre-seed the cache so getChainId/getNetworkConfig don't actually call RPC.
	// @ts-expect-error — touching a private field for test stubbing
	cp.chainIdCache = chainId;
	return cp;
}

describe("getAdapterFactoryContract — address routing per (chain, type)", () => {
	for (const chainId of CHAINS) {
		describe(`chain ${chainId}`, () => {
			const expected = NETWORKS[chainId].adapters;

			it.each(TYPES)("%s factory address matches NETWORKS config", async (type) => {
				const cp = makeStubProvider(chainId);
				const factory = await getAdapterFactoryContract(cp, type);
				const fieldName = (
					{
						erc4626: "erc4626AdapterFactory",
						erc4626Merkl: "erc4626MerklAdapterFactory",
						compoundV3: "compoundV3AdapterFactory",
						morphoMarketV1: "morphoMarketV1AdapterFactory",
					} as const
				)[type];
				expect(factory.target).toBe(expected[fieldName]);
			});
		});
	}
});

describe("getAdapterFactoryContract — ABI surface per type", () => {
	const cp = makeStubProvider(8453);

	it("erc4626 factory exposes createMorphoVaultV1Adapter + isMorphoVaultV1Adapter", async () => {
		const f = await getAdapterFactoryContract(cp, "erc4626");
		expect(f.interface.getFunction("createMorphoVaultV1Adapter")).not.toBeNull();
		expect(f.interface.getFunction("isMorphoVaultV1Adapter")).not.toBeNull();
		expect(f.interface.getFunction("morphoVaultV1Adapter")).not.toBeNull();
	});

	it("erc4626Merkl factory exposes createERC4626MerklAdapter + isERC4626MerklAdapter", async () => {
		const f = await getAdapterFactoryContract(cp, "erc4626Merkl");
		expect(f.interface.getFunction("createERC4626MerklAdapter")).not.toBeNull();
		expect(f.interface.getFunction("isERC4626MerklAdapter")).not.toBeNull();
		expect(f.interface.getFunction("erc4626MerklAdapter")).not.toBeNull();
	});

	it("compoundV3 factory exposes createCompoundV3Adapter + isCompoundV3Adapter", async () => {
		const f = await getAdapterFactoryContract(cp, "compoundV3");
		expect(f.interface.getFunction("createCompoundV3Adapter")).not.toBeNull();
		expect(f.interface.getFunction("isCompoundV3Adapter")).not.toBeNull();
		expect(f.interface.getFunction("compoundV3Adapter")).not.toBeNull();
	});

	it("morphoMarketV1 factory exposes createMorphoMarketV1AdapterV2 + isMorphoMarketV1AdapterV2", async () => {
		const f = await getAdapterFactoryContract(cp, "morphoMarketV1");
		expect(f.interface.getFunction("createMorphoMarketV1AdapterV2")).not.toBeNull();
		expect(f.interface.getFunction("isMorphoMarketV1AdapterV2")).not.toBeNull();
		expect(f.interface.getFunction("morphoMarketV1AdapterV2")).not.toBeNull();
		expect(f.interface.getFunction("morpho")).not.toBeNull();
		expect(f.interface.getFunction("adaptiveCurveIrm")).not.toBeNull();
	});
});

describe("getAdapterContract — ABI surface per deployed-adapter type", () => {
	const cp = makeStubProvider(1);

	it("erc4626 adapter exposes ids + morphoVaultV1", () => {
		const c = getAdapterContract(cp, ADAPTER_ADDR, "erc4626");
		expect(c.target).toBe(ADAPTER_ADDR);
		expect(c.interface.getFunction("ids")).not.toBeNull();
		expect(c.interface.getFunction("morphoVaultV1")).not.toBeNull();
	});

	it("erc4626Merkl adapter exposes ids + erc4626Vault", () => {
		const c = getAdapterContract(cp, ADAPTER_ADDR, "erc4626Merkl");
		expect(c.target).toBe(ADAPTER_ADDR);
		expect(c.interface.getFunction("ids")).not.toBeNull();
		expect(c.interface.getFunction("erc4626Vault")).not.toBeNull();
	});

	it("compoundV3 adapter exposes ids + comet", () => {
		const c = getAdapterContract(cp, ADAPTER_ADDR, "compoundV3");
		expect(c.target).toBe(ADAPTER_ADDR);
		expect(c.interface.getFunction("ids")).not.toBeNull();
		expect(c.interface.getFunction("comet")).not.toBeNull();
	});

	it("morphoMarketV1 adapter exposes ids + morpho + marketIds", () => {
		const c = getAdapterContract(cp, ADAPTER_ADDR, "morphoMarketV1");
		expect(c.target).toBe(ADAPTER_ADDR);
		expect(c.interface.getFunction("ids")).not.toBeNull();
		expect(c.interface.getFunction("morpho")).not.toBeNull();
		expect(c.interface.getFunction("marketIds")).not.toBeNull();
		expect(c.interface.getFunction("marketIdsLength")).not.toBeNull();
		expect(c.interface.getFunction("adaptiveCurveIrm")).not.toBeNull();
	});

	it("each adapter Interface exposes a `factory()` getter", () => {
		// The generic adapter-type detection in GlobalAdapters.ts depends on
		// every adapter exposing `factory()`. Verify this is true for all 4
		// types so the generic introspection keeps working.
		for (const t of TYPES) {
			const c = getAdapterContract(cp, ADAPTER_ADDR, t);
			expect(c.interface.getFunction("factory")).not.toBeNull();
		}
	});
});

describe("AdapterInstance — class wrapper", () => {
	const cp = makeStubProvider(8453);

	it.each(TYPES)("constructs an AdapterInstance for %s", (type) => {
		const inst = new AdapterInstance(cp, ADAPTER_ADDR, type);
		expect(inst.address).toBe(ADAPTER_ADDR);
		expect(inst.type).toBe(type);
		expect(inst.contract.target).toBe(ADAPTER_ADDR);
	});

	it("getIdsERC4626 throws if called on a non-erc4626 adapter", () => {
		const inst = new AdapterInstance(cp, ADAPTER_ADDR, "compoundV3");
		expect(() => inst.getIdsERC4626()).toThrow(/erc4626/);
	});

	it("getIdsCompoundV3 throws if called on a non-compoundV3 adapter", () => {
		const inst = new AdapterInstance(cp, ADAPTER_ADDR, "erc4626");
		expect(() => inst.getIdsCompoundV3()).toThrow(/compoundV3/);
	});

	it("getMarketId throws if called on a non-morphoMarketV1 adapter", () => {
		const inst = new AdapterInstance(cp, ADAPTER_ADDR, "erc4626");
		expect(() => inst.getMarketId(0)).toThrow(/morphoMarketV1/);
	});
});
