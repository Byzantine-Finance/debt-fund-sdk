/**
 * MetaVault Data Reading Test
 *
 * This test demonstrates how to retrieve and display various data from MetaVaults
 * using the simplified Byzantine SDK Client. It covers a comprehensive set of vault
 * information retrieval functions without modifying vault state.
 *
 * Tests included:
 * 1. Basic Vault Information - Asset address, TVL, metadata
 * 2. Deposit Information - Preview deposits, max amounts, conversion rates
 * 3. Withdraw Information - Preview withdrawals, max amounts, balances
 * 4. Byzantine Fee Information - Factory fee settings
 * 5. User-specific Information - Balances and allowances
 */

const { ethers } = require("ethers");
const { ByzantineClient, getNetworkConfig } = require("../dist");
const {
  logTitle,
  logResult,
  assert,
  createWallet,
  getWalletBalances,
} = require("./utils");
require("dotenv").config();

// 🎯 CONFIGURE YOUR VAULT ADDRESS HERE
const VAULT_ADDRESS = "0xbd9be389743674cd1eba663067eb83d294321a33"; // Replace with actual MetaVault address

// Test suite
async function runTests() {
  console.log("\n🧪 MetaVault Data Reading Test 🧪\n");

  try {
    // Check if environment variables are set
    const { RPC_URL, MNEMONIC, PRIVATE_KEY, DEFAULT_CHAIN_ID } = process.env;
    const chainId = DEFAULT_CHAIN_ID ? parseInt(DEFAULT_CHAIN_ID) : 11155111; // Default to Sepolia

    let skipNetworkTests = false;
    if (!RPC_URL) {
      console.warn(
        "⚠️ Warning: RPC_URL not set in .env file. Network tests will be skipped."
      );
      skipNetworkTests = true;
    }

    if (!MNEMONIC && !PRIVATE_KEY) {
      console.warn(
        "⚠️ Warning: Neither MNEMONIC nor PRIVATE_KEY set in .env file. Using dummy wallet."
      );
    }

    console.log(
      `Network: ${
        chainId === 1
          ? "Ethereum Mainnet"
          : chainId === 8453
          ? "Base Mainnet"
          : chainId === 11155111
          ? "Ethereum Sepolia"
          : "Unknown"
      } (Chain ID: ${chainId})\n`
    );

    console.log(`🏦 Vault Address: ${VAULT_ADDRESS}\n`);

    if (skipNetworkTests) {
      console.log(
        "⚠️ Network tests skipped. Please provide RPC_URL to run tests."
      );
      return;
    }

    // Initialize provider and wallet using utils
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet =
      MNEMONIC || PRIVATE_KEY
        ? createWallet(provider, 0)
        : ethers.Wallet.createRandom().connect(provider);

    const userAddress = await wallet.getAddress();

    // Initialize the simplified ByzantineClient
    const client = new ByzantineClient(
      /** @type {any} */ (provider),
      /** @type {any} */ (wallet)
    );

    // Initialize vault-specific clients
    client.initializeVaultClients(VAULT_ADDRESS);

    logResult("Client initialization", true);
    console.log(`👤 User address: ${userAddress}`);

    // Get network configuration
    const networkConfig = getNetworkConfig(/** @type {any} */ (chainId));
    console.log(`🌐 Network: ${networkConfig.name}`);
    console.log(`🏭 Factory: ${networkConfig.byzantineFactoryAddress}\n`);

    // =============================================
    // 1. Basic Vault Information
    // =============================================
    logTitle("Basic Vault Information");

    try {
      // Get vault asset address
      const assetAddress = await client.asset();
      logResult("Vault asset address", true, assetAddress);

      // Get vault total assets (TVL)
      const totalAssets = await client.totalAssets();
      logResult(
        "Total assets (TVL)",
        true,
        `${ethers.formatEther(totalAssets)} tokens`
      );

      // Get total supply of shares
      const totalSupply = await client.totalSupply();
      logResult(
        "Total shares supply",
        true,
        `${ethers.formatEther(totalSupply)} shares`
      );

      // Calculate share price (assets per share)
      if (totalSupply > 0n) {
        const sharePrice = (totalAssets * ethers.parseEther("1")) / totalSupply;
        logResult(
          "Share price",
          true,
          `${ethers.formatEther(sharePrice)} assets per share`
        );
      } else {
        logResult("Share price", true, "N/A (no shares issued)");
      }
    } catch (error) {
      logResult("Basic vault info", false, `Error: ${error.message}`);
    }

    // =============================================
    // 2. Deposit Information
    // =============================================
    logTitle("Deposit Information");

    try {
      const testDepositAmount = ethers.parseEther("1.0"); // 1 token

      // Preview deposit - how many shares for 1 token
      const previewShares = await client.previewDeposit(testDepositAmount);
      logResult(
        "Preview deposit (1 token)",
        true,
        `${ethers.formatEther(previewShares)} shares`
      );

      // Preview mint - how many assets needed for 1 share
      const testShareAmount = ethers.parseEther("1.0");
      const previewAssets = await client.previewMint(testShareAmount);
      logResult(
        "Preview mint (1 share)",
        true,
        `${ethers.formatEther(previewAssets)} assets needed`
      );

      // Max deposit for user
      const maxDeposit = await client.maxDeposit(userAddress);
      if (maxDeposit === ethers.MaxUint256) {
        logResult("Max deposit", true, "Unlimited");
      } else {
        logResult(
          "Max deposit",
          true,
          `${ethers.formatEther(maxDeposit)} tokens`
        );
      }

      // Max mint for user
      const maxMint = await client.maxMint(userAddress);
      if (maxMint === ethers.MaxUint256) {
        logResult("Max mint", true, "Unlimited");
      } else {
        logResult("Max mint", true, `${ethers.formatEther(maxMint)} shares`);
      }
    } catch (error) {
      logResult("Deposit info", false, `Error: ${error.message}`);
    }

    // =============================================
    // 3. Withdraw Information
    // =============================================
    logTitle("Withdraw Information");

    try {
      const testWithdrawAmount = ethers.parseEther("1.0"); // 1 token

      // Preview withdraw - how many shares needed for 1 token
      const previewWithdrawShares = await client.previewWithdraw(
        testWithdrawAmount
      );
      logResult(
        "Preview withdraw (1 token)",
        true,
        `${ethers.formatEther(previewWithdrawShares)} shares needed`
      );

      // Preview redeem - how many assets for 1 share
      const testRedeemShares = ethers.parseEther("1.0");
      const previewRedeemAssets = await client.previewRedeem(testRedeemShares);
      logResult(
        "Preview redeem (1 share)",
        true,
        `${ethers.formatEther(previewRedeemAssets)} assets received`
      );

      // Max withdraw for user
      const maxWithdraw = await client.maxWithdraw(userAddress);
      logResult(
        "Max withdraw",
        true,
        `${ethers.formatEther(maxWithdraw)} tokens`
      );

      // Max redeem for user
      const maxRedeem = await client.maxRedeem(userAddress);
      logResult("Max redeem", true, `${ethers.formatEther(maxRedeem)} shares`);
    } catch (error) {
      logResult("Withdraw info", false, `Error: ${error.message}`);
    }

    // =============================================
    // 4. User-specific Information
    // =============================================
    logTitle("User-specific Information");

    try {
      // Get user's share balance
      const userShares = await client.balanceOf(userAddress);
      logResult(
        "User shares balance",
        true,
        `${ethers.formatEther(userShares)} shares`
      );

      // Convert user's shares to assets
      if (userShares > 0n) {
        const userAssetsValue = await client.convertToAssets(userShares);
        logResult(
          "User assets value",
          true,
          `${ethers.formatEther(userAssetsValue)} tokens`
        );
      } else {
        logResult("User assets value", true, "0 tokens (no shares)");
      }

      // Get wallet balances using utils function
      try {
        const balances = await getWalletBalances(
          provider,
          userAddress,
          networkConfig
        );
        logResult("ETH balance", true, `${balances.ETH.formatted} ETH`);
        if (networkConfig.USDCaddress) {
          // Could add USDC balance check here if needed
        }
      } catch (error) {
        logResult(
          "Wallet balances",
          false,
          `Error getting balances: ${error.message}`
        );
      }
    } catch (error) {
      logResult("User info", false, `Error: ${error.message}`);
    }

    // =============================================
    // 5. Conversion Functions
    // =============================================
    logTitle("Conversion Functions");

    try {
      const testAmount = ethers.parseEther("10.0");

      // Convert assets to shares
      const assetsToShares = await client.convertToShares(testAmount);
      logResult(
        "10 tokens converts to",
        true,
        `${ethers.formatEther(assetsToShares)} shares`
      );

      // Convert shares to assets
      const sharesToAssets = await client.convertToAssets(testAmount);
      logResult(
        "10 shares converts to",
        true,
        `${ethers.formatEther(sharesToAssets)} tokens`
      );
    } catch (error) {
      logResult("Conversion functions", false, `Error: ${error.message}`);
    }

    // =============================================
    // 6. Byzantine Fee Information
    // =============================================
    logTitle("Byzantine Fee Information");

    try {
      // Get Byzantine fee settings
      const feeSettings = await client.getByzantineFeeSettings();
      logResult("Byzantine fee recipient", true, feeSettings.recipient);
      logResult(
        "Byzantine fee percentage",
        true,
        `${Number(feeSettings.percentage) / 100}% (${
          feeSettings.percentage
        } bps)`
      );

      // Get individual fee components
      const feePercentage = await client.getByzantineFeePercentage();
      logResult(
        "Fee percentage (direct)",
        true,
        `${Number(feePercentage) / 100}%`
      );

      const feeRecipient = await client.getByzantineFeeRecipient();
      logResult("Fee recipient (direct)", true, feeRecipient);
    } catch (error) {
      logResult("Byzantine fee info", false, `Error: ${error.message}`);
    }

    // =============================================
    // 7. Contract Instances
    // =============================================
    logTitle("Contract Information");

    try {
      // Get MetaVault contract
      const vaultContract = client.getMetaVaultContract(VAULT_ADDRESS);
      logResult(
        "MetaVault contract",
        true,
        `Address: ${await vaultContract.getAddress()}`
      );

      // Get MetaVaultFactory contract
      const factoryContract = await client.getMetaVaultFactoryContract();
      logResult(
        "MetaVaultFactory contract",
        true,
        `Address: ${await factoryContract.getAddress()}`
      );
    } catch (error) {
      logResult("Contract info", false, `Error: ${error.message}`);
    }

    // =============================================
    // 8. Summary
    // =============================================
    logTitle("Summary");

    console.log("📊 Vault Summary:");
    try {
      const asset = await client.asset();
      const totalAssets = await client.totalAssets();
      const totalSupply = await client.totalSupply();
      const userShares = await client.balanceOf(userAddress);
      const userValue =
        userShares > 0n ? await client.convertToAssets(userShares) : 0n;

      console.log(`   • Asset: ${asset}`);
      console.log(
        `   • Total Value Locked: ${ethers.formatEther(totalAssets)} tokens`
      );
      console.log(
        `   • Total Shares: ${ethers.formatEther(totalSupply)} shares`
      );
      console.log(`   • Your Shares: ${ethers.formatEther(userShares)} shares`);
      console.log(`   • Your Value: ${ethers.formatEther(userValue)} tokens`);

      if (totalSupply > 0n) {
        const sharePrice = (totalAssets * ethers.parseEther("1")) / totalSupply;
        console.log(
          `   • Current Share Price: ${ethers.formatEther(
            sharePrice
          )} tokens/share`
        );
      }
    } catch (error) {
      console.log(`   • Error getting summary: ${error.message}`);
    }

    console.log("\n🎉 All tests completed! 🎉\n");
  } catch (error) {
    console.error(`\n❌ TEST FAILED: ${error.message}\n`);
    console.error(error);
    process.exit(1);
  }
}

// Instructions for usage
if (!process.env.RPC_URL) {
  console.log("📋 To run this test:");
  console.log("1. Create a .env file with:");
  console.log("   RPC_URL=<your_rpc_endpoint>");
  console.log("   PRIVATE_KEY=<your_private_key> (optional)");
  console.log("   DEFAULT_CHAIN_ID=11155111 (for Sepolia)");
  console.log("");
  console.log("2. Update VAULT_ADDRESS constant in this file");
  console.log("3. Run: node test/read-vault.js");
  console.log("");
}

// Run tests if file is executed directly
if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}

module.exports = { runTests };
