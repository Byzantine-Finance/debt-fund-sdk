/**
 * Force a config on a vault that ALREADY exists, in one multicall.
 *
 * Takes the same `SetupVaultConfig` as `create-vault.ts`. The running
 * wallet must be the vault's owner: it makes itself curator (and
 * allocator when needed) for the duration of the bundle, applies the
 * config, then hands the roles back. `asset` and `salt` are ignored.
 * By default it re-applies `setup-vault-config.ts`, the config
 * `create-vault.ts` uses.
 *
 * `instant*` curator actions (caps, gates, adapters, …) only go through
 * while the relevant timelock is 0. The multicall is simulated first and
 * only sent with `--send`.
 */

import { ethers } from "ethers";
import { ByzantineClient, LocalNonceManager } from "../src";
import { SETUP_VAULT_CONFIG } from "./setup-vault-config";
import { fullReading, MNEMONIC, RPC_URL } from "./utils/toolbox";
import { applyVaultConfig, type SetupVaultConfig } from "./utils/vault-config";

// Vault created by `create-vault.ts` whose config multicall reverted.
const VAULT_ADDRESS = "0xd3BE84784C738fBD8Ec494fEb9c7dd71499A4a62";

// Same config as `create-vault.ts`. Spread + override to force only part of
// it, e.g. `{ allocator_settings: { setLiquidityAdapterAndData: { liquidityAdapter: ZeroAddress, liquidityData: "0x" } } }`.
const FORCE_CONFIG: SetupVaultConfig = { ...SETUP_VAULT_CONFIG };

async function main() {
	const send = process.argv.includes("--send");
	console.log(
		`Start example: force config on ${VAULT_ADDRESS}${send ? "" : " (dry run)"}`,
	);

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const signer = new LocalNonceManager(wallet);
	const client = new ByzantineClient(provider, signer);
	const me = await wallet.getAddress();
	const vault = client.vault(VAULT_ADDRESS);

	await applyVaultConfig(client, provider, vault, me, FORCE_CONFIG, { send });

	if (send) await fullReading(client, vault, me);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
