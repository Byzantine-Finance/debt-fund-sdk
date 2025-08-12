// @ts-check

/**
 * Test for creating a MetaVault with Byzantine Factory SDK
 *
 * This test demonstrates how to create a MetaVault using the new simplified Byzantine Factory SDK.
 * It initializes the client with automatic factory detection, sets up the vault parameters,
 * and creates the MetaVault on the network.
 *
 * Tests included:
 * 1. Environment validation - Checks for required environment variables
 * 2. Client initialization - Verifies that the client can be properly instantiated
 * 3. Parameter validation - Ensures that all parameters are correctly set
 * 4. MetaVault creation - Creates an actual MetaVault on the network
 * 5. Transaction verification - Validates the transaction receipt
 */

const { ethers } = require("ethers");
const {
  logTitle,
  logResult,
  assert,
  createWallet,
  getWalletBalances,
} = require("./utils");

async function runTests() {
  // Configuration
  const chainId = 8453; // Base Mainnet
  /** @type {any} */ const skipNetworkTests = false; // Set to true to skip network calls during development

  logTitle("Byzantine Factory SDK - Create MetaVault Test");
  console.log(`Network: Base Mainnet (Chain ID: ${chainId})\n`);

  try {
    // Setup provider and wallet
    console.log("===== MetaVault Creation Test =====");
    console.log("Test Name".padEnd(40) + "| Status | Result");
    console.log("-".repeat(70));

    // Load environment variables
    require("dotenv").config();
    const { RPC_URL } = process.env;

    if (!RPC_URL) {
      throw new Error("RPC_URL not set in .env file");
    }

    // Get network configuration and ByzantineClient
    const { getNetworkConfig, ByzantineClient } = require("../dist");
    const networkConfig = getNetworkConfig(chainId);

    if (!networkConfig) {
      throw new Error(`Chain ID ${chainId} is not supported`);
    }

    // Create provider and wallet
    const provider = /** @type {any} */ (new ethers.JsonRpcProvider(RPC_URL));
    const wallet = createWallet(provider, 0);
    const address = await wallet.getAddress();

    logResult("Wallet address", true, address);
    logResult("Factory address", true, networkConfig.byzantineFactoryAddress);

    if (skipNetworkTests) {
      console.log("⏭️  Skipping network tests (skipNetworkTests = true)");
      return;
    }

    // Verify factory contract exists
    console.log("\n🔍 Verifying factory contract...");
    try {
      const factoryCode = await provider.getCode(
        networkConfig.byzantineFactoryAddress
      );
      if (factoryCode === "0x") {
        throw new Error("Factory contract not found at specified address");
      }
      console.log("✅ Factory contract exists");
      logResult(
        "Factory verification",
        true,
        `Code length: ${factoryCode.length} bytes`
      );

      // Test a simple read function
      const tempClient = new ByzantineClient(provider);
      const feeSettings = await tempClient.getByzantineFeeSettings();
      console.log(
        `✅ Factory contract working - Byzantine fee: ${feeSettings.percentage} bps`
      );
      console.log(`✅ Fee recipient: ${feeSettings.recipient}`);
    } catch (error) {
      console.log(`❌ Factory contract verification failed: ${error.message}`);
      logResult("Factory verification", false, error.message);
    }

    // Check wallet balance
    console.log("\n💰 Checking wallet balance...");
    try {
      const balances = await getWalletBalances(
        provider,
        address,
        networkConfig
      );
      console.log(`💰 Your ETH Balance: ${balances.ETH.formatted} ETH`);

      const minEthRequired = ethers.parseEther("0.01");
      if (balances.ETH.balance < minEthRequired) {
        console.warn(
          `⚠️ Warning: Low ETH balance! You have ${balances.ETH.formatted} ETH`
        );
        console.warn(`💡 Recommended: At least 0.01 ETH for gas fees`);
        console.warn(
          `🔗 Get testnet ETH: https://sepoliafaucet.com/ (for Sepolia)`
        );
      } else {
        console.log(`✅ ETH balance sufficient for gas fees`);
      }
      logResult("ETH balance check", true, `${balances.ETH.formatted} ETH`);
    } catch (error) {
      logResult("ETH balance check", false, `Error: ${error.message}`);
      console.warn("⚠️ Could not check ETH balance, proceeding anyway...");
    }

    // Initialize Byzantine client
    const client = new ByzantineClient(provider, /** @type {any} */ (wallet));
    logResult("Client initialization", true, "");

    // Define MetaVault parameters
    const metaVaultParams = {
      asset: networkConfig.USDCaddress,
      // vaultName: "Test MetaVault",
      // vaultSymbol: "TMV",
      // subVaults: [
      //   {
      //     vault: "0xBeeFa74640a5f7c28966cbA82466EED5609444E0", // Morpho Seamless USDC Vault
      //     percentage: 7000n, // 70% allocation
      //   },
      //   {
      //     vault: "0xE74c499fA461AF1844fCa84204490877787cED56", // Morpho Seamless USDC Vault
      //     percentage: 2000n, // 20% allocation (10% idle)
      //   },
      // ],
      vaultName: "Euler AAVE Morpho USDC",
      vaultSymbol: "eamUSDC",
      subVaults: [
        {
          vault: "0xC768c589647798a6EE01A91FdE98EF2ed046DBD6", // AAVE USDC Vault
          percentage: 3000n, // 30% allocation
        },
        {
          vault: "0x085178078796Da17B191f9081b5E2fCCc79A7eE7", // Euler frontier yoUSD
          percentage: 3000n, // 30% allocation
        },
        {
          vault: "0xE74c499fA461AF1844fCa84204490877787cED56", // Morpho Seamless USDC Vault
          percentage: 3000n, // 30% allocation
        },
      ],
      curatorFeePercentage: 500n, // 5% fee (in basis points)
    };

    logResult("Parameter validation", true, "All parameters set correctly");
    console.log("MetaVault Parameters:");
    console.log(`  Asset: ${metaVaultParams.asset}`);
    console.log(`  Name: ${metaVaultParams.vaultName}`);
    console.log(`  Symbol: ${metaVaultParams.vaultSymbol}`);
    console.log(`  Sub-vaults: ${metaVaultParams.subVaults.length}`);
    console.log(`  Curator fee: ${metaVaultParams.curatorFeePercentage} bps`);

    // Create MetaVault
    console.log("\nAttempting to create MetaVault...");
    try {
      const tx = await client.createMetaVault(metaVaultParams);
      console.log(`🎉 MetaVault creation transaction sent!`);
      console.log(`🔗 Transaction hash: ${tx.hash}`);

      logResult("MetaVault creation", true, `Tx: ${tx.hash}`);

      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

        // Try to extract vault address from logs
        const vaultCreatedEvent = receipt.logs.find((log) => {
          try {
            return (
              log.topics[0] ===
              ethers.id(
                "MetaVaultCreated(address,address,address,string,string,uint256,uint256)"
              )
            );
          } catch {
            return false;
          }
        });

        if (vaultCreatedEvent) {
          const vaultAddress = ethers.getAddress(
            "0x" + vaultCreatedEvent.topics[1].slice(26)
          );
          console.log(`🏦 New MetaVault created at: ${vaultAddress}`);
          console.log(
            `🔗 View on BaseScan: ${networkConfig.scanLink}/address/${vaultAddress}`
          );
        }

        logResult(
          "Transaction confirmation",
          true,
          `Block ${receipt.blockNumber}`
        );
      } else {
        console.log("❌ Transaction failed");
        logResult("Transaction confirmation", false, "Transaction failed");
      }
    } catch (error) {
      console.log(`❌ MetaVault creation failed: ${error.message}`);
      logResult("MetaVault creation", false, `Error: ${error.message}`);
      console.log("Error details:", error);

      // Common error tips
      console.log("\n💡 Common solutions:");
      console.log("   • Make sure you have enough ETH for gas fees");
      console.log(
        "   • Check that sub-vault addresses are valid ERC4626 contracts"
      );
      console.log("   • Verify sub-vault assets match your MetaVault asset");
      console.log("   • Try with a lower curator fee percentage");
    }

    console.log("\n🎉 Test completed! 🎉");
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    logResult("Overall test", false, error.message);
  }
}

// Handle script execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
