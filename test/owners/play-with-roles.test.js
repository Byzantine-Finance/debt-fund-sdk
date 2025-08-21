// @ts-check

/**
 * Test for role management with Byzantine Factory SDK
 *
 * This test demonstrates comprehensive role management functionality:
 * - Reading current owner and curator
 * - Setting curator by owner
 * - Testing unauthorized access (should fail)
 * - Managing sentinels (add/remove)
 * - Verifying role permissions and access control
 */

const { ethers } = require("ethers");
const { ByzantineClient } = require("../../dist");
const {
  logTitle,
  logResult,
  assert,
  assertThrows,
  createWallet,
  getWalletBalances,
  setUpTest,
} = require("../utils");

// 🎯 CONFIGURE YOUR VAULT ADDRESS HERE
const VAULT_ADDRESS = "0xD39298882661e0c5Ee3c2f1EECa28D681838c370"; // Replace with actual Vault address

async function runRoleTests() {
  // Configuration
  const chainId = 8453; // Base Mainnet
  /** @type {any} */ const skipNetworkTests = false;

  logTitle("Byzantine Factory SDK - Role Management Test");
  console.log(`Network: Base Mainnet (Chain ID: ${chainId})\n`);

  try {
    const setupResult = await setUpTest();
    if (!setupResult) {
      throw new Error(
        "Test setup failed. Please check your environment variables."
      );
    }
    const { provider, client, networkConfig, userAddress } = setupResult;
    // Load environment variables
    require("dotenv").config();
    const { RPC_URL } = process.env;

    assert(RPC_URL, "RPC_URL must be set in .env file");
    assert(
      VAULT_ADDRESS,
      "VAULT_ADDRESS must be set in .env file - please run create-vault.test.js first"
    );
    assert(
      ethers.isAddress(VAULT_ADDRESS),
      "VAULT_ADDRESS must be a valid address"
    );

    // Create provider and wallets
    const ownerWallet = createWallet(provider, 0); // Main wallet (should be owner)
    const randomWallet = createWallet(provider, 1); // Random wallet for testing
    const curatorWallet = createWallet(provider, 2); // Will be set as curator

    const ownerAddress = await ownerWallet.getAddress();
    const randomAddress = await randomWallet.getAddress();
    const curatorAddress = await curatorWallet.getAddress();

    logResult("Wallet addresses", true, `Owner: ${ownerAddress}`);
    console.log(`  Random: ${randomAddress}`);
    console.log(`  Curator: ${curatorAddress}`);

    if (skipNetworkTests) {
      console.log("⏭️  Skipping network tests (skipNetworkTests = true)");
      return;
    }

    // Check wallet balances using utils function
    console.log("\n💰 Checking wallet balances...");
    try {
      const ownerBalances = await getWalletBalances(
        provider,
        ownerAddress,
        networkConfig
      );
      console.log(`💰 Owner ETH Balance: ${ownerBalances.ETH.formatted} ETH`);

      if (ownerBalances.USDC) {
        console.log(
          `💰 Owner USDC Balance: ${ownerBalances.USDC.formatted} ${ownerBalances.USDC.symbol}`
        );
      }

      const minEthRequired = ethers.parseEther("0.01");
      const hasEnoughEth = ownerBalances.ETH.balance >= minEthRequired;

      if (!hasEnoughEth) {
        console.warn(
          `⚠️ Warning: Low ETH balance! You have ${ownerBalances.ETH.formatted} ETH`
        );
        console.warn(`💡 Recommended: At least 0.01 ETH for gas fees`);
      } else {
        console.log(`✅ ETH balance sufficient for gas fees`);
      }
      logResult(
        "ETH balance check",
        hasEnoughEth,
        `${ownerBalances.ETH.formatted} ETH`
      );
    } catch (error) {
      logResult("ETH balance check", false, `Error: ${error.message}`);
      console.warn("⚠️ Could not check ETH balance, proceeding anyway...");
    }

    // Initialize clients
    const ownerClient = new ByzantineClient(
      provider,
      /** @type {any} */ (ownerWallet)
    );
    const randomClient = new ByzantineClient(
      provider,
      /** @type {any} */ (randomWallet)
    );

    const vaultAddress = /** @type {string} */ (VAULT_ADDRESS);
    logResult("Vault address", true, vaultAddress);

    // Verify vault contract exists
    logTitle("Verifying vault contract");
    try {
      const vaultCode = await provider.getCode(vaultAddress);
      assert(
        vaultCode !== "0x",
        "Vault contract not found at specified address"
      );
      logResult(
        "Vault verification",
        true,
        `Code length: ${vaultCode.length} bytes`
      );
    } catch (error) {
      logResult("Vault verification", false, error.message);
      throw error;
    }

    // ========================================
    // STEP 1: Read current roles
    // ========================================
    logTitle("Reading current vault roles");

    try {
      // @ts-ignore - Method exists in updated SDK
      const currentOwner = await ownerClient.getOwner(vaultAddress);
      logResult("Read owner", true, currentOwner);

      // @ts-ignore - Method exists in updated SDK
      const currentCurator = await ownerClient.getCurator(vaultAddress);
      logResult("Read curator", true, currentCurator);

      // Verify owner wallet is indeed the owner
      assert(
        currentOwner.toLowerCase() === ownerAddress.toLowerCase(),
        `Owner wallet (${ownerAddress}) must match vault owner (${currentOwner})`
      );
    } catch (error) {
      logResult("Read initial roles", false, error.message);
      throw error;
    }

    // ========================================
    // STEP 2: Owner sets a curator
    // ========================================
    logTitle("Owner setting curator");

    try {
      // @ts-ignore - Method exists in updated SDK
      const setCuratorTx = await ownerClient.setCurator(
        vaultAddress,
        curatorAddress
      );
      await setCuratorTx.wait();

      // Wait before next operation to avoid nonce issues
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      // Verify curator was set
      // @ts-ignore - Method exists in updated SDK
      const newCurator = await ownerClient.getCurator(vaultAddress);
      assert(
        newCurator.toLowerCase() === curatorAddress.toLowerCase(),
        `Curator not set correctly. Expected: ${curatorAddress}, Got: ${newCurator}`
      );
      logResult("Set curator (owner)", true, `Curator added: ${newCurator}`);
    } catch (error) {
      logResult("Set curator (owner)", false, error.message);
      throw error;
    }

    // Wait before next test to avoid nonce issues
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    // ========================================
    // STEP 3: Random address tries to set curator (should fail)
    // ========================================
    logTitle("Random address trying to set curator (should fail)");

    await assertThrows(async () => {
      // @ts-ignore - Method exists in updated SDK
      const unauthorizedTx = await randomClient.setCurator(
        vaultAddress,
        randomAddress
      );
      await unauthorizedTx.wait();
    }, "Unauthorized curator set should fail");

    // Wait before next test to avoid nonce issues
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    // ========================================
    // STEP 4: Set a sentinel
    // ========================================
    logTitle("Owner setting a sentinel");

    try {
      // @ts-ignore - Method exists in updated SDK
      const setSentinelTx = await ownerClient.setIsSentinel(
        vaultAddress,
        randomAddress,
        true
      );
      await setSentinelTx.wait();

      // Wait before verification to avoid nonce issues
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      // Verify sentinel status
      // @ts-ignore - Method exists in updated SDK
      const isSentinelResult = await ownerClient.isSentinel(
        vaultAddress,
        randomAddress
      );
      assert(
        isSentinelResult,
        `Sentinel not set correctly for ${randomAddress}`
      );
      logResult("Set sentinel", true, `Sentinel added: ${randomAddress}`);
    } catch (error) {
      logResult("Set sentinel", false, error.message);
      throw error;
    }

    // Wait before next test to avoid nonce issues
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    // ========================================
    // STEP 5: Remove the sentinel
    // ========================================
    logTitle("Owner removing the sentinel");

    try {
      // @ts-ignore - Method exists in updated SDK
      const removeSentinelTx = await ownerClient.setIsSentinel(
        vaultAddress,
        randomAddress,
        true
      );
      await removeSentinelTx.wait();

      // Wait before verification to avoid nonce issues
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      // Verify sentinel status is now false
      // @ts-ignore - Method exists in updated SDK
      const isSentinelAfterRemoval = await ownerClient.isSentinel(
        vaultAddress,
        randomAddress
      );
      assert(
        !isSentinelAfterRemoval,
        `Sentinel removal failed for ${randomAddress}`
      );
      logResult("Remove sentinel", true, "Sentinel removed and verified");
    } catch (error) {
      logResult("Remove sentinel", false, error.message);
      throw error;
    }

    // Wait before next test to avoid nonce issues
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    // ========================================
    // STEP 6: Random address tries to set another random address (should fail)
    // ========================================
    logTitle("Random address trying to set owner (should fail)");

    await assertThrows(async () => {
      // @ts-ignore - Method exists in updated SDK
      const unauthorizedOwnerTx = await randomClient.setOwner(
        vaultAddress,
        randomAddress
      );
      await unauthorizedOwnerTx.wait();
    }, "Unauthorized owner set should fail");

    // Wait before final verification to avoid nonce issues
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    // ========================================
    // FINAL VERIFICATION
    // ========================================
    logTitle("Final verification of all roles");

    try {
      // @ts-ignore - Method exists in updated SDK
      const finalOwner = await ownerClient.getOwner(vaultAddress);
      // @ts-ignore - Method exists in updated SDK
      const finalCurator = await ownerClient.getCurator(vaultAddress);
      // @ts-ignore - Method exists in updated SDK
      const finalSentinelStatus = await ownerClient.isSentinel(
        vaultAddress,
        randomAddress
      );

      // Verify all states are as expected
      const ownerCorrect =
        finalOwner.toLowerCase() === ownerAddress.toLowerCase();
      const curatorCorrect =
        finalCurator.toLowerCase() === curatorAddress.toLowerCase();
      const sentinelCorrect = !finalSentinelStatus; // Should be false

      if (ownerCorrect && curatorCorrect && sentinelCorrect) {
        logResult("Final verification", true, "All roles in expected state");
      } else {
        throw new Error("Final state verification failed");
      }
    } catch (error) {
      logResult("Final verification", false, error.message);
      throw error;
    }

    // ========================================
    // SUMMARY
    // ========================================
    logTitle("Role Management Summary");
    try {
      const finalOwner = await ownerClient.getOwner(vaultAddress);
      const finalCurator = await ownerClient.getCurator(vaultAddress);
      const randomIsSentinel = await ownerClient.isSentinel(
        vaultAddress,
        randomAddress
      );

      logResult("Final Owner", true, finalOwner);
      logResult("Final Curator", true, finalCurator);
      logResult("Random is Sentinel", true, randomIsSentinel ? "Yes" : "No");
    } catch (error) {
      logResult("Summary", false, error.message);
    }

    logResult("Role management test", true, "Completed successfully");
  } catch (error) {
    console.error("\n❌ Role management test failed:", error);
    logResult("Overall test", false, error.message);
  }
}

// Handle script execution
if (require.main === module) {
  runRoleTests().catch(console.error);
}

module.exports = { runRoleTests };
