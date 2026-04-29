/**
 * Integration-read: full vault state read against a known deployed vault.
 *
 * Skipped unless `TEST_VAULT_ADDRESS` is set. Asserts types and basic
 * invariants — never specific values, since on-chain state evolves.
 */

import { isAddress, ZeroAddress } from "ethers";
import { beforeAll, describe, expect, it } from "vitest";
import type { Vault } from "../../src";
import { hasTestVault, TEST_VAULT_ADDRESS } from "../_helpers";
import { setupReadOnly } from "../_setup";

describe.skipIf(!hasTestVault())("integration-read · vault state", () => {
	let vault: Vault;

	beforeAll(() => {
		const { client } = setupReadOnly();
		vault = client.vault(TEST_VAULT_ADDRESS);
	});

	describe("identity & metadata", () => {
		it("vault address matches the env var", () => {
			expect(vault.address).toBe(TEST_VAULT_ADDRESS);
		});
		it("asset is a valid non-zero address", async () => {
			const asset = await vault.asset();
			expect(isAddress(asset)).toBe(true);
			expect(asset).not.toBe(ZeroAddress);
		});
		it("decimals is in a sensible range", async () => {
			const d = await vault.decimals();
			expect(typeof d).toBe("bigint");
			expect(Number(d)).toBeGreaterThanOrEqual(6);
			expect(Number(d)).toBeLessThanOrEqual(36);
		});
		it("name and symbol are strings", async () => {
			expect(typeof (await vault.name())).toBe("string");
			expect(typeof (await vault.symbol())).toBe("string");
		});
	});

	describe("supply & assets", () => {
		it("totalAssets is a non-negative bigint", async () => {
			const ta = await vault.totalAssets();
			expect(typeof ta).toBe("bigint");
			expect(ta >= 0n).toBe(true);
		});
		it("totalSupply is a non-negative bigint", async () => {
			const ts = await vault.totalSupply();
			expect(typeof ts).toBe("bigint");
			expect(ts >= 0n).toBe(true);
		});
		it("virtualShares is positive", async () => {
			expect((await vault.virtualShares()) > 0n).toBe(true);
		});
	});

	describe("roles", () => {
		it("owner is a valid address", async () => {
			expect(isAddress(await vault.owner())).toBe(true);
		});
		it("curator is a valid address", async () => {
			expect(isAddress(await vault.curator())).toBe(true);
		});
	});

	describe("adapters list", () => {
		it("adaptersLength is a non-negative bigint", async () => {
			const len = await vault.adaptersLength();
			expect(typeof len).toBe("bigint");
			expect(len >= 0n).toBe(true);
		});

		it("each adapter is a valid address", async () => {
			const len = Number(await vault.adaptersLength());
			for (let i = 0; i < len; i++) {
				const addr = await vault.adapter(i);
				expect(isAddress(addr)).toBe(true);
				expect(await vault.isAdapter(addr)).toBe(true);
			}
		});
	});

	describe("fees & rate", () => {
		it("performanceFee is within MAX_PERFORMANCE_FEE (50%)", async () => {
			expect((await vault.performanceFee()) <= 5n * 10n ** 17n).toBe(true);
		});
		it("managementFee is a bigint", async () => {
			expect(typeof (await vault.managementFee())).toBe("bigint");
		});
		it("maxRate is a bigint", async () => {
			expect(typeof (await vault.maxRate())).toBe("bigint");
		});
	});

	describe("gates", () => {
		it.each([
			["receiveSharesGate"],
			["sendSharesGate"],
			["receiveAssetsGate"],
			["sendAssetsGate"],
		] as const)("%s is a valid address (zero = open gate)", async (key) => {
			const g = await (vault[key] as () => Promise<string>)();
			expect(isAddress(g)).toBe(true);
		});
	});

	describe("preview round-trip", () => {
		it("previewMint(previewDeposit(x)) >= x for non-empty vaults", async () => {
			const ts = await vault.totalSupply();
			if (ts === 0n) return; // empty vault — preview seeds vary
			const oneAsset = 10n ** (await vault.decimals());
			const shares = await vault.previewDeposit(oneAsset);
			const assetsBack = await vault.previewMint(shares);
			expect(assetsBack >= oneAsset - 1n).toBe(true);
		});
	});

	describe("idle balance", () => {
		it("idleBalance is non-negative", async () => {
			expect((await vault.idleBalance()) >= 0n).toBe(true);
		});
		it("assetBalance(vault.address) equals idleBalance", async () => {
			expect(await vault.assetBalance(vault.address)).toBe(
				await vault.idleBalance(),
			);
		});
	});
});
