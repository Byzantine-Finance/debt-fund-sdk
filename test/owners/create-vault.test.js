// @ts-check

/**
 * Test for creating a Vault with Byzantine Factory SDK
 *
 * This test demonstrates how to create a Vault using the new simplified Byzantine Factory SDK.
 * It initializes the client with automatic factory detection, sets up the vault parameters,
 * and creates the Vault on the network.
 *
 * Tests included:
 * 1. Environment validation - Checks for required environment variables
 * 2. Client initialization - Verifies that the client can be properly instantiated
 * 3. Factory contract verification - Tests basic contract functionality
 * 4. Parameter validation - Ensures that all parameters are correctly set
 * 5. Vault creation - Creates an actual Vault on the network
 * 6. Transaction verification - Validates the transaction receipt
 */

const { ethers } = require("ethers");
const {
  logTitle,
  logResult,
  assert,
  assertThrows,
  createWallet,
  getWalletBalances,
} = require("../utils");
const {
  setVaultNameAndSymbolOptimal,
  verifyVaultNameAndSymbol,
} = require("./set-name-symbol.test");

async function runTests() {
  // Configuration
  const chainId = 8453; // Base Mainnet
  /** @type {any} */ const skipNetworkTests = false; // Set to true to skip network calls during development

  // ========================================
  // VAULT PARAMETERS - Configure your vault here
  // ========================================
  const VAULT_PARAMS = {
    // Required parameters
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base - will be overridden by networkConfig.USDCaddress
    salt: ethers.randomBytes(32), // Random salt for deterministic address

    // Optional parameters - will be set after vault creation if provided
    name: "Test Vault SDK", // Optional: Vault name
    symbol: "TVAULT", // Optional: Vault symbol
    curator: undefined, // Optional: Curator address (leave undefined for no curator)
  };

  logTitle("Byzantine Factory SDK - Create Vault Test");
  console.log(`Network: Base Mainnet (Chain ID: ${chainId})\n`);

  try {
    // Load environment variables
    require("dotenv").config();
    const { RPC_URL } = process.env;

    assert(RPC_URL, "RPC_URL must be set in .env file");

    // Get network configuration and ByzantineClient
    const { getNetworkConfig, ByzantineClient } = require("../../dist");
    const networkConfig = getNetworkConfig(chainId);

    assert(networkConfig, `Chain ID ${chainId} must be supported`);
    assert(
      networkConfig.byzantineFactoryAddress,
      "Factory address must be configured"
    );

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
      assert(
        factoryCode !== "0x",
        "Factory contract not found at specified address"
      );
      console.log("✅ Factory contract exists");
      logResult(
        "Factory verification",
        true,
        `Code length: ${factoryCode.length} bytes`
      );

      // Test factory contract connectivity
      const tempClient = new ByzantineClient(provider);
      // @ts-ignore - Method exists in updated SDK
      const factoryContract = await tempClient.getVaultFactoryContract();
      console.log(
        `✅ Factory contract working - Address: ${factoryContract.target}`
      );
      console.log(`✅ Factory contract accessible through client`);
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
      const hasEnoughEth = balances.ETH.balance >= minEthRequired;

      if (!hasEnoughEth) {
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
      logResult(
        "ETH balance check",
        hasEnoughEth,
        `${balances.ETH.formatted} ETH`
      );
    } catch (error) {
      logResult("ETH balance check", false, `Error: ${error.message}`);
      console.warn("⚠️ Could not check ETH balance, proceeding anyway...");
    }

    // Initialize Byzantine client
    const client = new ByzantineClient(provider, /** @type {any} */ (wallet));
    assert(client, "Byzantine client must be initialized");
    logResult("Client initialization", true, "ByzantineClient created");

    // Prepare final vault parameters
    const finalVaultParams = {
      owner: address, // The wallet address will be the owner
      asset: networkConfig.USDCaddress || VAULT_PARAMS.asset, // Use network config or fallback
      salt: VAULT_PARAMS.salt,
      // Optional parameters
      name: VAULT_PARAMS.name,
      symbol: VAULT_PARAMS.symbol,
      curator: VAULT_PARAMS.curator,
    };

    // Validate required parameters
    assert(finalVaultParams.owner, "Owner address must be defined");
    assert(finalVaultParams.asset, "Asset address must be defined");
    assert(finalVaultParams.salt, "Salt must be defined");
    assert(
      ethers.isAddress(finalVaultParams.owner),
      "Owner must be a valid address"
    );
    assert(
      ethers.isAddress(finalVaultParams.asset),
      "Asset must be a valid address"
    );

    // Validate optional curator if provided
    if (finalVaultParams.curator) {
      assert(
        ethers.isAddress(finalVaultParams.curator),
        "Curator must be a valid address"
      );
    }

    logResult("Parameter validation", true, "All parameters validated");
    console.log("Vault Parameters:");
    console.log(`  Owner: ${finalVaultParams.owner}`);
    console.log(`  Asset: ${finalVaultParams.asset}`);
    console.log(`  Salt: ${ethers.hexlify(finalVaultParams.salt)}`);
    if (finalVaultParams.name) console.log(`  Name: ${finalVaultParams.name}`);
    if (finalVaultParams.symbol)
      console.log(`  Symbol: ${finalVaultParams.symbol}`);
    if (finalVaultParams.curator)
      console.log(`  Curator: ${finalVaultParams.curator}`);

    // Create Vault
    console.log("\nAttempting to create Vault...");
    try {
      // @ts-ignore - Method exists in updated SDK
      const tx = await client.createVault(
        finalVaultParams.owner,
        finalVaultParams.asset,
        ethers.hexlify(finalVaultParams.salt)
      );
      console.log(`🎉 Vault creation transaction sent!`);
      console.log(`🔗 Transaction hash: ${tx.hash}`);

      console.log("⏳ Waiting for transaction confirmation...");

      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }

      assert(receipt.status === 1, "Transaction must be successful");

      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

      logResult(
        "Vault creation",
        true,
        `Gas used: ${receipt.gasUsed.toString()}`
      );

      // Determine the vault address from the logs
      const vaultAddress = receipt.logs[0]?.address; // Simplified - in production, parse the event properly

      if (vaultAddress) {
        // Validate vault address
        assert(ethers.isAddress(vaultAddress), "Vault address must be valid");
        logResult("New Vault created", true, vaultAddress);
        logResult(
          "View on BaseScan",
          true,
          `${networkConfig.scanLink}/address/${vaultAddress}`
        );

        // Configure vault with optional parameters
        console.log("\n🧪 Configuring vault with optional parameters...");
        try {
          // First, verify we are the owner
          console.log("🔐 Verifying ownership...");
          // @ts-ignore - Method exists in updated SDK
          const currentOwner = await client.getOwner(vaultAddress);
          assert(
            currentOwner.toLowerCase() === address.toLowerCase(),
            `Wallet must be the vault owner. Current owner: ${currentOwner}, Wallet: ${address}`
          );
          logResult("Ownership verification", true, "Wallet is vault owner");

          // Wait before configuring vault to avoid nonce issues
          logTitle("Waiting before vault configuration...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

          // Set vault name and symbol using the optimal method
          logTitle("Setting vault name and symbol...");
          const { nameUpdated, symbolUpdated } =
            await setVaultNameAndSymbolOptimal(
              client,
              vaultAddress,
              finalVaultParams.name,
              finalVaultParams.symbol
            );

          // Verify the updates
          await verifyVaultNameAndSymbol(
            client,
            vaultAddress,
            finalVaultParams.name,
            finalVaultParams.symbol,
            nameUpdated,
            symbolUpdated
          );

          // Wait before next transaction to avoid nonce issues if curator is to be set
          if (
            finalVaultParams.curator &&
            finalVaultParams.curator === address
          ) {
            console.log("⏳ Waiting before curator setup...");
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
          }

          // Set curator if provided
          if (
            finalVaultParams.curator &&
            finalVaultParams.curator === address // Only set curator if it's the same as the owner
          ) {
            console.log(`👤 Setting curator to: ${finalVaultParams.curator}`);
            // @ts-ignore - Method exists in updated SDK
            const setCuratorTx = await client.setCurator(
              vaultAddress,
              finalVaultParams.curator
            );
            await setCuratorTx.wait();
            console.log("✅ Curator set successfully");

            // Verify curator was set
            // @ts-ignore - Method exists in updated SDK
            const newCurator = await client.getCurator(vaultAddress);
            assert(
              newCurator.toLowerCase() ===
                // @ts-ignore
                (finalVaultParams.curator || "").toLowerCase(),
              `Curator not set correctly. Expected: ${finalVaultParams.curator}, Got: ${newCurator}`
            );
            logResult("Set curator", true, finalVaultParams.curator);
          } else {
            console.log("⏭️ No curator provided, skipping curator setup");
            logResult("Set curator", true, "Skipped (no curator provided)");
          }

          logResult(
            "Vault configuration",
            true,
            "All optional parameters processed"
          );
        } catch (configError) {
          console.log(`⚠️ Vault configuration failed: ${configError.message}`);
          logResult("Vault configuration", false, configError.message);
        }
      } else {
        console.log(
          "⚠️ Could not determine vault address from transaction logs"
        );
        console.log(
          "💡 Transaction was successful but vault address extraction failed"
        );
        logResult("Vault address extraction", false, "Could not parse logs");
      }

      logResult(
        "Transaction confirmation",
        true,
        `Block ${receipt?.blockNumber || "unknown"}`
      );
    } catch (error) {
      logResult("Vault creation", false, `Error: ${error.message}`);

      // Common error tips
      console.log("\n💡 Common solutions:");
      console.log("   • Make sure you have enough ETH for gas fees");
      console.log("   • Verify the asset address is a valid ERC20 contract");
      console.log("   • Check that the owner address is valid");
      console.log("   • Try with a different salt value");
    }

    logTitle("Test completed! 🎉");
  } catch (error) {
    logTitle("Test failed! ❌");
    logResult("Overall test", false, error.message);
  }
}

// Handle script execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
