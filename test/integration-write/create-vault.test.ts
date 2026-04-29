/**
 * Integration-write: createVault.
 *
 * Verifies that the static-call vault address matches the deployed
 * address and that initial state is the documented "zero" config.
 */

import { ethers, isAddress, randomBytes, ZeroAddress } from "ethers";
import { beforeAll, describe, expect, it } from "vitest";
import { ZERO_ADDRESS } from "../_fixtures";
import { hasRpcAndSigner } from "../_helpers";
import { setupSigner, type SignerContext } from "../_setup";

describe.skipIf(!hasRpcAndSigner())("integration-write · createVault", () => {
	let ctx: SignerContext;

	beforeAll(async () => {
		ctx = await setupSigner();
	});

	it("creates a vault, returns the predicted address, and exposes a ready Vault instance", async () => {
		const cfg = await ctx.client.getNetworkConfig();
		const salt = ethers.hexlify(randomBytes(32));

		const tx = await ctx.client.createVault(ctx.me, cfg.USDCaddress, salt);
		expect(isAddress(tx.vaultAddress)).toBe(true);
		expect(tx.vaultAddress).not.toBe(ZeroAddress);
		expect(tx.vault.address).toBe(tx.vaultAddress);

		const receipt = await tx.wait();
		expect(receipt?.status).toBe(1);

		// Read-back: the deployed contract has code, asset & owner match.
		expect(await ctx.provider.getCode(tx.vaultAddress)).not.toBe("0x");
		expect(await tx.vault.asset()).toBe(cfg.USDCaddress);
		expect((await tx.vault.owner()).toLowerCase()).toBe(ctx.me.toLowerCase());

		// Initial state: no curator, no adapters, no fees, timelocks = 0.
		expect((await tx.vault.curator()).toLowerCase()).toBe(ZERO_ADDRESS);
		expect(await tx.vault.adaptersLength()).toBe(0n);
		expect(await tx.vault.performanceFee()).toBe(0n);
		expect(await tx.vault.managementFee()).toBe(0n);
		expect(await tx.vault.timelock("addAdapter")).toBe(0n);
	});
});
