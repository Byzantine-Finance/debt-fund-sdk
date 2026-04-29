/**
 * Create + configure a vault end-to-end.
 *
 * Flow:
 *   1. Deploy the vault   (factory tx)
 *   2. Deploy any missing adapters listed in the config (factory txs)
 *   3. Bundle EVERYTHING ELSE into ONE multicall on the vault:
 *        - owner setup (name, symbol, sentinels, …)
 *        - temporary curator takeover, if needed
 *        - curator setup (allocators, fees, recipients, addAdapter,
 *          force-deallocate penalty, caps)
 *        - allocator setup (maxRate, liquidityAdapter)
 *        - role restoration (curator, owner)
 *        - ownership transfer LAST
 *   4. Optional deposit (separate tx — needs ERC20 approve first)
 *   5. allocate/deallocate operations (separate txs — happen after deposit)
 *
 * If the bundled multicall is too big for a single block (gas-wise),
 * fall back to splitting it into the role-scoped helpers
 * (`setupOwnerSettings`, `setupCuratorsSettings`, etc.) which each send
 * their own multicall.
 */

import {
	ethers,
	formatUnits,
	parseEther,
	parseUnits,
	randomBytes,
} from "ethers";
import {
	type Action,
	Actions,
	ByzantineClient,
	LocalNonceManager,
	type TimelockFunction,
} from "../src";
import { NETWORKS } from "../src/constants/networks";
import type { AllocatorSettingsConfig } from "./allocators-settings";
import type { CuratorsSettingsConfig } from "./curators-settings";
import type { OwnerSettingsConfig } from "./owners-settings";
import {
	buildAllocatorSetupActions,
	runAllocatorOperations,
} from "./utils/allocator";
import { buildCuratorActions, deployCuratorAdapters } from "./utils/curator";
import { checkAndApproveIfNeeded } from "./utils/depositor";
import { buildOwnerActions } from "./utils/owner";
import {
	describeActions,
	fullReading,
	MNEMONIC,
	RPC_URL,
	waitDelay,
	waitHalfSecond,
} from "./utils/toolbox";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface SetupVaultConfig {
	/** Defaults to the running wallet's address. */
	owner?: string;
	/** If omitted, defaults to the chain's USDC address (resolved at runtime). */
	asset?: string;
	/** Optional salt for deterministic vault address. */
	salt?: string;
	/**
	 * Amount to deposit, in the asset's SMALLEST UNIT (already parsed).
	 * Use `parseUnits("0.5", decimals)` — match the asset's decimals
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

const SETUP_VAULT_CONFIG: SetupVaultConfig = {
	asset: NETWORKS[8453].EURCaddress, // EURC on Base

	deposit_amount: parseUnits("0.5", 6), // 0.5 EURC (EURC has 6 decimals)

	owner_settings: {
		shares_name: `ByzPrime EUR`,
		shares_symbol: "byzEUR",
		curator: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
		sentinels: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],
	},

	curators_settings: {
		allocators: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],

		performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
		management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
		// performance_fee: parseUnits("0.05", 18), // 5%
		// management_fee: parseUnits("0.05", 18) / 31536000n, // 5% / year

		underlying_vaults: [
			{
				address: "0x061b3aff8e21a9d194ce43cefc20a0eff122ec69", // ByzPrime EUR (byzEUR)
				type: "erc4626Merkl",
				deallocate_penalty: parseEther("0.02"),
				caps_per_id: [
					{
						relative_cap: parseUnits("1", 18), // 100%
						absolute_cap: parseUnits("500000000", 6), // 500M USDC
					},
				],
			},
		],

		gates: {
			receive_shares: "0xEb83886A9A4029F64D845d0D12E88d8db2F08f42",
			send_shares: "0x0D1F65D716651807677AAff71Fb60b446d436906",
			receive_assets: "0x0000000000000000000000000000000000000000",
			send_assets: "0xc4eF4B97Ec15DEC69Fa1F155Bf59e33636146986",
		},

		timelockFunctionsToIncrease: {
			setReceiveAssetsGate: 3 * 24 * 60 * 60, // 3 days
			setSendAssetsGate: 3 * 24 * 60 * 60, // 3 days
			setReceiveSharesGate: 3 * 24 * 60 * 60, // 3 days
			setSendSharesGate: 3 * 24 * 60 * 60, // 3 days
			addAdapter: 3 * 24 * 60 * 60, // 3 days
			removeAdapter: 3 * 24 * 60 * 60, // 3 days
		},
	},

	allocator_settings: {
		max_rate: parseUnits("15", 16) / 31536000n, // 15% / year

		setLiquidityAdapterFromUnderlyingVaultAndData: {
			underlyingVault: "0x061b3aff8e21a9d194ce43cefc20a0eff122ec69",
			liquidityData: "0x",
		},
	},
};

async function main() {
	console.log("Start example: create + configure vault");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	// Wrap with LocalNonceManager — harmless on real chains, essential
	// when running this example against a local Anvil fork (where the
	// pending pool is briefly stale right after a block mines).
	const signer = new LocalNonceManager(wallet);
	const client = new ByzantineClient(provider, signer);
	const me = await wallet.getAddress();

	const ownerSettings: OwnerSettingsConfig =
		SETUP_VAULT_CONFIG.owner_settings ?? {};
	const curatorSettings: CuratorsSettingsConfig =
		SETUP_VAULT_CONFIG.curators_settings ?? {};
	const allocatorSettings: AllocatorSettingsConfig =
		SETUP_VAULT_CONFIG.allocator_settings ?? {};

	// ----- decide whose role we need to assume -----
	const intendedOwner = SETUP_VAULT_CONFIG.owner ?? me;
	const intendedCurator = ownerSettings.curator;
	const userIsOwner = me.toLowerCase() === intendedOwner.toLowerCase();
	const userIsCurator = intendedCurator?.toLowerCase() === me.toLowerCase();

	const hasOwnerWork =
		ownerSettings.shares_name !== undefined ||
		ownerSettings.shares_symbol !== undefined ||
		(ownerSettings.sentinels?.length ?? 0) > 0 ||
		ownerSettings.curator !== undefined;
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

	const needsTempOwner = !userIsOwner && hasOwnerWork;
	const needsTempCurator = !userIsCurator && hasCuratorWork;

	// ----- 1. create the vault -----
	// Resolve the asset address: explicit config > chain's canonical USDC.
	const cfg = await client.getNetworkConfig();
	const assetAddress = SETUP_VAULT_CONFIG.asset ?? cfg.USDCaddress;

	const initialOwner = userIsOwner ? intendedOwner : me;
	console.log(
		`📨 Creating vault on ${cfg.name} (initial owner: ${initialOwner}, asset: ${assetAddress})`,
	);
	const txCreate = await client.createVault(
		initialOwner,
		assetAddress,
		SETUP_VAULT_CONFIG.salt ?? ethers.hexlify(randomBytes(32)),
	);
	console.log(`   tx: ${txCreate.hash}`);
	await txCreate.wait();
	await waitDelay(4000);
	const vault = txCreate.vault;
	console.log(`✅ Vault deployed at ${vault.address}`);

	// ----- 2. deploy any missing adapters (factory txs, can't be in vault.multicall) -----
	console.log("\n🧱 Deploying adapters…");
	const adapters = await deployCuratorAdapters(client, vault, curatorSettings);

	// ----- 3. build the unified action list -----
	console.log("\n📦 Building the unified action list…");

	// We always need ourselves as curator to run curator actions inside the
	// multicall — fold that into the owner setup if needed.
	if (needsTempCurator) {
		ownerSettings.curator = me;
	}
	// Allocator role is also controlled by the curator → flip ourselves on
	// before doing curator actions.
	const wasIntendedAllocator =
		curatorSettings.allocators?.some(
			(a) => a.toLowerCase() === me.toLowerCase(),
		) ?? false;
	if (!wasIntendedAllocator && hasCuratorWork) {
		curatorSettings.allocators = [...(curatorSettings.allocators ?? []), me];
	}

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

	const restoreActions: Action[] = [];

	// Restore the real curator (we set ourselves above only for the bundle).
	if (needsTempCurator && intendedCurator) {
		restoreActions.push(Actions.owner.setCurator(intendedCurator));
	}

	// Revoke our temporary allocator role if the intended config didn't
	// include us.
	if (!wasIntendedAllocator && hasCuratorWork) {
		restoreActions.push(Actions.curator.instantSetIsAllocator(me, false));
	}

	// Transfer ownership LAST — anything after this would run as the new owner.
	if (needsTempOwner) {
		restoreActions.push(Actions.owner.setOwner(intendedOwner));
	}

	const allActions = [
		...ownerActions,
		...curatorActions,
		...allocatorSetupActions,
		...restoreActions,
	];

	// ----- 4. fire ONE multicall -----
	if (allActions.length > 0) {
		console.log(
			`\n🚀 Bundling ${allActions.length} action(s) into ONE multicall on ${vault.address}`,
		);
		describeActions(vault, allActions);
		const tx = await vault.multicall(allActions);
		const receipt = await tx.wait();
		console.log(
			`   ✅ tx ${tx.hash} mined in block ${receipt?.blockNumber}, gas: ${receipt?.gasUsed}`,
		);
	} else {
		console.log("\n⏭  Nothing to configure.");
	}

	// ----- 5. deposit (separate tx — needs asset approve first) -----
	if (SETUP_VAULT_CONFIG.deposit_amount) {
		// Read the asset's actual decimals + symbol so the log matches whatever
		// `assetAddress` was configured (USDC, EURC, WETH, …).
		const assetContract = new ethers.Contract(
			assetAddress,
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
			`\n💰 Depositing ${formatUnits(SETUP_VAULT_CONFIG.deposit_amount, assetDecimals)} ${assetSymbol}`,
		);
		await checkAndApproveIfNeeded(
			vault,
			SETUP_VAULT_CONFIG.deposit_amount,
			me,
			"deposit",
		);
		const tx = await vault.deposit(SETUP_VAULT_CONFIG.deposit_amount, me);
		await waitHalfSecond();
		const receipt = await tx.wait();
		console.log(
			`📤 deposit tx: ${tx.hash} (block ${receipt?.blockNumber}, gas ${receipt?.gasUsed})`,
		);
	}

	// ----- 6. allocate/deallocate operations (separate txs) -----
	await runAllocatorOperations(client, vault, me, allocatorSettings);

	await fullReading(client, vault, me);

	// `intendedCurator` may have been undefined; touch it so TS doesn't whine.
	void intendedCurator;
	void ZERO_ADDRESS;
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
