import { ethers, parseUnits } from "ethers";
import { ByzantineClient } from "../src";
import { setupAllocatorsSettings } from "./utils/allocator";
import { fullReading, MNEMONIC, RPC_URL } from "./utils/toolbox";

export interface AllocatorSettingsConfig {
	/** WAD-per-second. e.g. 200 %/year ≈ 6.34e12 wei/s. */
	max_rate?: bigint;

	setLiquidityAdapterAndData?: {
		liquidityAdapter: string;
		liquidityData: string;
	};
	setLiquidityAdapterFromUnderlyingVaultAndData?: {
		underlyingVault: string;
		liquidityData: string;
	};

	allocateConfigFromUnderlyingVault?: {
		underlyingVault: string;
		amountAsset: bigint;
	}[];
	allocateConfigFromAdapter?: {
		adapter: string;
		amountAsset: bigint;
		/** Empty for ERC4626/CompoundV3, required for MorphoMarketV1. */
		data?: string;
	}[];

	deallocateConfigFromUnderlyingVault?: {
		underlyingVault: string;
		amountAsset: bigint;
	}[];
	deallocateConfigFromAdapter?: {
		adapter: string;
		amountAsset: bigint;
		data?: string;
	}[];

	forceDeallocateConfig?: {
		adapter: string;
		data?: string;
		amountAsset: bigint;
		onBehalf: string;
	};
}

// *******************************************************************
// *  Edit ALLOCATOR_SETTINGS_CONFIG below.                          *
// *  Setup-style actions (maxRate, liquidity adapter) are bundled   *
// *  into one multicall. Allocate / deallocate / forceDeallocate    *
// *  are kept as individual txs (see utils/allocator.ts).           *
// *******************************************************************

const VAULT_ADDRESS = "0xc725ca60ecb33fd8326227ce2a83f629a4be41b7";

const ALLOCATOR_SETTINGS_CONFIG: AllocatorSettingsConfig = {
	allocateConfigFromAdapter: [
		{
			adapter: "0x1046F7cdE360E224956704E8eadE564b0ccfb538",
			amountAsset: parseUnits("0.1", 6), // 0.1 USDC
		},
	],
};

async function main() {
	console.log("Start example: allocator settings");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const vault = client.vault(VAULT_ADDRESS);
	const userAddress = await wallet.getAddress();

	if (!(await vault.isAllocator(userAddress))) {
		throw new Error(
			`User ${userAddress} is not an allocator on ${VAULT_ADDRESS}`,
		);
	}

	await fullReading(client, vault, userAddress);
	await setupAllocatorsSettings(
		client,
		vault,
		userAddress,
		ALLOCATOR_SETTINGS_CONFIG,
	);
	await fullReading(client, vault, userAddress);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
