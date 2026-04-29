/**
 * Integration-write: createVault.
 *
 * Verifies the static-call vault address matches the deployed address
 * and that initial state is the documented "zero" config.
 */

import { ethers, isAddress, randomBytes, ZeroAddress } from "ethers";
import { expect } from "vitest";
import { ZERO_ADDRESS } from "../_fixtures";
import { hasRpcAndSigner } from "../_helpers";
import { logTx, test } from "../_test";

test.skipIf(!hasRpcAndSigner())(
	"creates a vault, returns the predicted address, and exposes a ready Vault instance",
	async ({ anvil }) => {
		const cfg = await anvil.client.getNetworkConfig();
		const salt = ethers.hexlify(randomBytes(32));

		const tx = await anvil.client.createVault(anvil.me, cfg.USDCaddress, salt);
		expect(isAddress(tx.vaultAddress)).toBe(true);
		expect(tx.vaultAddress).not.toBe(ZeroAddress);
		expect(tx.vault.address).toBe(tx.vaultAddress);

		const receipt = await logTx(tx, "createVault");
		expect(receipt?.status).toBe(1);

		// Read-back: the deployed contract has code, asset & owner match.
		expect(await anvil.provider.getCode(tx.vaultAddress)).not.toBe("0x");
		expect((await tx.vault.asset()).toLowerCase()).toBe(
			cfg.USDCaddress.toLowerCase(),
		);
		expect((await tx.vault.owner()).toLowerCase()).toBe(anvil.me.toLowerCase());

		// Initial state: no curator, no adapters, no fees, timelocks = 0.
		expect((await tx.vault.curator()).toLowerCase()).toBe(ZERO_ADDRESS);
		expect(await tx.vault.adaptersLength()).toBe(0n);
		expect(await tx.vault.performanceFee()).toBe(0n);
		expect(await tx.vault.managementFee()).toBe(0n);
		expect(await tx.vault.timelock("addAdapter")).toBe(0n);
	},
);
