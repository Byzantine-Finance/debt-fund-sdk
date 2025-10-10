import { ByzantineClient } from "../../src/clients/ByzantineClient";
import { AllocatorSettingsConfig } from "../allocators-settings";
import { waitHalfSecond } from "./toolbox";
import { fullReading } from "./toolbox";

export async function setupAllocatorsSettings(
  client: ByzantineClient,
  vaultAddress: string,
  userAddress: string,
  allocatorsSettings: AllocatorSettingsConfig
) {
  console.log("\n\n || 🧾 Setting allocators settings ||");

  try {
    if (allocatorsSettings.max_rate) {
      console.log(
        `  - Setting max rate to ${allocatorsSettings.max_rate} -> ${Math.round(
          (Number(allocatorsSettings.max_rate) / 1e16) * 31536000
        )}% / year`
      ); // 100% = 1e18, max 200%/year -> 200e16/31_536_000 = 6.3493150684931506e12
      const tx = await client.setMaxRate(
        vaultAddress,
        allocatorsSettings.max_rate
      );
      await tx.wait();
      await waitHalfSecond();
    }

    const liqAdapterAndData = allocatorsSettings.setLiquidityAdapterAndData;
    const liqAdapterAndDataFromUnderlyingVault =
      allocatorsSettings.setLiquidityAdapterFromUnderlyingVaultAndData;
    if (liqAdapterAndData) {
      const newLiquidityAdapter = liqAdapterAndData?.liquidityAdapter;
      const newLiquidityData = liqAdapterAndData?.liquidityData;

      if (newLiquidityAdapter && newLiquidityData !== undefined) {
        console.log(`\n--- Setting Liquidity Adapter and Data ---`);
        console.log(`New liquidity adapter: ${newLiquidityAdapter}`);
        console.log(`New liquidity data: ${newLiquidityData}`);

        const tx = await client.setLiquidityAdapterAndData(
          vaultAddress,
          newLiquidityAdapter,
          newLiquidityData
        );
        await tx.wait();
        await waitHalfSecond();
        console.log(`Liquidity adapter and data updated successfully`);
      }
    }

    if (liqAdapterAndDataFromUnderlyingVault) {
      const newLiquidityAdapter = await client.findAdapter(
        vaultAddress,
        liqAdapterAndDataFromUnderlyingVault?.underlyingVault
      );
      const newLiquidityData =
        liqAdapterAndDataFromUnderlyingVault?.liquidityData;

      if (newLiquidityAdapter && newLiquidityData !== undefined) {
        console.log(`\n--- Setting Liquidity Adapter and Data ---`);
        console.log(`New liquidity adapter: ${newLiquidityAdapter}`);
        console.log(`New liquidity data: ${newLiquidityData}`);

        const tx = await client.setLiquidityAdapterAndData(
          vaultAddress,
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
      allocatorsSettings.allocateConfigFromUnderlyingVault;
    if (allocateConfigFromUnderlyingVault) {
      for (const allocateConfig of allocateConfigFromUnderlyingVault) {
        console.log(`\n--- Allocating Assets from Underlying Vault ---`);
        console.log(`Underlying Vault: ${allocateConfig.underlyingVault}`);
        console.log(`Amount Asset: ${allocateConfig.amountAsset} wei`);

        const adapter = await client.findAdapter(
          vaultAddress,
          allocateConfig.underlyingVault
        );
        console.log(`Found adapter: ${adapter}`);

        const tx = await client.allocate(
          vaultAddress,
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
      allocatorsSettings.allocateConfigFromAdapter;
    if (allocateConfigFromAdapter) {
      for (const allocateConfig of allocateConfigFromAdapter) {
        console.log(`\n--- Allocating Assets from Adapter ---`);
        console.log(`Adapter: ${allocateConfig.adapter}`);

        const tx = await client.allocate(
          vaultAddress,
          allocateConfig.adapter,
          allocateConfig.data || "0x",
          allocateConfig.amountAsset
        );
        await tx.wait();
        await waitHalfSecond();
        console.log(`Assets allocated successfully`);
      }
    }

    if (allocateConfigFromUnderlyingVault || allocateConfigFromAdapter) {
      await fullReading(client, vaultAddress, userAddress);
    }

    // ****************
    // Deallocate assets
    // ****************

    const deallocateConfigFromUnderlyingVault =
      allocatorsSettings.deallocateConfigFromUnderlyingVault;
    if (deallocateConfigFromUnderlyingVault) {
      for (const deallocateConfig of deallocateConfigFromUnderlyingVault) {
        console.log(`\n--- Deallocating Assets from Underlying Vault ---`);
        console.log(`Underlying Vault: ${deallocateConfig.underlyingVault}`);
        console.log(`Amount Asset: ${deallocateConfig.amountAsset} wei`);

        const adapter = await client.findAdapter(
          vaultAddress,
          deallocateConfig.underlyingVault
        );
        console.log(`Found adapter: ${adapter}`);

        const tx = await client.deallocate(
          vaultAddress,
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
      allocatorsSettings.deallocateConfigFromAdapter;
    if (deallocateConfigFromAdapter) {
      for (const deallocateConfig of deallocateConfigFromAdapter) {
        console.log(`\n--- Deallocating Assets from Adapter ---`);
        console.log(`Adapter: ${deallocateConfig.adapter}`);
        console.log(`Amount Asset: ${deallocateConfig.amountAsset} wei`);

        const tx = await client.deallocate(
          vaultAddress,
          deallocateConfig.adapter,
          deallocateConfig.data || "0x",
          deallocateConfig.amountAsset
        );
        await tx.wait();
        await waitHalfSecond();
        console.log(`Assets deallocated successfully`);
      }
    }

    if (deallocateConfigFromUnderlyingVault || deallocateConfigFromAdapter) {
      await fullReading(client, vaultAddress, userAddress);
    }

    // ****************
    // Force deallocate assets (emergency function)
    // ****************

    const forceDeallocateConfig = allocatorsSettings.forceDeallocateConfig;
    if (forceDeallocateConfig) {
      console.log(`\n--- Force Deallocating Assets (Emergency) ---`);
      console.log(`Adapter: ${forceDeallocateConfig.adapter}`);
      console.log(`Data: ${forceDeallocateConfig.data}`);
      console.log(`Amount Asset: ${forceDeallocateConfig.amountAsset} wei`);
      console.log(`On behalf of: ${forceDeallocateConfig.onBehalf}`);

      const tx = await client.deallocate(
        vaultAddress,
        forceDeallocateConfig.adapter,
        forceDeallocateConfig.data || "0x",
        forceDeallocateConfig.amountAsset
      );
      await tx.wait();
      await waitHalfSecond();
      console.log(`Assets force deallocated successfully`);
    }
  } catch (error) {
    console.error("Error setting allocators settings of a vault:", error);
  }
}
