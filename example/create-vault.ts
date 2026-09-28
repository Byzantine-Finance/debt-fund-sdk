/**
 * Create + configure a vault end-to-end.
 *
 * Flow:
 *   1. Deploy the vault   (factory tx)
 *   2. `applyVaultConfig` (see example/utils/vault-config.ts): deploy any
 *      missing adapters, approve the bootstrap deposit, then bundle
 *      EVERYTHING ELSE into ONE multicall on the vault
 *   3. allocate/deallocate operations (separate txs, after the deposit)
 *
 * To force the same kind of config on a vault that already exists, use
 * `force-config.ts`.
 *
 * If the bundled multicall is too big for a single block (gas-wise),
 * fall back to splitting it into the role-scoped helpers
 * (`setupOwnerSettings`, `setupCuratorsSettings`, etc.) which each send
 * their own multicall.
 */

import { ethers, randomBytes } from "ethers";
import { ByzantineClient, LocalNonceManager } from "../src";
import { SETUP_VAULT_CONFIG } from "./setup-vault-config";
import { runAllocatorOperations } from "./utils/allocator";
import { fullReading, MNEMONIC, RPC_URL, waitDelay } from "./utils/toolbox";
import { applyVaultConfig } from "./utils/vault-config";

async function main() {
	console.log("Start example: create + configure vault");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	// Wrap with LocalNonceManager: harmless on real chains, essential
	// when running this example against a local Anvil fork (where the
	// pending pool is briefly stale right after a block mines).
	const signer = new LocalNonceManager(wallet);
	const client = new ByzantineClient(provider, signer);
	const me = await wallet.getAddress();

	// ----- 1. create the vault (we own it; `applyVaultConfig` transfers
	// ownership at the end if `owner` is someone else) -----
	const cfg = await client.getNetworkConfig();
	const assetAddress = SETUP_VAULT_CONFIG.asset ?? cfg.USDCaddress;

	console.log(
		`📨 Creating vault on ${cfg.name} (initial owner: ${me}, asset: ${assetAddress})`,
	);
	const txCreate = await client.createVault(
		me,
		assetAddress,
		SETUP_VAULT_CONFIG.salt ?? ethers.hexlify(randomBytes(32)),
	);
	console.log(`   tx: ${txCreate.hash}`);
	await txCreate.wait();
	await waitDelay(4000);
	const vault = txCreate.vault;
	console.log(`✅ Vault deployed at ${vault.address}`);

	// ----- 2. configure + bootstrap deposit, in one multicall -----
	await applyVaultConfig(client, provider, vault, me, SETUP_VAULT_CONFIG);

	// ----- 3. allocate/deallocate operations (separate txs) -----
	await runAllocatorOperations(
		client,
		vault,
		me,
		SETUP_VAULT_CONFIG.allocator_settings ?? {},
	);

	await fullReading(client, vault, me);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
