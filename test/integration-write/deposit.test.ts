/**
 * Integration-write: user lifecycle on a freshly-created vault.
 *
 * Approve → deposit → check balances → withdraw → check balances.
 *
 * Each test gets its own Anvil fork via the `freshVault` fixture, so the
 * wallet starts with 10 000 ETH and has *no on-chain history* — no
 * nonce drift, no shared state.
 *
 * The wallet still needs USDC on the forked chain to deposit. The fork
 * mirrors the real chain's USDC balance for that address; if your real
 * wallet has zero USDC, top up via `anvil_setStorageAt` on the USDC
 * balance slot, or fund a different account first via a transfer.
 */

import { parseUnits } from "ethers";
import { describe, expect } from "vitest";
import { hasRpcAndSigner } from "../_helpers";
import { logTx, test } from "../_test";

const DEPOSIT_AMOUNT = parseUnits("0.01", 6); // 0.01 USDC

describe.skipIf(!hasRpcAndSigner())(
	"integration-write · deposit / withdraw",
	() => {
		test("the running wallet has at least the deposit amount in USDC", async ({
			fundedVault: { vault, me },
		}) => {
			const bal = await vault.assetBalance(me);
			expect(
				bal >= DEPOSIT_AMOUNT,
				`wallet ${me} needs at least ${DEPOSIT_AMOUNT} USDC (has ${bal})`,
			).toBe(true);
		});

		test("approve + deposit flow", async ({ fundedVault: { vault, me } }) => {
			if ((await vault.assetAllowance(me)) < DEPOSIT_AMOUNT) {
				await logTx(await vault.approveAsset(DEPOSIT_AMOUNT), "approveAsset");
			}
			expect((await vault.assetAllowance(me)) >= DEPOSIT_AMOUNT).toBe(true);

			const sharesBefore = await vault.balanceOf(me);
			const receipt = await logTx(
				await vault.deposit(DEPOSIT_AMOUNT, me),
				"deposit",
			);
			expect(receipt?.status).toBe(1);
			expect((await vault.balanceOf(me)) > sharesBefore).toBe(true);
		});

		test("withdraw returns assets to the receiver", async ({
			fundedVault: { vault, me },
		}) => {
			// Need to deposit first inside this test (each test = own chain).
			await logTx(await vault.approveAsset(DEPOSIT_AMOUNT), "approveAsset");
			await logTx(await vault.deposit(DEPOSIT_AMOUNT, me), "deposit");

			const sharesBefore = await vault.balanceOf(me);
			const usdcBefore = await vault.assetBalance(me);

			const halfAssets = DEPOSIT_AMOUNT / 2n;
			await logTx(await vault.withdraw(halfAssets, me, me), "withdraw");

			expect((await vault.balanceOf(me)) < sharesBefore).toBe(true);
			expect(
				(await vault.assetBalance(me)) >= usdcBefore + halfAssets - 1n,
			).toBe(true);
		});

		test("preview functions agree with realised amounts (within rounding)", async ({
			fundedVault: { vault },
		}) => {
			const previewShares = await vault.previewDeposit(DEPOSIT_AMOUNT);
			const previewAssetsForMint = await vault.previewMint(previewShares);
			expect(previewAssetsForMint >= DEPOSIT_AMOUNT).toBe(true);
		});
	},
);
