/**
 * NetworkConfig integrity tests — verifies that every supported chain
 * exposes a complete and well-formed configuration. These tests catch
 * regressions like a missing field, a malformed address, or a duplicate
 * across chains.
 */

import { isAddress } from "ethers";
import { describe, expect, it } from "vitest";
import {
	getExplorerAddressUrl,
	getExplorerTransactionUrl,
	getExplorerUrl,
	getNetworkConfig,
	getSupportedChainIds,
	isChainSupported,
	NETWORKS,
	toHexChainId,
} from "../../src/constants/networks";
import type { ChainsOptions } from "../../src/types";

const REQUIRED_NETWORK_FIELDS = [
	"name",
	"vaultV2Factory",
	"morphoRegistry",
	"scanLink",
	"USDCaddress",
	"EURCaddress",
	"adapters",
] as const;

const REQUIRED_ADAPTER_FIELDS = [
	"erc4626AdapterFactory",
	"erc4626MerklAdapterFactory",
	"compoundV3AdapterFactory",
	"morphoMarketV1AdapterFactory",
] as const;

const ALL_CHAIN_IDS = [1, 8453] satisfies ChainsOptions[];

describe("NETWORKS — supported chains", () => {
	it("contains exactly Ethereum and Base", () => {
		const ids = Object.keys(NETWORKS)
			.map(Number)
			.sort((a, b) => a - b);
		expect(ids).toEqual([1, 8453]);
	});

	it("getSupportedChainIds returns the same set", () => {
		expect(getSupportedChainIds().sort((a, b) => a - b)).toEqual([1, 8453]);
	});
});

describe.each(
	ALL_CHAIN_IDS,
)("NetworkConfig structure — chain %s", (chainId) => {
	const cfg = NETWORKS[chainId];

	it.each(REQUIRED_NETWORK_FIELDS)("has field '%s'", (field) => {
		expect(cfg[field]).toBeDefined();
	});

	it.each(REQUIRED_ADAPTER_FIELDS)("has adapters.%s", (field) => {
		expect(cfg.adapters[field]).toBeDefined();
	});

	it("name is a non-empty string", () => {
		expect(typeof cfg.name).toBe("string");
		expect(cfg.name.length).toBeGreaterThan(0);
	});

	it("scanLink is an https URL", () => {
		expect(cfg.scanLink).toMatch(/^https:\/\/[^/]+$/);
	});

	it("vaultV2Factory is a valid address", () => {
		expect(isAddress(cfg.vaultV2Factory)).toBe(true);
	});

	it("morphoRegistry is a valid address", () => {
		expect(isAddress(cfg.morphoRegistry)).toBe(true);
	});

	it("USDCaddress is a valid address", () => {
		expect(isAddress(cfg.USDCaddress)).toBe(true);
	});

	it("EURCaddress is a valid address", () => {
		expect(isAddress(cfg.EURCaddress)).toBe(true);
	});

	it("every adapter factory is a valid address", () => {
		for (const f of REQUIRED_ADAPTER_FIELDS) {
			expect(isAddress(cfg.adapters[f])).toBe(true);
		}
	});

	it("no factory address is the zero address", () => {
		const ZERO = "0x0000000000000000000000000000000000000000";
		expect(cfg.vaultV2Factory.toLowerCase()).not.toBe(ZERO);
		expect(cfg.morphoRegistry.toLowerCase()).not.toBe(ZERO);
		for (const f of REQUIRED_ADAPTER_FIELDS) {
			expect(cfg.adapters[f].toLowerCase()).not.toBe(ZERO);
		}
	});
});

describe("Cross-chain uniqueness — no copy-paste between chains", () => {
	it("vaultV2Factory differs across chains", () => {
		expect(NETWORKS[1].vaultV2Factory).not.toBe(NETWORKS[8453].vaultV2Factory);
	});

	it("morphoRegistry differs across chains", () => {
		expect(NETWORKS[1].morphoRegistry).not.toBe(NETWORKS[8453].morphoRegistry);
	});

	it("each adapter factory differs across chains", () => {
		for (const f of REQUIRED_ADAPTER_FIELDS) {
			expect(NETWORKS[1].adapters[f]).not.toBe(NETWORKS[8453].adapters[f]);
		}
	});
});

describe("getNetworkConfig", () => {
	it("returns the config for a supported chain", () => {
		expect(getNetworkConfig(1)).toBe(NETWORKS[1]);
		expect(getNetworkConfig(8453)).toBe(NETWORKS[8453]);
	});

	it("throws on unsupported chain", () => {
		// @ts-expect-error — runtime error path
		expect(() => getNetworkConfig(99999)).toThrow(/Unsupported chain ID/);
	});
});

describe("isChainSupported", () => {
	it("returns true for supported chains", () => {
		expect(isChainSupported(1)).toBe(true);
		expect(isChainSupported(8453)).toBe(true);
	});

	it("returns false for unsupported chains", () => {
		expect(isChainSupported(42161)).toBe(false);
		expect(isChainSupported(0)).toBe(false);
	});

	it("acts as a type guard at compile time", () => {
		const x: number = 1;
		if (isChainSupported(x)) {
			// `x` should be narrowed to `ChainsOptions` here.
			const cfg = getNetworkConfig(x);
			expect(cfg).toBeDefined();
		}
	});
});

describe("toHexChainId", () => {
	it("returns 0x-prefixed lowercase hex", () => {
		expect(toHexChainId(1)).toBe("0x1");
		expect(toHexChainId(8453)).toBe("0x2105");
	});
});

describe("Explorer URL helpers", () => {
	const ADDR = "0x1111111111111111111111111111111111111111";
	const TX =
		"0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

	it("getExplorerUrl matches the network's scanLink", () => {
		expect(getExplorerUrl(1)).toBe("https://etherscan.io");
		expect(getExplorerUrl(8453)).toBe("https://basescan.org");
	});

	it("getExplorerAddressUrl appends /address/<addr>", () => {
		expect(getExplorerAddressUrl(1, ADDR)).toBe(
			`https://etherscan.io/address/${ADDR}`,
		);
	});

	it("getExplorerTransactionUrl appends /tx/<hash>", () => {
		expect(getExplorerTransactionUrl(8453, TX)).toBe(
			`https://basescan.org/tx/${TX}`,
		);
	});
});
