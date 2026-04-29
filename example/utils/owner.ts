import { Actions, type Vault } from "../../src";
import type { OwnerSettingsConfig } from "../owners-settings";
import { waitHalfSecond } from "./toolbox";

/**
 * Apply a batch of owner-only changes to the vault.
 *
 * All owner setters (setName, setSymbol, setCurator, setIsSentinel) are
 * non-timelocked, so we bundle every requested change into a single
 * `multicall` transaction.
 *
 * `setOwner` is intentionally executed *last* and as a separate tx — once
 * ownership transfers, the current signer can't run further multicall.
 */
export async function setupOwnerSettings(
	vault: Vault,
	userAddress: string,
	config: OwnerSettingsConfig,
): Promise<void> {
	console.log("\n || 👮 Setting owner settings ||");

	const owner = await vault.owner();
	if (owner !== userAddress) {
		throw new Error(`Access denied: only the owner can run this. Got ${owner}, expected ${userAddress}.`);
	}

	const calls = [];

	// Name + symbol — only push if value differs from current.
	if (config.shares_name) {
		const current = await vault.name();
		if (current !== config.shares_name) {
			calls.push(Actions.owner.setName(config.shares_name));
			console.log(`  - setName(${config.shares_name})`);
		}
	}
	if (config.shares_symbol) {
		const current = await vault.symbol();
		if (current !== config.shares_symbol) {
			calls.push(Actions.owner.setSymbol(config.shares_symbol));
			console.log(`  - setSymbol(${config.shares_symbol})`);
		}
	}

	if (config.curator) {
		calls.push(Actions.owner.setCurator(config.curator));
		console.log(`  - setCurator(${config.curator})`);
	}

	if (config.sentinels) {
		for (const sentinel of config.sentinels) {
			calls.push(Actions.owner.setIsSentinel(sentinel, true));
			console.log(`  - setIsSentinel(${sentinel}, true)`);
		}
	}

	if (calls.length > 0) {
		console.log(`  → bundling ${calls.length} call(s) into one multicall tx`);
		await (await vault.multicall(calls)).wait();
		await waitHalfSecond();
	} else {
		console.log("  → nothing to update");
	}

	// Owner transfer goes last — after this tx, we lose admin power.
	if (config.new_owner) {
		console.log(`  - setOwner(${config.new_owner}) — separate tx (final)`);
		await (await vault.setOwner(config.new_owner)).wait();
	}
}
