import { Actions, type Action, type Vault } from "../../src";
import type { OwnerSettingsConfig } from "../owners-settings";

/**
 * Build the list of owner-only Actions implied by `config`. Pure: doesn't
 * send any transaction. The caller bundles them into a multicall (alone or
 * combined with curator/allocator actions).
 *
 * Notes:
 * - `setOwner` is intentionally placed LAST in the action list so any
 *   subsequent actions in the same multicall still execute as the
 *   original owner.
 * - Only emits actions for fields that actually differ from current state
 *   (avoids no-op txs).
 */
export async function buildOwnerActions(
	vault: Vault,
	config: OwnerSettingsConfig,
): Promise<Action[]> {
	const actions: Action[] = [];

	if (config.shares_name) {
		const current = await vault.name();
		if (current !== config.shares_name) {
			actions.push(Actions.owner.setName(config.shares_name));
		}
	}
	if (config.shares_symbol) {
		const current = await vault.symbol();
		if (current !== config.shares_symbol) {
			actions.push(Actions.owner.setSymbol(config.shares_symbol));
		}
	}

	if (config.curator) {
		actions.push(Actions.owner.setCurator(config.curator));
	}

	if (config.sentinels?.length) {
		for (const sentinel of config.sentinels) {
			actions.push(Actions.owner.setIsSentinel(sentinel, true));
		}
	}

	// `setOwner` LAST — anything after this would run as the new owner.
	if (config.new_owner) {
		actions.push(Actions.owner.setOwner(config.new_owner));
	}

	return actions;
}

/**
 * Convenience wrapper: build + send the owner actions as a single
 * multicall. Returns the tx response (or `null` if there was nothing
 * to do).
 */
export async function setupOwnerSettings(
	vault: Vault,
	me: string,
	config: OwnerSettingsConfig,
) {
	console.log("\n || 👮 Owner settings ||");

	if ((await vault.owner()) !== me) {
		throw new Error(`Access denied: only the owner can run this. Got ${me}.`);
	}

	const actions = await buildOwnerActions(vault, config);
	if (actions.length === 0) {
		console.log("  → nothing to update");
		return null;
	}
	console.log(`  → bundling ${actions.length} action(s) into one multicall`);
	return vault.multicall(actions);
}
