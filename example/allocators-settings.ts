import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, parseEther, parseUnits } from "ethers";
import {
  fullReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
} from "./utils/toolbox";
import { getIdData } from "../src/clients/curators/Cap";
import { setupAllocatorsSettings } from "./utils";

export interface AllocatorSettingsConfig {
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
    data?: string; // Uncessary for AdapterVaultV1 (empty data), is required for AdapterMarketV1
  }[];
  deallocateConfigFromUnderlyingVault?: {
    underlyingVault: string;
    amountAsset: bigint;
  }[];
  deallocateConfigFromAdapter?: {
    adapter: string;
    amountAsset: bigint;
    data?: string; // Uncessary for AdapterVaultV1 (empty data), is required for AdapterMarketV1
  }[];
  forceDeallocateConfig?: {
    adapter: string;
    data?: string; // Uncessary for AdapterVaultV1 (empty data), is required for AdapterMarketV1
    amountAsset: bigint;
    onBehalf: string; // Only for AdapterMarketV1
  };
}

//*******************************************************************
//*  This is what you need to change to configure allocator settings *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const VAULT_ADDRESS = "0x76870462853d83bA0c7F5b7c4db6f71156da71FE";

const ALLOCATOR_SETTINGS_CONFIG: AllocatorSettingsConfig = {
  // setLiquidityAdapterAndData: {
  //   liquidityAdapter: "0xDA0455494f0E82E440312D0538558Ae236649345",
  //   liquidityData: "0x", // Empty data, adjust as needed
  // },
  allocateConfigFromUnderlyingVault: [
    {
      underlyingVault: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738",
      amountAsset: parseUnits("0.1", 6), // 0.1 USDC
    },
  ],
  // allocateConfigFromAdapter: [
  //   {
  //     adapter: "0x5a83a5c10C4d6c4EAbB4E2B5add5B2C5997f150D",
  //     amountAsset: parseUnits("0.1", 6), // 0.1 USDC
  //     data: "0x", // Empty data because it's a AdapterVaultV1
  //   },
  // ],
  // deallocateConfigFromUnderlyingVault: [
  //   {
  //     underlyingVault: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738",
  //     amountAsset: parseUnits("0.1", 6), // 0.1 USDC
  //   },
  // ],
  // deallocateConfigFromAdapter: [
  //   {
  //     adapter: "0xDA0455494f0E82E440312D0538558Ae236649345",
  //     amountAsset: parseUnits("0.1", 6), // 0.1 USDC
  //     data: "0x", // Empty data because it's a AdapterVaultV1
  //   },
  // ],

  // Uncomment if you want to force deallocate (emergency function)
  //   forceDeallocateConfig: {
  //     adapter: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  //     data: "0x",
  //     amountAsset: parseEther("1"), // 1 ETH
  //     onBehalf: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  //   },
};

async function main() {
  console.log("Start example to set curator settings of a vault");
  try {
    // ****************
    // Setup the test
    // ****************
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    // Check if user is an allocator
    await client.instantSetIsAllocator(VAULT_ADDRESS, userAddress, true);
    await waitHalfSecond();
    const isAllocator = await client.isAllocator(VAULT_ADDRESS, userAddress);
    if (!isAllocator) {
      console.log("Access denied: only allocators can proceed here.");
      throw new Error("Access denied: only allocators can proceed here.");
    }

    await fullReading(client, VAULT_ADDRESS, userAddress);

    await setupAllocatorsSettings(
      client,
      VAULT_ADDRESS,
      userAddress,
      ALLOCATOR_SETTINGS_CONFIG
    );

    await fullReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error setting curator settings of a vault:", error);
  } finally {
  }
}

main();
