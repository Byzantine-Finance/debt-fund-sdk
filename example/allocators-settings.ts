import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, parseEther, parseUnits } from "ethers";
import {
  finalReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
} from "./utils-example";
import { getIdData } from "../src/clients/curators/Cap";

interface AllocatorSettingsConfig {
  setLiquidityAdapterAndData?: {
    liquidityAdapter: string;
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

const VAULT_ADDRESS = "0x169FdF43910Eca52f4F97D361A44D26e71B18134";

const ALLOCATOR_SETTINGS_CONFIG: AllocatorSettingsConfig = {
  setLiquidityAdapterAndData: {
    liquidityAdapter: "0x9925F74a9386C5c437d83065DA1f6D5c23a5545b",
    liquidityData: "0x", // Empty data, adjust as needed
  },
  //   allocateConfigFromUnderlyingVault: [
  //     {
  //       underlyingVault: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738",
  //       amountAsset: parseUnits("0.1", 6), // 0.1 USDC
  //     },
  //   ],
  //   allocateConfigFromAdapter: [
  //     {
  //       adapter: "0x9925F74a9386C5c437d83065DA1f6D5c23a5545b",
  //       amountAsset: parseUnits("0.1", 6), // 0.1 USDC
  //       data: "0x", // Empty data because it's a AdapterVaultV1
  //     },
  //   ],
  //   deallocateConfigFromUnderlyingVault: [
  //     {
  //       underlyingVault: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738",
  //       amountAsset: parseUnits("0.1", 6), // 0.1 USDC
  //     },
  //   ],
  //   deallocateConfigFromAdapter: [
  //     {
  //       adapter: "0x9925F74a9386C5c437d83065DA1f6D5c23a5545b",
  //       amountAsset: parseUnits("0.1", 6), // 0.1 USDC
  //       data: "0x", // Empty data because it's a AdapterVaultV1
  //     },
  //   ],

  // Uncomment if you want to force deallocate (emergency function)
  //   forceDeallocateConfig: {
  //     adapter: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  //     data: "0x",
  //     amountAsset: parseEther("1"), // 1 ETH
  //     onBehalf: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  //   },
};

async function main() {
  console.log("Start example to configure allocator settings of a vault");

  try {
    // ****************
    // Setup the test
    // ****************

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    // Check if user is an allocator
    const isAllocator = await client.isAllocator(VAULT_ADDRESS, userAddress);
    if (!isAllocator) {
      console.log("Access denied: only allocators can proceed here.");
      throw new Error("Access denied: only allocators can proceed here.");
    }

    console.log(`User ${userAddress} is an allocator`);

    // ****************
    // Read current settings
    // ****************

    await finalReading(client, VAULT_ADDRESS, userAddress);

    // ****************
    // Configure liquidity adapter and data
    // ****************

    if (ALLOCATOR_SETTINGS_CONFIG.setLiquidityAdapterAndData) {
      const newLiquidityAdapter =
        ALLOCATOR_SETTINGS_CONFIG.setLiquidityAdapterAndData?.liquidityAdapter;
      const newLiquidityData =
        ALLOCATOR_SETTINGS_CONFIG.setLiquidityAdapterAndData?.liquidityData;

      if (newLiquidityAdapter && newLiquidityData !== undefined) {
        console.log(`\n--- Setting Liquidity Adapter and Data ---`);
        console.log(`New liquidity adapter: ${newLiquidityAdapter}`);
        console.log(`New liquidity data: ${newLiquidityData}`);

        const tx = await client.setLiquidityAdapterAndData(
          VAULT_ADDRESS,
          newLiquidityAdapter,
          newLiquidityData
        );
        await tx.wait();
        await waitHalfSecond();
        console.log(`Liquidity adapter and data updated successfully`);
      }
    }

    // ****************
    // Allocate assets
    // ****************

    const allocateConfigFromUnderlyingVault =
      ALLOCATOR_SETTINGS_CONFIG.allocateConfigFromUnderlyingVault;
    if (allocateConfigFromUnderlyingVault) {
      for (const allocateConfig of allocateConfigFromUnderlyingVault) {
        console.log(`\n--- Allocating Assets from Underlying Vault ---`);
        console.log(`Underlying Vault: ${allocateConfig.underlyingVault}`);
        console.log(`Amount Asset: ${allocateConfig.amountAsset} wei`);

        const adapter = await client.findAdapter(
          "morphoVaultV1",
          VAULT_ADDRESS,
          allocateConfig.underlyingVault
        );
        console.log(`Found adapter: ${adapter}`);

        const tx = await client.allocate(
          VAULT_ADDRESS,
          adapter,
          "0x",
          allocateConfig.amountAsset
        );
        await tx.wait();
        await waitHalfSecond();
        console.log(`Assets allocated successfully`);
      }
    }

    // ****************

    const allocateConfigFromAdapter =
      ALLOCATOR_SETTINGS_CONFIG.allocateConfigFromAdapter;
    if (allocateConfigFromAdapter) {
      for (const allocateConfig of allocateConfigFromAdapter) {
        console.log(`\n--- Allocating Assets from Adapter ---`);
        console.log(`Adapter: ${allocateConfig.adapter}`);

        const tx = await client.allocate(
          VAULT_ADDRESS,
          allocateConfig.adapter,
          allocateConfig.data || "0x",
          allocateConfig.amountAsset
        );
        await tx.wait();
        await waitHalfSecond();
        console.log(`Assets allocated successfully`);
      }
    }

    await finalReading(client, VAULT_ADDRESS, userAddress);

    // ****************
    // Deallocate assets
    // ****************

    const deallocateConfigFromUnderlyingVault =
      ALLOCATOR_SETTINGS_CONFIG.deallocateConfigFromUnderlyingVault;
    if (deallocateConfigFromUnderlyingVault) {
      for (const deallocateConfig of deallocateConfigFromUnderlyingVault) {
        console.log(`\n--- Deallocating Assets from Underlying Vault ---`);
        console.log(`Underlying Vault: ${deallocateConfig.underlyingVault}`);
        console.log(`Amount Asset: ${deallocateConfig.amountAsset} wei`);

        const adapter = await client.findAdapter(
          "morphoVaultV1",
          VAULT_ADDRESS,
          deallocateConfig.underlyingVault
        );
        console.log(`Found adapter: ${adapter}`);

        const tx = await client.deallocate(
          VAULT_ADDRESS,
          adapter,
          "0x",
          deallocateConfig.amountAsset
        );
        await tx.wait();
        await waitHalfSecond();
        console.log(`Assets deallocated successfully`);
      }
    }

    const deallocateConfigFromAdapter =
      ALLOCATOR_SETTINGS_CONFIG.deallocateConfigFromAdapter;
    if (deallocateConfigFromAdapter) {
      for (const deallocateConfig of deallocateConfigFromAdapter) {
        console.log(`\n--- Deallocating Assets from Adapter ---`);
        console.log(`Adapter: ${deallocateConfig.adapter}`);
        console.log(`Amount Asset: ${deallocateConfig.amountAsset} wei`);

        const tx = await client.deallocate(
          VAULT_ADDRESS,
          deallocateConfig.adapter,
          deallocateConfig.data || "0x",
          deallocateConfig.amountAsset
        );
        await tx.wait();
        await waitHalfSecond();
        console.log(`Assets deallocated successfully`);
      }
    }
    await finalReading(client, VAULT_ADDRESS, userAddress);

    // ****************
    // Force deallocate assets (emergency function)
    // ****************

    const forceDeallocateConfig =
      ALLOCATOR_SETTINGS_CONFIG.forceDeallocateConfig;
    if (forceDeallocateConfig) {
      console.log(`\n--- Force Deallocating Assets (Emergency) ---`);
      console.log(`Adapter: ${forceDeallocateConfig.adapter}`);
      console.log(`Data: ${forceDeallocateConfig.data}`);
      console.log(`Amount Asset: ${forceDeallocateConfig.amountAsset} wei`);
      console.log(`On behalf of: ${forceDeallocateConfig.onBehalf}`);

      const tx = await client.deallocate(
        VAULT_ADDRESS,
        forceDeallocateConfig.adapter,
        forceDeallocateConfig.data || "0x",
        forceDeallocateConfig.amountAsset
      );
      await tx.wait();
      await waitHalfSecond();
      console.log(`Assets force deallocated successfully`);
    }

    await finalReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error configuring allocator settings of a vault:", error);
  }
}

main();
