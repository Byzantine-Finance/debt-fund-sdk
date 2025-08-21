/**
 * Vault Name and Symbol Management Test
 *
 * This test demonstrates how to update vault name and symbol using the ByzantineClient.
 * Only the vault owner can perform these operations.
 *
 * Features tested:
 * - Reading current name and symbol
 * - Setting new name (optional)
 * - Setting new symbol (optional)
 * - Verifying ownership permissions
 */

const { ethers } = require("ethers");
const { ByzantineClient, getNetworkConfig } = require("../../dist");
const {
  logTitle,
  logResult,
  assert,
  createWallet,
  getWalletBalances,
  setUpTest,
} = require("../utils");
require("dotenv").config();

/**
 * Set vault name and symbol using the optimal method (multicall or individual calls)
 * @param {ByzantineClient} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string|undefined} newName - The new name (optional)
 * @param {string|undefined} newSymbol - The new symbol (optional)
 * @returns {Promise<{nameUpdated: boolean, symbolUpdated: boolean, currentName: string, currentSymbol: string}>}
 */
async function setVaultNameAndSymbolOptimal(
  client,
  vaultAddress,
  newName,
  newSymbol
) {
  let nameUpdated = false;
  let symbolUpdated = false;

  // Read current name and symbol from the vault
  let currentName = "";
  let currentSymbol = "";

  try {
    const vaultContract = client.getVaultContract(vaultAddress);
    currentName = await vaultContract.name();
    currentSymbol = await vaultContract.symbol();

    logResult("Current Vault Name", true, currentName || "(empty)");
    logResult("Current Vault Symbol", true, currentSymbol || "(empty)");
  } catch (error) {
    logResult("Reading current values", false, `Error: ${error.message}`);
    // Continue anyway, but without current values for logging
  }

  // Check if we can use multicall (both name and symbol provided)
  const hasName = newName && newName.trim() !== "";
  const hasSymbol = newSymbol && newSymbol.trim() !== "";
  const useMulticall = hasName && hasSymbol;

  if (useMulticall) {
    // Use multicall to set both name and symbol in one transaction
    try {
      console.log(
        `🚀 Using multicall to update both name and symbol in one transaction...`
      );
      console.log(`📝 Name: "${currentName}" → "${newName}"`);
      console.log(`🏷️ Symbol: "${currentSymbol}" → "${newSymbol}"`);

      const tx = await client.setVaultNameAndSymbol(
        vaultAddress,
        newName,
        newSymbol
      );
      logResult("Multicall transaction sent", true, tx.hash);

      // Wait for transaction confirmation
      console.log("⏳ Waiting for multicall transaction confirmation...");
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        logResult("Multicall confirmed", true, `Block: ${receipt.blockNumber}`);
        nameUpdated = true;
        symbolUpdated = true;
      } else {
        logResult("Multicall failed", false, "Transaction reverted");
      }
    } catch (error) {
      logResult("Multicall update", false, `Error: ${error.message}`);
    }
  } else {
    // Use individual transactions
    // Update Name if provided
    if (hasName) {
      try {
        console.log(
          `📝 Updating vault name from "${currentName}" to "${newName}"...`
        );

        const tx = await client.setSharesName(vaultAddress, newName);
        logResult("Name update transaction sent", true, tx.hash);

        // Wait for transaction confirmation
        console.log("⏳ Waiting for transaction confirmation...");
        const receipt = await tx.wait();

        if (receipt.status === 1) {
          logResult(
            "Name update confirmed",
            true,
            `Block: ${receipt.blockNumber}`
          );
          nameUpdated = true;
        } else {
          logResult("Name update failed", false, "Transaction reverted");
        }

        // Wait a bit before next transaction to avoid nonce issues
        if (hasSymbol) {
          console.log("⏳ Waiting before next transaction...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        }
      } catch (error) {
        logResult("Name update", false, `Error: ${error.message}`);
      }
    } else {
      logResult("Name update", true, "Skipped (no new name provided)");
    }

    // Update Symbol if provided
    if (hasSymbol) {
      try {
        console.log(
          `🏷️ Updating vault symbol from "${currentSymbol}" to "${newSymbol}"...`
        );

        const tx = await client.setSharesSymbol(vaultAddress, newSymbol);
        logResult("Symbol update transaction sent", true, tx.hash);

        // Wait for transaction confirmation
        console.log("⏳ Waiting for transaction confirmation...");
        const receipt = await tx.wait();

        if (receipt.status === 1) {
          logResult(
            "Symbol update confirmed",
            true,
            `Block: ${receipt.blockNumber}`
          );
          symbolUpdated = true;
        } else {
          logResult("Symbol update failed", false, "Transaction reverted");
        }
      } catch (error) {
        logResult("Symbol update", false, `Error: ${error.message}`);
      }
    } else {
      logResult("Symbol update", true, "Skipped (no new symbol provided)");
    }
  }

  return { nameUpdated, symbolUpdated, currentName, currentSymbol };
}

/**
 * Verify that vault name and symbol were updated correctly
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string|undefined} expectedName - Expected name
 * @param {string|undefined} expectedSymbol - Expected symbol
 * @param {boolean} nameUpdated - Whether name was updated
 * @param {boolean} symbolUpdated - Whether symbol was updated
 */
async function verifyVaultNameAndSymbol(
  client,
  vaultAddress,
  expectedName,
  expectedSymbol,
  nameUpdated,
  symbolUpdated
) {
  try {
    // Get vault contract to read updated name and symbol
    const vaultContract = client.getVaultContract(vaultAddress);

    // Verify new vault name
    const updatedName = await vaultContract.name();
    logResult("Updated Vault Name", true, updatedName);

    if (nameUpdated && expectedName) {
      const nameMatch = updatedName === expectedName;
      logResult(
        "Name update verification",
        nameMatch,
        nameMatch ? "✅ Name updated successfully" : "❌ Name mismatch"
      );
    }

    // Verify new vault symbol
    const updatedSymbol = await vaultContract.symbol();
    logResult("Updated Vault Symbol", true, updatedSymbol);

    if (symbolUpdated && expectedSymbol) {
      const symbolMatch = updatedSymbol === expectedSymbol;
      logResult(
        "Symbol update verification",
        symbolMatch,
        symbolMatch ? "✅ Symbol updated successfully" : "❌ Symbol mismatch"
      );
    }
  } catch (error) {
    logResult("Post-update verification", false, `Error: ${error.message}`);
  }
}

// 🎯 CONFIGURE YOUR TEST PARAMETERS HERE
const TEST_CONFIG = {
  vaultAddress: "0xD39298882661e0c5Ee3c2f1EECa28D681838c370", // Replace with actual Vault address
  newName: "Test Vault", // Optional: leave empty string "" to skip name update
  newSymbol: "TVAULT", // Optional: leave empty string "" to skip symbol update
};

// Test suite
async function runTests() {
  console.log("\n🧪 Vault Name and Symbol Management Test 🧪\n");

  try {
    const setupResult = await setUpTest();
    if (!setupResult) {
      throw new Error(
        "Test setup failed. Please check your environment variables."
      );
    }
    const { provider, client, networkConfig, userAddress } = setupResult;

    // =============================================
    // 1. User Wallet Information
    // =============================================
    logTitle("User Wallet Information");

    try {
      // Display user address first
      logResult("User Address", true, userAddress);

      // Get wallet balances using utils function
      const balances = await getWalletBalances(
        provider,
        userAddress,
        networkConfig
      );
      logResult("ETH balance", true, `${balances.ETH.formatted} ETH`);

      if (balances.USDC) {
        logResult(
          "USDC balance",
          true,
          `${balances.USDC.formatted} ${balances.USDC.symbol}`
        );
      }
    } catch (error) {
      logResult(
        "Wallet info",
        false,
        `Error getting wallet info: ${error.message}`
      );
    }

    // =============================================
    // 2. Pre-Update Vault Information
    // =============================================
    logTitle("Pre-Update Vault Information");

    let isOwner = false;

    try {
      // Check ownership
      const owner = await client.getOwner(TEST_CONFIG.vaultAddress);
      logResult("Vault Owner", true, owner);

      isOwner = owner.toLowerCase() === userAddress.toLowerCase();
      logResult("User is Owner", true, isOwner ? "Yes" : "No");

      if (!isOwner) {
        console.log("\n⚠️ WARNING: User is not the vault owner!");
        console.log("   Only the vault owner can update name and symbol.");
        console.log("   The following tests will likely fail.\n");
      }
    } catch (error) {
      logResult("Pre-update info", false, `Error: ${error.message}`);
      return;
    }

    // =============================================
    // 3. Update Operations
    // =============================================
    logTitle("Update Operations");

    // Use the common function to update name and symbol optimally
    const {
      nameUpdated,
      symbolUpdated,
      currentName: actualCurrentName,
      currentSymbol: actualCurrentSymbol,
    } = await setVaultNameAndSymbolOptimal(
      client,
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.newName,
      TEST_CONFIG.newSymbol
    );

    // =============================================
    // 4. Post-Update Verification
    // =============================================
    logTitle("Post-Update Verification");

    // Use the common function to verify the updates
    await verifyVaultNameAndSymbol(
      client,
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.newName,
      TEST_CONFIG.newSymbol,
      nameUpdated,
      symbolUpdated
    );

    // =============================================
    // 5. Summary
    // =============================================
    logTitle("Summary");

    console.log("📊 Update Summary:");
    try {
      const vaultContract = client.getVaultContract(TEST_CONFIG.vaultAddress);
      const finalName = await vaultContract.name();
      const finalSymbol = await vaultContract.symbol();

      console.log(`   • Vault Address: ${TEST_CONFIG.vaultAddress}`);
      console.log(`   • Final Name: ${finalName}`);
      console.log(`   • Final Symbol: ${finalSymbol}`);
      console.log(`   -`);
      console.log(`   • Original Name: ${actualCurrentName}`);
      console.log(`   • Original Symbol: ${actualCurrentSymbol}`);
      console.log(`   -`);
      console.log(
        `   • Requested Name: ${TEST_CONFIG.newName || "(not updated)"}`
      );
      console.log(
        `   • Requested Symbol: ${TEST_CONFIG.newSymbol || "(not updated)"}`
      );
      console.log(`   -`);
      console.log(`   • Name Updated: ${nameUpdated ? "Yes" : "No"}`);
      console.log(`   • Symbol Updated: ${symbolUpdated ? "Yes" : "No"}`);
      console.log(`   • User is Owner: ${isOwner ? "Yes" : "No"}`);
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
  console.log("   PRIVATE_KEY=<your_private_key> (must be vault owner)");
  console.log("");
  console.log("2. Update TEST_CONFIG in this file:");
  console.log("   - vaultAddress: your vault address");
  console.log("   - newName: new name (optional)");
  console.log("   - newSymbol: new symbol (optional)");
  console.log("");
  console.log("3. Run: node test/set-name-symbol.test.js");
  console.log("");
  console.log("⚠️ Important: Only the vault owner can update name and symbol!");
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

module.exports = {
  runTests,
  setVaultNameAndSymbolOptimal,
  verifyVaultNameAndSymbol,
};
