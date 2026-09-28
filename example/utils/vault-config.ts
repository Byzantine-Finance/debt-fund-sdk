import { ethers, formatUnits } from "ethers";
import {
	type Action,
	Actions,
	type ByzantineClient,
	type TimelockFunction,
	type Vault,
} from "../../src";
import type { AllocatorSettingsConfig } from "../allocators-settings";
import type { CuratorsSettingsConfig } from "../curators-settings";
import type { OwnerSettingsConfig } from "../owners-settings";
import { buildAllocatorSetupActions } from "./allocator";
import {
	buildCuratorActions,
	buildGateActions,
	deployCuratorAdapters,
} from "./curator";
import { checkAndApproveIfNeeded } from "./depositor";
import { buildOwnerActions } from "./owner";
import { describeActions } from "./toolbox";

export interface SetupVaultConfig {
	/** Defaults to the running wallet's address. */
	owner?: string;
	/**
	 * Only used at creation. If omitted, defaults to the chain's USDC
	 * address (resolved at runtime).
	 */
	asset?: string;
	/** Only used at creation. Optional salt for deterministic vault address. */
	salt?: string;
	/**
	 * Amount to deposit, in the asset's SMALLEST UNIT (already parsed).
	 * Use `parseUnits("0.5", decimals)`, matching the asset's decimals
	 * (USDC/EURC = 6, WETH/DAI = 18). NOT `parseEther` unless the asset
	 * is 18-decimal.
	 */
	deposit_amount?: bigint;
	owner_settings?: OwnerSettingsConfig;
	curators_settings?: CuratorsSettingsConfig;
	allocator_settings?: AllocatorSettingsConfig;
	/** Reserved for a future timelock-bumping pass at the very end. */
	timelock?: Partial<Record<TimelockFunction, number>>;
}

/**
 * Apply `config` to a vault the running wallet OWNS, in ONE multicall.
 * Works right after creation and on an existing vault ("force" a config):
 * the owner can make itself curator + allocator for the duration of the
 * bundle, then hand the roles back.
 *
 * Bundle order:
 *   - temporary curator takeover, owner setup (name, symbol, sentinels, …)
 *   - curator setup (allocators, fees, recipients, addAdapter,
 *     force-deallocate penalty, caps)
 *   - deposit (multicall delegatecalls, so msg.sender is us), BEFORE the
 *     liquidity adapter so the assets stay idle and can't revert on a
 *     full underlying (e.g. `AllCapsReached()`)
 *   - allocator setup (maxRate, liquidityAdapter)
 *   - gates, AFTER the deposit: the running wallet is usually not
 *     whitelisted, so a live receive-shares gate would block it
 *   - role restoration: allocator revoke (needs curator), curator, owner
 *
 * `instant*` curator actions only go through while the relevant timelock
 * is 0. On a vault whose timelocks were bumped, those legs revert.
 *
 * With `send: false` the multicall is only simulated (eth_call from `me`).
 * Prerequisite txs (adapter deploys, asset approve) are still sent if the
 * config needs them, since the simulation can't pass without them.
 */
export async function applyVaultConfig(
	client: ByzantineClient,
	provider: ethers.Provider,
	vault: Vault,
	me: string,
	config: SetupVaultConfig,
	{ send = true }: { send?: boolean } = {},
) {
	const ownerSettings: OwnerSettingsConfig = {
		...(config.owner_settings ?? {}),
	};
	const curatorSettings: CuratorsSettingsConfig = {
		...(config.curators_settings ?? {}),
	};
	const allocatorSettings: AllocatorSettingsConfig =
		config.allocator_settings ?? {};

	const isMe = (a?: string) => a?.toLowerCase() === me.toLowerCase();

	const [currentOwner, currentCurator, meIsAllocator] = await Promise.all([
		vault.owner(),
		vault.curator(),
		vault.isAllocator(me),
	]);
	if (!isMe(currentOwner)) {
		throw new Error(
			`Access denied: ${me} is not the owner of ${vault.address} (owner: ${currentOwner}).`,
		);
	}

	const intendedOwner = config.owner ?? me;
	const intendedCurator = ownerSettings.curator ?? currentCurator;

	const hasCuratorWork =
		(curatorSettings.allocators?.length ?? 0) > 0 ||
		curatorSettings.performance_fee !== undefined ||
		curatorSettings.management_fee !== undefined ||
		curatorSettings.performance_fee_recipient !== undefined ||
		curatorSettings.management_fee_recipient !== undefined ||
		(curatorSettings.underlying_vaults?.length ?? 0) > 0 ||
		curatorSettings.gates?.receive_shares !== undefined ||
		curatorSettings.gates?.send_shares !== undefined ||
		curatorSettings.gates?.receive_assets !== undefined ||
		curatorSettings.gates?.send_assets !== undefined;
	const hasAllocatorWork =
		allocatorSettings.max_rate !== undefined ||
		allocatorSettings.setLiquidityAdapterAndData !== undefined ||
		allocatorSettings.setLiquidityAdapterFromUnderlyingVaultAndData !==
			undefined;

	// Becoming allocator is itself a curator action.
	const needsTempAllocator = hasAllocatorWork && !meIsAllocator;
	const needsCuratorRole = hasCuratorWork || needsTempAllocator;
	const needsTempCurator = needsCuratorRole && !isMe(intendedCurator);

	if (needsCuratorRole) ownerSettings.curator = me;

	const wasIntendedAllocator = curatorSettings.allocators?.some(isMe) ?? false;
	if (needsTempAllocator && !wasIntendedAllocator) {
		curatorSettings.allocators = [...(curatorSettings.allocators ?? []), me];
	}

	// Adapter deployment goes through a factory, it can't be in the multicall.
	console.log("\n🧱 Deploying adapters…");
	const adapters = await deployCuratorAdapters(client, vault, curatorSettings);

	console.log("\n📦 Building the unified action list…");
	const ownerActions = await buildOwnerActions(vault, ownerSettings);
	const curatorActions = await buildCuratorActions(
		client,
		vault,
		curatorSettings,
		adapters,
	);
	const allocatorSetupActions = await buildAllocatorSetupActions(
		client,
		vault,
		allocatorSettings,
	);
	const gateActions = await buildGateActions(vault, curatorSettings);

	const depositActions: Action[] = [];
	if (config.deposit_amount) {
		// Read the asset's actual decimals + symbol so the log matches whatever
		// the vault's asset is (USDC, EURC, WETH, …).
		const assetContract = new ethers.Contract(
			await vault.asset(),
			[
				"function decimals() view returns (uint8)",
				"function symbol() view returns (string)",
			],
			provider,
		);
		const [assetDecimals, assetSymbol] = await Promise.all([
			assetContract.decimals().then(Number),
			assetContract.symbol(),
		]);
		console.log(
			`\n💰 Bundling a ${formatUnits(config.deposit_amount, assetDecimals)} ${assetSymbol} deposit (before the gates)`,
		);
		await checkAndApproveIfNeeded(vault, config.deposit_amount, me, "deposit");
		depositActions.push(Actions.user.deposit(config.deposit_amount, me));
	}

	const restoreActions: Action[] = [];
	// Revoke BEFORE giving the curator role back: it's a curator action.
	if (needsTempAllocator && !wasIntendedAllocator) {
		restoreActions.push(Actions.curator.instantSetIsAllocator(me, false));
	}
	if (needsTempCurator) {
		restoreActions.push(Actions.owner.setCurator(intendedCurator));
	}
	// Transfer ownership LAST: anything after this would run as the new owner.
	if (!isMe(intendedOwner)) {
		restoreActions.push(Actions.owner.setOwner(intendedOwner));
	}

	const allActions = [
		...ownerActions,
		...curatorActions,
		...depositActions,
		...allocatorSetupActions,
		...gateActions,
		...restoreActions,
	];

	if (allActions.length === 0) {
		console.log("\n⏭  Nothing to configure.");
		return null;
	}

	console.log(
		`\n🚀 Bundling ${allActions.length} action(s) into ONE multicall on ${vault.address}`,
	);
	describeActions(vault, allActions);

	if (!send) {
		await new ethers.Contract(
			vault.address,
			["function multicall(bytes[])"],
			provider,
		).multicall.staticCall(allActions.flat(), { from: me });
		console.log("   ✅ simulation OK, re-run with --send to broadcast");
		return null;
	}

	const tx = await vault.multicall(allActions);
	const receipt = await tx.wait();
	console.log(
		`   ✅ tx ${tx.hash} mined in block ${receipt?.blockNumber}, gas: ${receipt?.gasUsed}`,
	);
	return receipt;
}
