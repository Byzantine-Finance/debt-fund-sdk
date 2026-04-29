import { ethers, formatUnits, parseUnits, randomBytes } from "ethers";
import { ByzantineClient, type TimelockFunction } from "../src";
import type { AllocatorSettingsConfig } from "./allocators-settings";
import type { CuratorsSettingsConfig } from "./curators-settings";
import type { OwnerSettingsConfig } from "./owners-settings";
import { setupAllocatorsSettings } from "./utils/allocator";
import { setupCuratorsSettings } from "./utils/curator";
import { checkAndApproveIfNeeded } from "./utils/depositor";
import { setupOwnerSettings } from "./utils/owner";
import {
	fullReading,
	MNEMONIC,
	RPC_URL,
	waitDelay,
	waitHalfSecond,
} from "./utils/toolbox";

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

// *******************************************************************
// *  Edit SETUP_VAULT_CONFIG below to control the full setup.       *
// *  This script handles temporary role swaps when the running      *
// *  wallet doesn't already hold the target roles.                  *
// *******************************************************************

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
	const userAddress = await wallet.getAddress();

	const ownerSettings: OwnerSettingsConfig =
		SETUP_VAULT_CONFIG.owner_settings ?? {};
	const curatorSettings: CuratorsSettingsConfig =
		SETUP_VAULT_CONFIG.curators_settings ?? {};
	const allocatorSettings: AllocatorSettingsConfig =
		SETUP_VAULT_CONFIG.allocator_settings ?? {};

	// ----- decide whose role we need to assume -----
	const intendedOwner = SETUP_VAULT_CONFIG.owner ?? userAddress;
	const userIsOwner = userAddress.toLowerCase() === intendedOwner.toLowerCase();
	const userIsCurator =
		ownerSettings.curator?.toLowerCase() === userAddress.toLowerCase();
	const userIsAllocator =
		curatorSettings.allocators?.some(
			(a) => a.toLowerCase() === userAddress.toLowerCase(),
		) ?? false;
	const userIsSentinel =
		ownerSettings.sentinels?.some(
			(a) => a.toLowerCase() === userAddress.toLowerCase(),
		) ?? false;

	const needsToAddAdapters =
		(curatorSettings.underlying_vaults?.length ?? 0) > 0;
	const needsToCapAdapters =
		curatorSettings.underlying_vaults?.some((u) =>
			u.caps_per_id?.some((c) => c.relative_cap || c.absolute_cap),
		) ?? false;
	const hasFeeChanges =
		curatorSettings.performance_fee !== undefined ||
		curatorSettings.management_fee !== undefined ||
		curatorSettings.performance_fee_recipient !== undefined ||
		curatorSettings.management_fee_recipient !== undefined;

	const needsTempAllocator = !userIsAllocator && needsToCapAdapters;
	const needsTempCurator =
		!userIsCurator &&
		(needsTempAllocator || needsToAddAdapters || hasFeeChanges);
	const needsTempOwner =
		!userIsOwner &&
		(needsTempCurator ||
			ownerSettings.shares_name !== undefined ||
			ownerSettings.shares_symbol !== undefined ||
			ownerSettings.curator !== undefined ||
			ownerSettings.sentinels !== undefined ||
			ownerSettings.new_owner !== undefined);

	// ----- create the vault -----
	const initialOwner = userIsOwner ? intendedOwner : userAddress;
	console.log(`📨 Creating vault (initial owner: ${initialOwner})`);
	const txCreate = await client.createVault(
		initialOwner,
		SETUP_VAULT_CONFIG.asset,
		SETUP_VAULT_CONFIG.salt ?? ethers.hexlify(randomBytes(32)),
	);
	console.log(`Vault creation tx: ${txCreate.hash}`);
	await txCreate.wait();
	await waitDelay(4000);

	const vault = txCreate.vault;
	console.log(`✅ Vault deployed at ${vault.address}`);

	if (!userIsOwner && needsTempOwner) {
		// We deployed as `userAddress`; transfer to the intended owner at the very end.
		ownerSettings.new_owner = intendedOwner;
	}
	if (needsTempCurator || userIsCurator) {
		ownerSettings.curator = userAddress;
	}
	if (needsTempAllocator || userIsAllocator) {
		curatorSettings.allocators = [userAddress];
	}

	// ----- run the role-scoped setup helpers -----
	await setupOwnerSettings(vault, userAddress, ownerSettings);

	if (SETUP_VAULT_CONFIG.deposit_amount) {
		console.log(
			`\n💰 Depositing ${formatUnits(SETUP_VAULT_CONFIG.deposit_amount, 6)} USDC`,
		);
		await checkAndApproveIfNeeded(
			vault,
			SETUP_VAULT_CONFIG.deposit_amount,
			userAddress,
			"deposit",
		);
		const tx = await vault.deposit(
			SETUP_VAULT_CONFIG.deposit_amount,
			userAddress,
		);
		await waitHalfSecond();
		const receipt = await tx.wait();
		console.log(
			`📤 deposit tx: ${tx.hash} (block ${receipt?.blockNumber}, gas ${receipt?.gasUsed})`,
		);
	}

	await setupCuratorsSettings(client, vault, userAddress, curatorSettings);
	await setupAllocatorsSettings(client, vault, userAddress, allocatorSettings);

	// ----- restore original roles -----
	console.log("\n || 👷 Restoring original roles ||");
	if (needsTempAllocator) {
		console.log("  - revoking temporary allocator role");
		await (await vault.instantSetIsAllocator(userAddress, false)).wait();
		await waitHalfSecond();
	}
	if (!userIsSentinel && ownerSettings.sentinels?.length) {
		console.log("  - revoking temporary sentinel role");
		await (await vault.setIsSentinel(userAddress, false)).wait();
		await waitHalfSecond();
	}
	if (needsTempCurator) {
		const target =
			ownerSettings.curator ?? "0x0000000000000000000000000000000000000000";
		console.log(`  - restoring curator to ${target}`);
		await (await vault.setCurator(target)).wait();
		await waitHalfSecond();
	}
	if (needsTempOwner) {
		console.log(`  - transferring ownership to ${intendedOwner}`);
		await (await vault.setOwner(intendedOwner)).wait();
	}

	await fullReading(client, vault, userAddress);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
