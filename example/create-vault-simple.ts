import { ethers, randomBytes } from "ethers";
import { ByzantineClient } from "../src";
import { fullReading, MNEMONIC, RPC_URL } from "./utils/toolbox";

/**
 * Minimal example: create a vault with the calling wallet as the owner.
 * The salt is randomized so each run produces a fresh vault address.
 */
const SETUP_VAULT_CONFIG = {
	asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
};

async function main() {
	console.log("Start example: create vault (minimal)");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const userAddress = await wallet.getAddress();

	const tx = await client.createVault(
		userAddress,
		SETUP_VAULT_CONFIG.asset,
		ethers.hexlify(randomBytes(32)),
	);
	console.log(`Vault creation tx: ${tx.hash}`);
	await tx.wait();
	console.log(`✅ Vault deployed at ${tx.vaultAddress}`);

	// `tx.vault` is a ready-to-use Vault instance — handy for chained config.
	await fullReading(client, tx.vault, userAddress);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
