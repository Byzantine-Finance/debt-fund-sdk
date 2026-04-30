import { ethers } from "ethers";
import { ByzantineClient } from "../src";
import { MNEMONIC, RPC_URL, waitHalfSecond } from "./utils/toolbox";

/**
 * Demonstrates the adapter lifecycle:
 *   1. inspect current vault adapters
 *   2. find an existing ERC4626 adapter for an underlying vault
 *   3. deploy a new one if missing
 *   4. read back the adapter's ids
 */

const VAULT_ADDRESS = "0xa1EF5e8FD67f269B07e5B0C944d513BBcd20D458";
const MORPHO_VAULT_V1 = "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738"; // Seamless USDC

async function main() {
	console.log("======================================");
	console.log("Morpho ERC4626 adapter walkthrough");
	console.log("======================================\n");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const vault = client.vault(VAULT_ADDRESS);
	const userAddress = await wallet.getAddress();
	console.log(`Connected as: ${userAddress}\n`);

	// 1. current state
	console.log("🔍 Vault state");
	console.log(`   Adapters in vault: ${await vault.adaptersLength()}`);

	// 2. find existing adapter
	console.log("\n🔎 Looking for existing adapter…");
	let adapterAddress = await client.findAdapter(
		VAULT_ADDRESS,
		MORPHO_VAULT_V1,
		{
			type: "erc4626",
		},
	);

	// 3. deploy if missing
	if (adapterAddress === ethers.ZeroAddress) {
		console.log("   ➡️  Not found — deploying a new one");
		const tx = await client.deployAdapter(
			"erc4626",
			VAULT_ADDRESS,
			MORPHO_VAULT_V1,
		);
		console.log(`   tx: ${tx.hash}`);
		await waitHalfSecond();
		await tx.wait();
		adapterAddress = tx.adapterAddress;
		console.log(`   ✅ deployed at ${adapterAddress}`);
	} else {
		console.log(`   ✅ Found at ${adapterAddress}`);
	}

	// 4. read back
	console.log("\n📋 Adapter info");
	console.log(
		`   isAdapter (erc4626): ${await client.isAdapter("erc4626", adapterAddress)}`,
	);
	console.log(`   ids: ${await client.getIdsERC4626(adapterAddress)}`);
	console.log(
		`   underlying: ${await client.getUnderlyingERC4626(adapterAddress)}`,
	);

	console.log("\n✅ Done.");
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
