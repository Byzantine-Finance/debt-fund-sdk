import { ethers, keccak256, parseUnits } from "ethers";
import { Actions, ByzantineClient, idData } from "../src";
import { MNEMONIC, RPC_URL } from "./utils/toolbox";

/**
 * Set both the relative and absolute cap for a single adapter id, in
 * one multicall transaction.
 *
 * `id` here is the adapter address — the helper builds the `idData` blob
 * (the keccak256 of which is the per-id key inside the vault).
 */

const VAULT_ADDRESS = "0x9F940434cABB9d8c1b9C9a4A042a846c093A85e7";
const CAPS_CONFIG = {
	adapter: "0x6feb657053c1e6004f89bb249621bde61a42536e87fdcdf6e5cc01e5f867ff8b",
	relativeCap: parseUnits("0.32", 18), // 32 %
	absoluteCap: parseUnits("300", 6), // 300 USDC
};

async function main() {
	console.log("Start example: set adapter caps");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const vault = client.vault(VAULT_ADDRESS);

	const idDataBlob = idData("this", CAPS_CONFIG.adapter);
	const adapterId = keccak256(idDataBlob);

	console.log(`idData:    ${idDataBlob}`);
	console.log(`adapterId: ${adapterId}`);

	// Bundle both cap updates into a single tx.
	const tx = await vault.multicall([
		Actions.curator.instantIncreaseRelativeCap(
			idDataBlob,
			CAPS_CONFIG.relativeCap,
		),
		Actions.curator.instantIncreaseAbsoluteCap(
			idDataBlob,
			CAPS_CONFIG.absoluteCap,
		),
	]);
	console.log(`tx: ${tx.hash}`);
	await tx.wait();

	console.log(`relativeCap: ${await vault.relativeCap(adapterId)}`);
	console.log(`absoluteCap: ${await vault.absoluteCap(adapterId)}`);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
