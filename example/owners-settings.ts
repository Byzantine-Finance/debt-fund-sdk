import { ethers } from "ethers";
import { ByzantineClient } from "../src";
import { fullReading, MNEMONIC, RPC_URL } from "./utils/toolbox";
import { setupOwnerSettings } from "./utils/owner";

export interface OwnerSettingsConfig {
	shares_name?: string;
	shares_symbol?: string;
	curator?: string;
	sentinels?: string[];
	/** Will replace you as the owner — runs *last* and as a separate tx. */
	new_owner?: string;
}

// *******************************************************************
// *  Edit OWNER_SETTINGS_CONFIG below to control which fields update *
// *  All non-undefined fields are bundled into a single multicall.   *
// *******************************************************************

const VAULT_ADDRESS = "0x7CEC59FFde9434bD1e68F3527da2Ed6aA840FA73";

const OWNER_SETTINGS_CONFIG: OwnerSettingsConfig = {
	shares_name: "Byzantine Prime USD",
	shares_symbol: "bpUSD",
	curator: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
	sentinels: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],
	// new_owner: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
};

async function main() {
	console.log("Start example: owner settings");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const vault = client.vault(VAULT_ADDRESS);
	const userAddress = await wallet.getAddress();

	await setupOwnerSettings(vault, userAddress, OWNER_SETTINGS_CONFIG);
	await fullReading(client, vault, userAddress);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
