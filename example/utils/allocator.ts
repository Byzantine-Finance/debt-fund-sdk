import {
	type Action,
	Actions,
	type ByzantineClient,
	formatAnnualRate,
	type Vault,
} from "../../src";
import type { AllocatorSettingsConfig } from "../allocators-settings";
import { fullReading } from "./toolbox";

/**
 * Apply allocator-side configuration:
 *   - maxRate
 *   - liquidity adapter + data
 *   - allocate / deallocate calls (per adapter or per underlying vault)
 *   - force-deallocate (emergency)
 *
 * Setup-style operations (maxRate, liquidity adapter) are bundled into
 * one multicall. Allocate/deallocate are kept as separate txs since
 * users typically want to inspect intermediate state.
 */
export async function setupAllocatorsSettings(
	client: ByzantineClient,
	vault: Vault,
	userAddress: string,
	config: AllocatorSettingsConfig,
): Promise<void> {
	console.log("\n || 🧾 Setting allocator settings ||");

	// ---- bundle the configuration changes ----
	const setupCalls: Action[] = [];

	if (config.max_rate !== undefined) {
		setupCalls.push(Actions.allocator.setMaxRate(config.max_rate));
		console.log(
			`  - + setMaxRate(${config.max_rate}) — ${formatAnnualRate(config.max_rate)} %/year`,
		);
	}

	if (config.setLiquidityAdapterAndData) {
		setupCalls.push(
			Actions.allocator.setLiquidityAdapterAndData(
				config.setLiquidityAdapterAndData.liquidityAdapter,
				config.setLiquidityAdapterAndData.liquidityData,
			),
		);
		console.log(
			`  - + setLiquidityAdapterAndData(${config.setLiquidityAdapterAndData.liquidityAdapter})`,
		);
	} else if (config.setLiquidityAdapterFromUnderlyingVaultAndData) {
		const cfg = config.setLiquidityAdapterFromUnderlyingVaultAndData;
		const adapter = await client.findAdapter(vault.address, cfg.underlyingVault);
		setupCalls.push(
			Actions.allocator.setLiquidityAdapterAndData(adapter, cfg.liquidityData),
		);
		console.log(
			`  - + setLiquidityAdapterAndData(${adapter}) — resolved from ${cfg.underlyingVault}`,
		);
	}

	if (setupCalls.length > 0) {
		console.log(`  → bundling ${setupCalls.length} setup call(s) into one multicall tx`);
		await (await vault.multicall(setupCalls)).wait();
	}

	// ---- allocate (separate txs) ----
	if (config.allocateConfigFromUnderlyingVault) {
		for (const a of config.allocateConfigFromUnderlyingVault) {
			const adapter = await client.findAdapter(vault.address, a.underlyingVault);
			console.log(`\n  📤 allocate ${a.amountAsset} via adapter ${adapter}`);
			await (await vault.allocate(adapter, "0x", a.amountAsset)).wait();
		}
	}
	if (config.allocateConfigFromAdapter) {
		for (const a of config.allocateConfigFromAdapter) {
			console.log(`\n  📤 allocate ${a.amountAsset} via adapter ${a.adapter}`);
			await (await vault.allocate(a.adapter, a.data || "0x", a.amountAsset)).wait();
		}
	}
	if (config.allocateConfigFromUnderlyingVault || config.allocateConfigFromAdapter) {
		await fullReading(client, vault, userAddress);
	}

	// ---- deallocate (separate txs) ----
	if (config.deallocateConfigFromUnderlyingVault) {
		for (const d of config.deallocateConfigFromUnderlyingVault) {
			const adapter = await client.findAdapter(vault.address, d.underlyingVault);
			console.log(`\n  📥 deallocate ${d.amountAsset} via adapter ${adapter}`);
			await (await vault.deallocate(adapter, "0x", d.amountAsset)).wait();
		}
	}
	if (config.deallocateConfigFromAdapter) {
		for (const d of config.deallocateConfigFromAdapter) {
			console.log(`\n  📥 deallocate ${d.amountAsset} via adapter ${d.adapter}`);
			await (await vault.deallocate(d.adapter, d.data || "0x", d.amountAsset)).wait();
		}
	}
	if (config.deallocateConfigFromUnderlyingVault || config.deallocateConfigFromAdapter) {
		await fullReading(client, vault, userAddress);
	}

	// ---- force deallocate (emergency) ----
	if (config.forceDeallocateConfig) {
		const f = config.forceDeallocateConfig;
		console.log(`\n  🚨 forceDeallocate ${f.amountAsset} via ${f.adapter}`);
		await (
			await vault.forceDeallocate(f.adapter, f.data || "0x", f.amountAsset, f.onBehalf)
		).wait();
	}
}
