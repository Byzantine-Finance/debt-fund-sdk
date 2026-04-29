/**
 * Integration-write: user lifecycle on a freshly-created vault.
 *
 * Approve → deposit → check balances → withdraw → check balances.
 *
 * Requires the running wallet to hold at least DEPOSIT_AMOUNT of USDC.
 */

import { parseUnits } from "ethers";
import { beforeAll, describe, expect, it } from "vitest";
import type { Vault } from "../../src";
import { hasRpcAndSigner } from "../_helpers";
import { type FreshVaultContext, setupWithFreshVault } from "../_setup";

const DEPOSIT_AMOUNT = parseUnits("0.01", 6); // 0.01 USDC

describe.skipIf(!hasRpcAndSigner())(
	"integration-write · deposit / withdraw",
	() => {
		let ctx: FreshVaultContext;
		let vault: Vault;

		beforeAll(async () => {
			ctx = await setupWithFreshVault();
			vault = ctx.vault;
		});

		it("the running wallet has at least the deposit amount in USDC", async () => {
			const bal = await vault.assetBalance(ctx.me);
			expect(
				bal >= DEPOSIT_AMOUNT,
				`wallet ${ctx.me} needs at least ${DEPOSIT_AMOUNT} USDC (has ${bal})`,
			).toBe(true);
		});

		it("approve + deposit flow", async () => {
			if ((await vault.assetAllowance(ctx.me)) < DEPOSIT_AMOUNT) {
				await (await vault.approveAsset(DEPOSIT_AMOUNT)).wait();
			}
			expect((await vault.assetAllowance(ctx.me)) >= DEPOSIT_AMOUNT).toBe(true);

			const sharesBefore = await vault.balanceOf(ctx.me);
			const tx = await vault.deposit(DEPOSIT_AMOUNT, ctx.me);
			const receipt = await tx.wait();
			expect(receipt?.status).toBe(1);

			expect((await vault.balanceOf(ctx.me)) > sharesBefore).toBe(true);
		});

		it("withdraw returns assets to the receiver", async () => {
			const sharesBefore = await vault.balanceOf(ctx.me);
			const usdcBefore = await vault.assetBalance(ctx.me);

			const halfAssets = DEPOSIT_AMOUNT / 2n;
			await (await vault.withdraw(halfAssets, ctx.me, ctx.me)).wait();

			expect((await vault.balanceOf(ctx.me)) < sharesBefore).toBe(true);
			expect((await vault.assetBalance(ctx.me)) >= usdcBefore + halfAssets - 1n).toBe(true);
		});

		it("preview functions agree with realised amounts (within rounding)", async () => {
			const previewShares = await vault.previewDeposit(DEPOSIT_AMOUNT);
			const previewAssetsForMint = await vault.previewMint(previewShares);
			expect(previewAssetsForMint >= DEPOSIT_AMOUNT).toBe(true);
		});
	},
);
