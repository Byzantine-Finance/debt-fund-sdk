import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers } from "ethers";
import {
  fullReading,
  waitHalfSecond,
  RPC_URL,
  MNEMONIC,
} from "./utils/toolbox";

// ========================================
// CONFIGURATION
// ========================================

// Example vault and adapter configuration
const VAULT_ADDRESS = "0xa1EF5e8FD67f269B07e5B0C944d513BBcd20D458";
const MORPHO_VAULT_V1 = "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738"; // Seamless USDC Vault
const MORPHO_CONTRACT = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"; // Morpho Blue Contract on Base

// Market parameters for Morpho Market V1 adapter
const MARKET_PARAMS = {
  loanToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC on Base
  collateralToken: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", // cbETH
  oracle: "0x9dd9FE4F71c73aC4B80bF72C2bfcE8e6a8b15fD4",
  irm: "0x46415998764C29aB2a25CbeA6254146D50D22687",
  lltv: "860000000000000000",
};

async function main() {
  console.log("========================================");
  console.log("Morpho Vault V1 Adapters Example");
  console.log("This example demonstrates:");
  console.log("1. Checking current adapters in a vault");
  console.log("2. Deploying Morpho Vault V1 adapters");
  console.log("3. Getting adapter IDs and information");
  console.log("========================================\n");

  try {
    // Initialize client
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);
    const userAddress = await wallet.getAddress();

    console.log(`Connected as: ${userAddress}\n`);

    // ========================================
    // 1. CHECK CURRENT VAULT STATE
    // ========================================
    console.log("🔍 Checking current vault state...");

    const adaptersLength = await client.getAdaptersLength(VAULT_ADDRESS);
    console.log(`   Current adapters in vault: ${adaptersLength}`);

    // Check if addresses are already adapters
    const isMorphoVaultAdapter = await client.isAdapter(
      "erc4626",
      MORPHO_VAULT_V1
    );
    console.log(
      `   Is ${MORPHO_VAULT_V1} a Morpho Vault V1 adapter: ${isMorphoVaultAdapter} + ${
        isMorphoVaultAdapter ? "✅" : "❌"
      }`
    );

    // ========================================
    // 2. FIND EXISTING ADAPTERS
    // ========================================
    console.log("\n🔎 Looking for existing adapters...");

    // Try to find existing Morpho Vault V1 adapter
    const existingVaultAdapter = await client.findAdapter(
      "erc4626",
      VAULT_ADDRESS,
      MORPHO_VAULT_V1
    );
    console.log(`   Existing Morpho Vault V1 adapter: ${existingVaultAdapter}`);

    if (existingVaultAdapter === ethers.ZeroAddress) {
      console.log("   ➡️  No existing adapter found, will deploy new one");
    } else {
      console.log("   ✅ Found existing adapter");
    }

    // ========================================
    // 3. DEPLOY MORPHO VAULT V1 ADAPTER (if needed)
    // ========================================
    let finalVaultAdapterAddress = existingVaultAdapter;

    if (existingVaultAdapter === ethers.ZeroAddress) {
      console.log("\n🚀 Deploying Morpho Vault V1 adapter...");

      try {
        const txDeployVaultAdapter = await client.deployAdapter(
          "erc4626",
          VAULT_ADDRESS,
          MORPHO_VAULT_V1
        );

        console.log(`   Transaction hash: ${txDeployVaultAdapter.hash}`);
        console.log("   Waiting for confirmation...");

        await waitHalfSecond();
        const receiptVaultAdapter = await txDeployVaultAdapter.wait();

        // Get the deployed adapter address from the transaction receipt
        const deployedVaultAdapterAddress =
          receiptVaultAdapter?.logs[0]?.address;
        console.log(
          `   ✅ Morpho Vault V1 adapter deployed at: ${deployedVaultAdapterAddress}`
        );

        finalVaultAdapterAddress =
          deployedVaultAdapterAddress || ethers.ZeroAddress;
      } catch (error) {
        console.log(`   ❌ Failed to deploy Vault V1 adapter: ${error}`);
        // Try to find if it was created by another transaction
        finalVaultAdapterAddress = await client.findAdapter(
          "erc4626",
          VAULT_ADDRESS,
          MORPHO_VAULT_V1
        );
      }
    } else {
      console.log("\n✅ Using existing Morpho Vault V1 adapter...");
      console.log(`   Adapter address: ${existingVaultAdapter}`);
    }

    // ========================================
    // 4. VERIFY ADAPTER
    // ========================================
    console.log("\n🔍 Verifying adapter...");

    console.log(`   Current adapter address: ${finalVaultAdapterAddress}`);

    if (
      finalVaultAdapterAddress &&
      finalVaultAdapterAddress !== ethers.ZeroAddress
    ) {
      const isValidAdapter = await client.isAdapter(
        "erc4626",
        finalVaultAdapterAddress
      );
      console.log(`   Is valid adapter: ${isValidAdapter}`);
    } else {
      console.log("   ⚠️  No valid adapter address found");
    }

    // ========================================
    // 5. GET ADAPTER IDS
    // ========================================
    console.log("\n📋 Getting adapter information...");

    if (
      finalVaultAdapterAddress &&
      finalVaultAdapterAddress !== ethers.ZeroAddress
    ) {
      try {
        // Get IDs for Vault V1 adapter
        const vaultAdapterIds = await client.getIdsAdapterERC4626(
          finalVaultAdapterAddress
        );
        console.log(`   Morpho Vault V1 adapter IDs: ${vaultAdapterIds}`);
      } catch (error) {
        console.log(`   Could not get Vault V1 adapter IDs: ${error}`);
      }
    } else {
      console.log("   ⚠️  No valid Vault V1 adapter to get IDs from");
    }

    // ========================================
    // 7. FINAL SUMMARY
    // ========================================
    console.log("\n📊 Final Summary:");
    const finalAdaptersLength = await client.getAdaptersLength(VAULT_ADDRESS);
    console.log(`   Total adapters in vault: ${finalAdaptersLength}`);

    console.log("\n✅ Morpho adapters example completed successfully!");
  } catch (error) {
    console.error("\n❌ Error in morpho adapters example:", error);
  }
}

main();
