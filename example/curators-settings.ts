import { ethers, parseEther, parseUnits } from "ethers";
import { ByzantineClient, type TimelockFunction } from "../src";
import { setupCuratorsSettings } from "./utils/curator";
import { fullReading, MNEMONIC, RPC_URL } from "./utils/toolbox";

interface BaseVaultConfig {
	/** Address of the underlying vault or market. */
	address: string;
	/** Force-deallocate penalty (WAD; max 2 % == 0.02e18). */
	deallocate_penalty?: bigint;

	caps_per_id?: {
		/** If omitted, the adapter's default id is used. */
		id?: string;
		/** WAD; max 1e18 == 100 %. */
		relative_cap?: bigint;
		/** Asset units (e.g. 200 USDC == 200e6). */
		absolute_cap?: bigint;
	}[];
}

interface NonCompoundV3VaultConfig extends BaseVaultConfig {
	type: "erc4626" | "erc4626Merkl" | "morphoMarketV1";
	comet_rewards?: string;
}

interface CompoundV3VaultConfig extends BaseVaultConfig {
	type: "compoundV3";
	/** Required for Compound V3 adapters. */
	comet_rewards: string;
}

type VaultConfig = NonCompoundV3VaultConfig | CompoundV3VaultConfig;

export interface CuratorsSettingsConfig {
	allocators?: string[];
	performance_fee?: bigint;
	management_fee?: bigint;
	performance_fee_recipient?: string;
	management_fee_recipient?: string;
	underlying_vaults?: VaultConfig[];
	timelockFunctionsToIncrease?: Partial<Record<TimelockFunction, number>>;
	/**
	 * Optional gate addresses (transfer/deposit/withdraw filters). Pass
	 * `0x000…000` to disable a previously-set gate. Omit to leave as-is.
	 */
	gates?: {
		receive_shares?: string;
		send_shares?: string;
		receive_assets?: string;
		send_assets?: string;
	};
}

// *******************************************************************
// *  Edit CURATORS_SETTINGS_CONFIG below.                           *
// *  All compatible curator actions are bundled into ONE multicall  *
// *  transaction at the end (see utils/curator.ts).                 *
// *******************************************************************

const VAULT_ADDRESS = "0x7CEC59FFde9434bD1e68F3527da2Ed6aA840FA73";

const CURATORS_SETTINGS_CONFIG: CuratorsSettingsConfig = {
	allocators: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],

	performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
	management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
	performance_fee: parseUnits("0.03", 18), // 3 %
	management_fee: parseUnits("0", 18) / 31_536_000n, // 0 %/year per second

	underlying_vaults: [
		{
			address: "0xb125E6687d4313864e53df431d5425969c15Eb2F", // Compound on Base
			comet_rewards: "0x123964802e6ABabBE1Bc9547D72Ef1B69B00A6b1",
			type: "compoundV3",
			deallocate_penalty: parseEther("0.01"),
			caps_per_id: [
				{
					relative_cap: parseUnits("1", 18), // 100 %
					absolute_cap: parseUnits("200", 6), // 200 USDC
				},
			],
		},
	],
};

async function main() {
	console.log("Start example: curator settings (one multicall)");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const vault = client.vault(VAULT_ADDRESS);
	const userAddress = await wallet.getAddress();

	await setupCuratorsSettings(client, vault, userAddress, CURATORS_SETTINGS_CONFIG);
	await fullReading(client, vault, userAddress);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
