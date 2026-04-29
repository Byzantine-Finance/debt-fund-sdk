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

import { ethers, formatUnits, parseUnits, randomBytes } from "ethers";
import {
	type Action,
	Actions,
	ByzantineClient,
	type TimelockFunction,
} from "../src";
import type { AllocatorSettingsConfig } from "./allocators-settings";
import type { CuratorsSettingsConfig } from "./curators-settings";
import type { OwnerSettingsConfig } from "./owners-settings";
import { buildAllocatorSetupActions, runAllocatorOperations } from "./utils/allocator";
import { buildCuratorActions, deployCuratorAdapters } from "./utils/curator";
import { checkAndApproveIfNeeded } from "./utils/depositor";
import { buildOwnerActions } from "./utils/owner";
import {
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
	asset: string;
	/** Optional salt for deterministic vault address. */
	salt?: string;
	deposit_amount?: bigint;
	owner_settings?: OwnerSettingsConfig;
	curators_settings?: CuratorsSettingsConfig;
	allocator_settings?: AllocatorSettingsConfig;
	/** Reserved for a future timelock-bumping pass at the very end. */
	timelock?: Partial<Record<TimelockFunction, number>>;
}

const SETUP_VAULT_CONFIG: SetupVaultConfig = {
	asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base

	deposit_amount: parseUnits("0.1", 6),

	owner_settings: {
		shares_name: "Byzantine Prime USD",
		shares_symbol: "bpUSD",
		curator: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
		sentinels: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],
	},

	curators_settings: {
		allocators: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],
	},
};

async function main() {
	console.log("Start example: create + configure vault");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const me = await wallet.getAddress();

	const ownerSettings: OwnerSettingsConfig = SETUP_VAULT_CONFIG.owner_settings ?? {};
	const curatorSettings: CuratorsSettingsConfig =
		SETUP_VAULT_CONFIG.curators_settings ?? {};
	const allocatorSettings: AllocatorSettingsConfig =
		SETUP_VAULT_CONFIG.allocator_settings ?? {};

	// ----- decide whose role we need to assume -----
	const intendedOwner = SETUP_VAULT_CONFIG.owner ?? me;
	const intendedCurator = ownerSettings.curator;
	const userIsOwner = me.toLowerCase() === intendedOwner.toLowerCase();
	const userIsCurator =
		intendedCurator?.toLowerCase() === me.toLowerCase();

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
		(curatorSettings.underlying_vaults?.length ?? 0) > 0;

	const needsTempOwner = !userIsOwner && hasOwnerWork;
	const needsTempCurator = !userIsCurator && hasCuratorWork;

	// ----- 1. create the vault -----
	const initialOwner = userIsOwner ? intendedOwner : me;
	console.log(`📨 Creating vault (initial owner: ${initialOwner})`);
	const txCreate = await client.createVault(
		initialOwner,
		SETUP_VAULT_CONFIG.asset,
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
		curatorSettings.allocators?.some((a) => a.toLowerCase() === me.toLowerCase()) ??
		false;
	if (!wasIntendedAllocator && hasCuratorWork) {
		curatorSettings.allocators = [...(curatorSettings.allocators ?? []), me];
	}

	const ownerActions = await buildOwnerActions(vault, ownerSettings);
	const curatorActions = await buildCuratorActions(client, vault, curatorSettings, adapters);
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
		console.log(
			`\n💰 Depositing ${formatUnits(SETUP_VAULT_CONFIG.deposit_amount, 6)} USDC`,
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
