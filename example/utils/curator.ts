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
 * Apply curator-side configuration to a vault in a single `multicall` tx.
 *
 * The previous version of this helper sent up to ~15 sequential txs (one
 * per `instantX` call). Now we collect every change as an `Action`, then
 * fire one transaction:
 *
 *   - allocators (setIsAllocator)
 *   - fee recipients + fees
 *   - per-adapter:
 *       - addAdapter
 *       - setForceDeallocatePenalty
 *       - increase relative + absolute caps (or decrease if shrinking)
 *
 * Adapter creation (`deployAdapter`) cannot be batched — adapter
 * factories are separate contracts, not the vault itself. Those are
 * still done one-by-one before the multicall.
 */
export async function setupCuratorsSettings(
	client: ByzantineClient,
	vault: Vault,
	userAddress: string,
	config: CuratorsSettingsConfig,
): Promise<void> {
	console.log("\n || 🧑‍🍳 Setting curator settings ||");

	const curator = await vault.curator();
	if (curator !== userAddress) {
		throw new Error(
			`Access denied: only the curator can run this. Got ${curator}, expected ${userAddress}.`,
		);
	}

	const calls: Action[] = [];

	// ----- ALLOCATORS -----
	if (config.allocators?.length) {
		for (const allocator of config.allocators) {
			if (await vault.isAllocator(allocator)) {
				console.log(`  - allocator ${allocator} already set, skipping`);
				continue;
			}
			calls.push(Actions.curator.instantSetIsAllocator(allocator, true));
			console.log(`  - + instantSetIsAllocator(${allocator})`);
		}
	}

	// ----- FEES (recipients FIRST, then fee values) -----
	// Reason: the contract requires `recipient != 0` before `fee != 0`.
	if (config.performance_fee_recipient) {
		calls.push(
			Actions.curator.instantSetPerformanceFeeRecipient(config.performance_fee_recipient),
		);
		console.log(`  - + perf fee recipient = ${config.performance_fee_recipient}`);
	}
	if (config.management_fee_recipient) {
		calls.push(
			Actions.curator.instantSetManagementFeeRecipient(config.management_fee_recipient),
		);
		console.log(`  - + mgmt fee recipient = ${config.management_fee_recipient}`);
	}
	if (config.performance_fee !== undefined) {
		calls.push(Actions.curator.instantSetPerformanceFee(config.performance_fee));
		console.log(`  - + perf fee = ${config.performance_fee}`);
	}
	if (config.management_fee !== undefined) {
		calls.push(Actions.curator.instantSetManagementFee(config.management_fee));
		console.log(`  - + mgmt fee = ${config.management_fee}`);
	}

	// ----- ADAPTERS (deploy first — separate txs — then bundle the rest) -----
	const adapterByUnderlying = new Map<string, string>();

	if (config.underlying_vaults?.length) {
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
			adapterByUnderlying.set(u.address, adapterAddress);

			// addAdapter — bundle into multicall
			if (!(await vault.isAdapter(adapterAddress))) {
				calls.push(Actions.curator.instantAddAdapter(adapterAddress));
				console.log(`  - + addAdapter(${adapterAddress})`);
			}

			// force-deallocate penalty
			if (u.deallocate_penalty !== undefined) {
				calls.push(
					Actions.curator.instantSetForceDeallocatePenalty(
						adapterAddress,
						u.deallocate_penalty,
					),
				);
				console.log(`  - + forceDeallocatePenalty(${adapterAddress}, ${u.deallocate_penalty})`);
			}

			// caps — read current to decide between increase/decrease
			if (u.caps_per_id?.length) {
				for (const cap of u.caps_per_id) {
					const idForCap =
						cap.id ?? (await defaultIdForAdapter(client, adapterAddress, u.type));
					const idDataBlob = idData("this", adapterAddress);

					if (cap.relative_cap !== undefined) {
						const current = await vault.relativeCap(idForCap);
						if (current <= cap.relative_cap) {
							calls.push(
								Actions.curator.instantIncreaseRelativeCap(idDataBlob, cap.relative_cap),
							);
							console.log(`  - + increaseRelativeCap → ${cap.relative_cap}`);
						} else {
							calls.push(Actions.curator.decreaseRelativeCap(idDataBlob, cap.relative_cap));
							console.log(`  - + decreaseRelativeCap → ${cap.relative_cap}`);
						}
					}
					if (cap.absolute_cap !== undefined) {
						const current = await vault.absoluteCap(idForCap);
						if (current <= cap.absolute_cap) {
							calls.push(
								Actions.curator.instantIncreaseAbsoluteCap(idDataBlob, cap.absolute_cap),
							);
							console.log(`  - + increaseAbsoluteCap → ${cap.absolute_cap}`);
						} else {
							calls.push(Actions.curator.decreaseAbsoluteCap(idDataBlob, cap.absolute_cap));
							console.log(`  - + decreaseAbsoluteCap → ${cap.absolute_cap}`);
						}
					}
				}
			}
		}
	}

	// ----- FIRE THE BUNDLE -----
	if (calls.length === 0) {
		console.log("  → nothing to update");
		return;
	}
	console.log(`\n  🚀 Bundling ${calls.length} curator action(s) into ONE multicall tx`);
	const tx = await vault.multicall(calls);
	const receipt = await tx.wait();
	console.log(`  ✅ tx ${tx.hash} (gas ${receipt?.gasUsed})`);
}

/**
 * Default id used by cap helpers when the user didn't provide one.
 * For single-id adapters (erc4626, erc4626Merkl, compoundV3) this is the
 * adapter's only id. For Morpho Market V1 the user must specify the id
 * explicitly (we don't auto-pick a market).
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
