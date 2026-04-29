import {
	type Action,
	Actions,
	type ByzantineClient,
	idData,
	type Vault,
} from "../../src";
import type { CuratorsSettingsConfig } from "../curators-settings";
import { waitHalfSecond } from "./toolbox";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Pre-deploy any missing adapters listed in `config.underlying_vaults` and
 * return a map `underlying → adapter address`. Adapter deployment goes
 * through a separate factory contract, so it cannot be inside the vault's
 * multicall — that's why this is a distinct phase.
 *
 * Returns the mapping for `buildCuratorActions` to consume.
 */
export async function deployCuratorAdapters(
	client: ByzantineClient,
	vault: Vault,
	config: CuratorsSettingsConfig,
): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	if (!config.underlying_vaults?.length) return map;

	for (const u of config.underlying_vaults) {
		let adapterAddress: string | undefined;
		try {
			adapterAddress = await client.findAdapter(vault.address, u.address, {
				type: u.type,
				cometRewards: u.comet_rewards,
			});
		} catch {
			/* not found — fall through to deploy */
		}

		if (!adapterAddress || adapterAddress === ZERO_ADDRESS) {
			console.log(`  - deploying adapter for ${u.address} (${u.type})`);
			const tx = await client.deployAdapter(
				u.type,
				vault.address,
				u.address,
				u.comet_rewards,
			);
			await tx.wait();
			await waitHalfSecond();
			adapterAddress = tx.adapterAddress;
		}
		map.set(u.address, adapterAddress);
	}
	return map;
}

/**
 * Build the curator-side Action list (allocators, fees, recipients,
 * addAdapter, force-deallocate penalties, cap up/down) for a multicall.
 *
 * `adaptersByUnderlying` must be supplied by `deployCuratorAdapters` — we
 * only know what to addAdapter / cap once the adapter addresses exist.
 *
 * Pure: no transactions are sent.
 *
 * Order rules respected:
 *   - fee recipients are pushed BEFORE fee values (contract requires
 *     `recipient != 0` before `fee != 0`).
 *   - if you ever extend this to bundle `instantIncreaseTimelock` /
 *     `instantDecreaseTimelock`, push them LAST — putting them before any
 *     `instant*` for the same selector would make that `instant*`'s
 *     execute leg revert (`executableAt > block.timestamp`).
 */
export async function buildCuratorActions(
	client: ByzantineClient,
	vault: Vault,
	config: CuratorsSettingsConfig,
	adaptersByUnderlying: Map<string, string>,
): Promise<Action[]> {
	const actions: Action[] = [];

	// ----- ALLOCATORS -----
	if (config.allocators?.length) {
		for (const allocator of config.allocators) {
			if (await vault.isAllocator(allocator)) continue;
			actions.push(Actions.curator.instantSetIsAllocator(allocator, true));
		}
	}

	// ----- FEES (recipients FIRST, then values — contract requires it) -----
	if (config.performance_fee_recipient) {
		actions.push(
			Actions.curator.instantSetPerformanceFeeRecipient(
				config.performance_fee_recipient,
			),
		);
	}
	if (config.management_fee_recipient) {
		actions.push(
			Actions.curator.instantSetManagementFeeRecipient(
				config.management_fee_recipient,
			),
		);
	}
	if (config.performance_fee !== undefined) {
		actions.push(
			Actions.curator.instantSetPerformanceFee(config.performance_fee),
		);
	}
	if (config.management_fee !== undefined) {
		actions.push(
			Actions.curator.instantSetManagementFee(config.management_fee),
		);
	}

	// ----- GATES (transfer / deposit / withdraw filters) -----
	// Each setX*Gate is timelocked, so `instantX` only works while the
	// corresponding timelock is still 0 (typically right after vault
	// creation). Skip emit when the desired value already matches on-chain.
	if (config.gates) {
		const g = config.gates;
		if (g.receive_shares !== undefined) {
			const current = await vault.receiveSharesGate();
			if (current.toLowerCase() !== g.receive_shares.toLowerCase()) {
				actions.push(Actions.curator.instantSetReceiveSharesGate(g.receive_shares));
			}
		}
		if (g.send_shares !== undefined) {
			const current = await vault.sendSharesGate();
			if (current.toLowerCase() !== g.send_shares.toLowerCase()) {
				actions.push(Actions.curator.instantSetSendSharesGate(g.send_shares));
			}
		}
		if (g.receive_assets !== undefined) {
			const current = await vault.receiveAssetsGate();
			if (current.toLowerCase() !== g.receive_assets.toLowerCase()) {
				actions.push(Actions.curator.instantSetReceiveAssetsGate(g.receive_assets));
			}
		}
		if (g.send_assets !== undefined) {
			const current = await vault.sendAssetsGate();
			if (current.toLowerCase() !== g.send_assets.toLowerCase()) {
				actions.push(Actions.curator.instantSetSendAssetsGate(g.send_assets));
			}
		}
	}

	// ----- ADAPTERS (already deployed) -----
	if (config.underlying_vaults?.length) {
		for (const u of config.underlying_vaults) {
			const adapter = adaptersByUnderlying.get(u.address);
			if (!adapter) continue; // shouldn't happen if deployCuratorAdapters ran

			if (!(await vault.isAdapter(adapter))) {
				actions.push(Actions.curator.instantAddAdapter(adapter));
			}

			if (u.deallocate_penalty !== undefined) {
				actions.push(
					Actions.curator.instantSetForceDeallocatePenalty(
						adapter,
						u.deallocate_penalty,
					),
				);
			}

			if (u.caps_per_id?.length) {
				for (const cap of u.caps_per_id) {
					const idForCap =
						cap.id ?? (await defaultIdForAdapter(client, adapter, u.type));
					const idDataBlob = idData("this", adapter);

					if (cap.relative_cap !== undefined) {
						const current = await vault.relativeCap(idForCap);
						actions.push(
							current <= cap.relative_cap
								? Actions.curator.instantIncreaseRelativeCap(
										idDataBlob,
										cap.relative_cap,
									)
								: Actions.curator.decreaseRelativeCap(
										idDataBlob,
										cap.relative_cap,
									),
						);
					}
					if (cap.absolute_cap !== undefined) {
						const current = await vault.absoluteCap(idForCap);
						actions.push(
							current <= cap.absolute_cap
								? Actions.curator.instantIncreaseAbsoluteCap(
										idDataBlob,
										cap.absolute_cap,
									)
								: Actions.curator.decreaseAbsoluteCap(
										idDataBlob,
										cap.absolute_cap,
									),
						);
					}
				}
			}
		}
	}

	return actions;
}

/**
 * Convenience wrapper: deploy missing adapters, then send all curator
 * actions as a single multicall. Returns the multicall tx response (or
 * `null` if there was nothing to do).
 *
 * Use `deployCuratorAdapters` + `buildCuratorActions` directly if you
 * want to fold curator actions into a larger multicall (alongside owner
 * and allocator actions).
 */
export async function setupCuratorsSettings(
	client: ByzantineClient,
	vault: Vault,
	me: string,
	config: CuratorsSettingsConfig,
) {
	console.log("\n || 🧑‍🍳 Curator settings ||");

	if ((await vault.curator()) !== me) {
		throw new Error(`Access denied: only the curator can run this. Got ${me}.`);
	}

	const adapters = await deployCuratorAdapters(client, vault, config);
	const actions = await buildCuratorActions(client, vault, config, adapters);

	if (actions.length === 0) {
		console.log("  → nothing to update");
		return null;
	}
	console.log(`  → bundling ${actions.length} action(s) into one multicall`);
	return vault.multicall(actions);
}

/**
 * Default id used by cap helpers when the user didn't provide one.
 * Single-id adapters return their lone id from `ids()`; Morpho Market V1
 * exposes many ids and the user must specify which one to cap.
 */
async function defaultIdForAdapter(
	client: ByzantineClient,
	adapterAddress: string,
	type: "erc4626" | "erc4626Merkl" | "compoundV3" | "morphoMarketV1",
): Promise<string> {
	switch (type) {
		case "erc4626":
			return client.getIdsERC4626(adapterAddress);
		case "erc4626Merkl":
			return client.getIdsERC4626Merkl(adapterAddress);
		case "compoundV3":
			return client.getIdsCompoundV3(adapterAddress);
		case "morphoMarketV1":
			throw new Error(
				"Morpho Market V1 adapters expose multiple ids — pass `cap.id` explicitly.",
			);
	}
}
