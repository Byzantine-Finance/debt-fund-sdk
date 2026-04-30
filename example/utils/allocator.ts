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
 * Build the allocator-side **setup** Actions (maxRate, liquidityAdapter).
 * These can be bundled into the same multicall as owner/curator actions.
 *
 * `allocate` / `deallocate` / `forceDeallocate` are NOT included here —
 * they are post-setup operations and have separate helpers below. They
 * also typically require deposits to have happened first.
 */
export async function buildAllocatorSetupActions(
	client: ByzantineClient,
	vault: Vault,
	config: AllocatorSettingsConfig,
): Promise<Action[]> {
	const actions: Action[] = [];

	if (config.max_rate !== undefined) {
		actions.push(Actions.allocator.setMaxRate(config.max_rate));
	}

	if (config.setLiquidityAdapterAndData) {
		actions.push(
			Actions.allocator.setLiquidityAdapterAndData(
				config.setLiquidityAdapterAndData.liquidityAdapter,
				config.setLiquidityAdapterAndData.liquidityData,
			),
		);
	} else if (config.setLiquidityAdapterFromUnderlyingVaultAndData) {
		const cfg = config.setLiquidityAdapterFromUnderlyingVaultAndData;
		const adapter = await client.findAdapter(
			vault.address,
			cfg.underlyingVault,
		);
		actions.push(
			Actions.allocator.setLiquidityAdapterAndData(adapter, cfg.liquidityData),
		);
	}

	return actions;
}

/**
 * Run the allocate / deallocate / forceDeallocate calls described by
 * `config`. These are sent as separate transactions because they
 * typically run AFTER the vault has been funded.
 */
export async function runAllocatorOperations(
	client: ByzantineClient,
	vault: Vault,
	me: string,
	config: AllocatorSettingsConfig,
): Promise<void> {
	if (config.allocateConfigFromUnderlyingVault) {
		for (const a of config.allocateConfigFromUnderlyingVault) {
			const adapter = await client.findAdapter(
				vault.address,
				a.underlyingVault,
			);
			console.log(`\n  📤 allocate ${a.amountAsset} via adapter ${adapter}`);
			await (await vault.allocate(adapter, "0x", a.amountAsset)).wait();
		}
	}
	if (config.allocateConfigFromAdapter) {
		for (const a of config.allocateConfigFromAdapter) {
			console.log(`\n  📤 allocate ${a.amountAsset} via adapter ${a.adapter}`);
			await (
				await vault.allocate(a.adapter, a.data || "0x", a.amountAsset)
			).wait();
		}
	}
	if (
		config.allocateConfigFromUnderlyingVault ||
		config.allocateConfigFromAdapter
	) {
		await fullReading(client, vault, me);
	}

	if (config.deallocateConfigFromUnderlyingVault) {
		for (const d of config.deallocateConfigFromUnderlyingVault) {
			const adapter = await client.findAdapter(
				vault.address,
				d.underlyingVault,
			);
			console.log(`\n  📥 deallocate ${d.amountAsset} via adapter ${adapter}`);
			await (await vault.deallocate(adapter, "0x", d.amountAsset)).wait();
		}
	}
	if (config.deallocateConfigFromAdapter) {
		for (const d of config.deallocateConfigFromAdapter) {
			console.log(
				`\n  📥 deallocate ${d.amountAsset} via adapter ${d.adapter}`,
			);
			await (
				await vault.deallocate(d.adapter, d.data || "0x", d.amountAsset)
			).wait();
		}
	}
	if (
		config.deallocateConfigFromUnderlyingVault ||
		config.deallocateConfigFromAdapter
	) {
		await fullReading(client, vault, me);
	}

	if (config.forceDeallocateConfig) {
		const f = config.forceDeallocateConfig;
		console.log(`\n  🚨 forceDeallocate ${f.amountAsset} via ${f.adapter}`);
		await (
			await vault.forceDeallocate(
				f.adapter,
				f.data || "0x",
				f.amountAsset,
				f.onBehalf,
			)
		).wait();
	}
}

/**
 * Convenience wrapper: bundle setup Actions into one multicall, then
 * run allocate/deallocate in separate txs.
 */
export async function setupAllocatorsSettings(
	client: ByzantineClient,
	vault: Vault,
	me: string,
	config: AllocatorSettingsConfig,
): Promise<void> {
	console.log("\n || 🧾 Allocator settings ||");

	const setupActions = await buildAllocatorSetupActions(client, vault, config);
	if (setupActions.length > 0) {
		if (config.max_rate !== undefined) {
			console.log(
				`  - setMaxRate(${config.max_rate}) — ${formatAnnualRate(config.max_rate)} %/year`,
			);
		}
		console.log(
			`  → bundling ${setupActions.length} setup action(s) into one multicall`,
		);
		await (await vault.multicall(setupActions)).wait();
	}

	await runAllocatorOperations(client, vault, me, config);
}
