/**
 * Integration-write: the v2 flagship feature.
 *
 * Creates a fresh vault and configures it end-to-end (owner, curator,
 * allocator, fees, adapter, caps, liquidity, maxRate) in a SINGLE
 * `multicall` transaction. Verifies the resulting state.
 *
 * Requires `TEST_UNDERLYING_VAULT` to point at a real ERC4626 vault.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
	Actions,
	idData,
	parseAnnualRate,
	parsePercent,
	type Vault,
} from "../../src";
import {
	hasTestUnderlying,
	TEST_UNDERLYING_VAULT,
} from "../_helpers";
import { type FreshVaultContext, setupWithFreshVault } from "../_setup";

const NAME = `Byzantine Test ${Date.now()}`;
const SYMBOL = "BYZTST";
const PERFORMANCE_FEE = parsePercent("5"); // 5 %
const MANAGEMENT_FEE = parseAnnualRate("1"); // 1 %/year (per-second WAD)
const ABSOLUTE_CAP = 1_000_000_000n; // 1000 USDC at 6 decimals
const RELATIVE_CAP = parsePercent("100"); // 100 %
const MAX_RATE = parseAnnualRate("200"); // 200 %/year cap

describe.skipIf(!hasTestUnderlying())(
	"integration-write · multicall bundle",
	() => {
		let ctx: FreshVaultContext;
		let vault: Vault;
		let adapter: string;

		beforeAll(async () => {
			ctx = await setupWithFreshVault();
			vault = ctx.vault;

			const deploy = await ctx.client.deployAdapter(
				"erc4626",
				vault.address,
				TEST_UNDERLYING_VAULT,
			);
			await deploy.wait();
			adapter = deploy.adapterAddress;
		});

		it("bundles owner + curator + allocator config in ONE tx", async () => {
			const tx = await vault.multicall([
				// owner
				Actions.owner.setName(NAME),
				Actions.owner.setSymbol(SYMBOL),
				Actions.owner.setIsSentinel(ctx.me, true),

				// curator (instant — timelocks are 0 on a fresh vault)
				Actions.curator.instantSetIsAllocator(ctx.me, true),
				Actions.curator.instantSetPerformanceFeeRecipient(ctx.me),
				Actions.curator.instantSetManagementFeeRecipient(ctx.me),
				Actions.curator.instantSetPerformanceFee(PERFORMANCE_FEE),
				Actions.curator.instantSetManagementFee(MANAGEMENT_FEE),
				Actions.curator.instantAddAdapter(adapter),
				Actions.curator.instantIncreaseAbsoluteCap(
					idData("this", adapter),
					ABSOLUTE_CAP,
				),
				Actions.curator.instantIncreaseRelativeCap(
					idData("this", adapter),
					RELATIVE_CAP,
				),

				// allocator
				Actions.allocator.setLiquidityAdapterAndData(adapter, "0x"),
				Actions.allocator.setMaxRate(MAX_RATE),
			]);
			const receipt = await tx.wait();
			expect(receipt?.status).toBe(1);

			// ----- read back every field -----
			expect(await vault.name()).toBe(NAME);
			expect(await vault.symbol()).toBe(SYMBOL);
			expect(await vault.isSentinel(ctx.me)).toBe(true);
			expect(await vault.isAllocator(ctx.me)).toBe(true);
			expect(await vault.performanceFeeRecipient()).toBe(ctx.me);
			expect(await vault.managementFeeRecipient()).toBe(ctx.me);
			expect(await vault.performanceFee()).toBe(PERFORMANCE_FEE);
			expect(await vault.managementFee()).toBe(MANAGEMENT_FEE);
			expect(await vault.isAdapter(adapter)).toBe(true);
			expect(await vault.adaptersLength()).toBe(1n);
			expect(await vault.adapter(0)).toBe(adapter);
			expect(await vault.liquidityAdapter()).toBe(adapter);
			expect(await vault.liquidityData()).toBe("0x");
			expect(await vault.maxRate()).toBe(MAX_RATE);

			const adapterId = await ctx.client.getIdsERC4626(adapter);
			expect(await vault.absoluteCap(adapterId)).toBe(ABSOLUTE_CAP);
			expect(await vault.relativeCap(adapterId)).toBe(RELATIVE_CAP);
		});
	},
);
