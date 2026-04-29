/**
 * Integration-write: the v2 flagship feature.
 *
 * Configures a vault end-to-end (owner + curator + allocator + adapter +
 * caps + liquidity + maxRate) in a SINGLE multicall transaction.
 *
 * The test is self-contained: it deploys a *second* vault on the fly to
 * use as the adapter's underlying ERC4626 — no external `TEST_UNDERLYING_VAULT`
 * needed, since Vault V2 itself is ERC4626-compliant.
 */

import { ethers, keccak256, randomBytes } from "ethers";
import { expect } from "vitest";
import { Actions, idData, parseAnnualRate, parsePercent } from "../../src";
import { hasRpcAndSigner } from "../_helpers";
import { logTx, test } from "../_test";

const NAME = `Byzantine Test ${Date.now()}`;
const SYMBOL = "BYZTST";
const PERFORMANCE_FEE = parsePercent("5"); // 5 %
const MANAGEMENT_FEE = parseAnnualRate("1"); // 1 %/year (per-second WAD)
const ABSOLUTE_CAP = 1_000_000_000n; // 1000 USDC at 6 decimals
const RELATIVE_CAP = parsePercent("100"); // 100 %
const MAX_RATE = parseAnnualRate("200"); // 200 %/year cap

test.skipIf(!hasRpcAndSigner())(
	"bundles owner + curator + allocator config in ONE tx",
	async ({ freshVault: { vault, client, me } }) => {
		// Deploy a second vault on the fly — its ERC4626 surface makes it a
		// valid underlying for an `erc4626` adapter on the parent vault.
		const cfg = await client.getNetworkConfig();
		const child = await client.createVault(
			me,
			cfg.USDCaddress,
			ethers.hexlify(randomBytes(32)),
		);
		await logTx(child, "createVault (child)");

		// Now wire an erc4626 adapter on `vault` (parent) pointing at `child`.
		const deploy = await client.deployAdapter(
			"erc4626",
			vault.address,
			child.vaultAddress,
		);
		await logTx(deploy, "deployAdapter(erc4626, parent → child)");
		const adapter = deploy.adapterAddress;

		// One multicall — all owner / curator / allocator setup at once.
		const tx = await vault.multicall([
			Actions.owner.setName(NAME),
			Actions.owner.setSymbol(SYMBOL),
			Actions.owner.setIsSentinel(me, true),
			// `me` is owner — make myself curator so the curator-only actions
			// below can run within the same multicall.
			Actions.owner.setCurator(me),
			Actions.curator.instantSetIsAllocator(me, true),
			Actions.curator.instantSetPerformanceFeeRecipient(me),
			Actions.curator.instantSetManagementFeeRecipient(me),
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
			Actions.allocator.setLiquidityAdapterAndData(adapter, "0x"),
			Actions.allocator.setMaxRate(MAX_RATE),
		]);
		const receipt = await logTx(tx, "multicall (full setup bundle)");
		expect(receipt?.status).toBe(1);

		// ----- read back every field -----
		expect(await vault.name()).toBe(NAME);
		expect(await vault.symbol()).toBe(SYMBOL);
		expect(await vault.isSentinel(me)).toBe(true);
		expect(await vault.isAllocator(me)).toBe(true);
		expect(await vault.performanceFeeRecipient()).toBe(me);
		expect(await vault.managementFeeRecipient()).toBe(me);
		expect(await vault.performanceFee()).toBe(PERFORMANCE_FEE);
		expect(await vault.managementFee()).toBe(MANAGEMENT_FEE);
		expect(await vault.isAdapter(adapter)).toBe(true);
		expect(await vault.adaptersLength()).toBe(1n);
		expect(await vault.adapter(0)).toBe(adapter);
		expect(await vault.liquidityAdapter()).toBe(adapter);
		expect(await vault.liquidityData()).toBe("0x");
		expect(await vault.maxRate()).toBe(MAX_RATE);

		// The vault keys cap storage by `keccak256(idData)`. Compute it
		// locally rather than relying on the adapter's `ids()` view, which
		// returns different shapes across adapter versions.
		const adapterId = keccak256(idData("this", adapter));
		expect(await vault.absoluteCap(adapterId)).toBe(ABSOLUTE_CAP);
		expect(await vault.relativeCap(adapterId)).toBe(RELATIVE_CAP);
	},
);
