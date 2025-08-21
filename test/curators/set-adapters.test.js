// @ts-check

/**
 * Vault Adapters Management Test
 *
 * This test demonstrates how to manage vault adapters using the CuratorsClient.
 * Only the vault curator can perform these operations.
 *
 * Features tested:
 * - Reading current adapter status
 * - Adding/removing adapters
 * - Submitting adapter changes (with timelock)
 * - Setting adapters after timelock
 * - Instant adapter setting (when timelock is 0)
 * - Getting number of adapters
 * - Verifying curator permissions
 */

const {
  logTitle,
  logResult,
  assert,
  createWallet,
  getWalletBalances,
  setUpTest,
  vaultUserInformation,
} = require("../utils");
require("dotenv").config();

// 🎯 CONFIGURE YOUR TEST PARAMETERS HERE
const TEST_CONFIG = {
  vaultAddress: "0x9c6dd63e5e30e6984a322d2a5cdaee49ebc46207", // Replace with actual Vault address
  adapterAddress: "0x6f4302b0019008dc1c91e55929926c7089f3d221", // Adapter of morpho vault
};

/**
 * Check if an address is currently an adapter
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} adapterAddress - The adapter address to check
 * @returns {Promise<{isAdapter: boolean, numberOfAdapters: number, timelock: number}>}
 */
async function checkAdapterStatus(client, vaultAddress, adapterAddress) {
  try {
    const isAdapter = await client.getIsAdapter(vaultAddress, adapterAddress);
    const numberOfAdapters = await client.getAdaptersLength(vaultAddress);
    const timelock = await client.getTimelock(vaultAddress, "setIsAdapter");
    return { isAdapter, numberOfAdapters, timelock };
  } catch (error) {
    logResult("Check adapter status", false, `Error: ${error.message}`);
    return { isAdapter: false, numberOfAdapters: 0, timelock: 0 };
  }
}

/**
 * Check vault timelock for a specific function to determine the best method for setting adapters
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} functionName - The function name to check timelock for
 * @returns {Promise<number>}
 */
async function checkTimelock(
  client,
  vaultAddress,
  functionName = "setIsAdapter"
) {
  try {
    // TODO: Re-enable when the SDK is rebuilt with new timelock methods
    // const timelockBigInt = await client.getTimelock(vaultAddress, functionName);
    // const timelockSeconds = Number(timelockBigInt);
    const timelockSeconds = 0; // Default to 0 for now
    logResult(
      `Timelock for ${functionName}`,
      true,
      `${timelockSeconds} seconds (default)`
    );
    return timelockSeconds;
  } catch (error) {
    logResult("Check timelock", false, `Error: ${error.message}`);
    return -1;
  }
}

/**
 * Set adapter status using the optimal method based on timelock
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} adapterAddress - The adapter address
 * @param {boolean} isAdapter - Whether to enable or disable the adapter
 * @param {number} timelock - The current timelock value
 * @returns {Promise<{success: boolean, method: string}>}
 */
async function setAdapterOptimal(
  client,
  vaultAddress,
  adapterAddress,
  isAdapter,
  timelock
) {
  const action = isAdapter ? "enable" : "disable";

  try {
    let tx;
    let method;

    if (timelock === 0) {
      // Use instant setting when timelock is 0
      console.log(
        `🚀 Using instant method to ${action} adapter (timelock = 0)...`
      );
      tx = await client.instantSetIsAdapter(
        vaultAddress,
        adapterAddress,
        isAdapter
      );
      method = "instant";
    } else {
      // Use submit method when timelock > 0
      console.log(
        `⏰ Using submit method to ${action} adapter (timelock = ${timelock}s)...`
      );
      tx = await client.submitIsAdapter(
        vaultAddress,
        adapterAddress,
        isAdapter
      );
      method = "submit";
    }

    logResult(`${action} adapter transaction sent`, true, tx.hash);

    // Wait for transaction confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      logResult(
        `${action} adapter confirmed`,
        true,
        `Block: ${receipt.blockNumber}`
      );
      return { success: true, method };
    } else {
      logResult(`${action} adapter failed`, false, "Transaction reverted");
      return { success: false, method };
    }
  } catch (error) {
    logResult(`${action} adapter`, false, `Error: ${error.message}`);
    return { success: false, method: "unknown" };
  }
}

/**
 * Execute adapter setting after timelock (for submitted changes)
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} adapterAddress - The adapter address
 * @param {boolean} isAdapter - Whether to enable or disable the adapter
 * @returns {Promise<boolean>}
 */
async function executeAdapterAfterTimelock(
  client,
  vaultAddress,
  adapterAddress,
  isAdapter
) {
  const action = isAdapter ? "enable" : "disable";

  try {
    console.log(`⚡ Executing ${action} adapter after timelock...`);
    const tx = await client.setIsAdapterAfterTimelock(
      vaultAddress,
      adapterAddress,
      isAdapter
    );
    logResult(`Execute ${action} adapter transaction sent`, true, tx.hash);

    // Wait for transaction confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      logResult(
        `Execute ${action} adapter confirmed`,
        true,
        `Block: ${receipt.blockNumber}`
      );
      return true;
    } else {
      logResult(
        `Execute ${action} adapter failed`,
        false,
        "Transaction reverted"
      );
      return false;
    }
  } catch (error) {
    logResult(`Execute ${action} adapter`, false, `Error: ${error.message}`);
    return false;
  }
}

// Test suite
async function runTests() {
  console.log("\n🧪 Vault Adapters Management Test 🧪\n");

  try {
    // Await setUpTest and check for undefined result to avoid destructuring error
    const setupResult = await setUpTest();
    if (!setupResult) {
      throw new Error(
        "Test setup failed. Please check your environment variables."
      );
    }
    const { provider, client, networkConfig, userAddress } = setupResult;

    // set yourself as curator
    await client.setCurator(TEST_CONFIG.vaultAddress, userAddress);

    await vaultUserInformation(client, TEST_CONFIG.vaultAddress, userAddress);

    // =============================================
    // 2. Pre-Operation Vault Information
    // =============================================
    logTitle("Pre-Operation Vault Information");

    let isCurator = false;
    let currentTimelock = 0;

    // Get current adapter status
    const { isAdapter, numberOfAdapters, timelock } = await checkAdapterStatus(
      client,
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.adapterAddress
    );

    logTitle(
      "Check adapter status for " +
        TEST_CONFIG.adapterAddress +
        " on vault " +
        TEST_CONFIG.vaultAddress
    );
    logResult(
      `Is an adapter?`,
      true,
      isAdapter
        ? `${TEST_CONFIG.adapterAddress} is an adapter`
        : `${TEST_CONFIG.adapterAddress} is not an adapter`
    );
    logResult("Number of adapters", true, numberOfAdapters.toString());
    logResult("Timelock to setIsAdapter", true, timelock.toString());

    const timelockDecrease = await client.getTimelock(
      TEST_CONFIG.vaultAddress,
      "decreaseTimelock"
    );
    logResult(
      "Timelock to decreaseTimelock",
      true,
      timelockDecrease.toString()
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (isAdapter) {
      logTitle("Adapter is already enabled, remove it");
      await client.instantSetIsAdapter(
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.adapterAddress,
        false
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { isAdapter } = await checkAdapterStatus(
        client,
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.adapterAddress
      );
      if (!isAdapter) {
        logResult("Adapter removal", true, "Successfully removed");
      } else {
        logResult("Adapter removal", false, "Failed to remove");
      }
      return;
    } else {
      logTitle("Adapter is disabled, enable it");
      await client.instantSetIsAdapter(
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.adapterAddress,
        true
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { isAdapter } = await checkAdapterStatus(
        client,
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.adapterAddress
      );
      if (isAdapter) {
        logResult("Adapter enable", true, "Successfully enabled");
      } else {
        logResult("Adapter enable", false, "Failed to enable");
      }
    }

    // =============================================
    // 3. Set timelock to 5s, submit, try to execute(tofail), then re-execute
    // =============================================
    logTitle(
      "Set timelock to 5s, submit, try to execute(tofail), then re-execute"
    );

    logTitle("Set timelock to 5s");
    const timelockBefore = await client.getTimelock(
      TEST_CONFIG.vaultAddress,
      "setIsAdapter"
    );
    logResult("Current timelock", true, timelockBefore.toString());
    await client.increaseTimelock(
      TEST_CONFIG.vaultAddress,
      "setIsAdapter",
      BigInt(5)
    );
    const timelockAfter = await client.getTimelock(
      TEST_CONFIG.vaultAddress,
      "setIsAdapter"
    );
    logResult("New timelock", true, timelockAfter.toString());

    await new Promise((resolve) => setTimeout(resolve, 1000));

    logTitle("Submit with fail");
    await client.submitIsAdapter(
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.adapterAddress,
      true
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      // should fail because timelock is 5s, and we are trying to execute it immediately

      const timelockAfter = await client.getTimelock(
        TEST_CONFIG.vaultAddress,
        "setIsAdapter"
      );
      logResult("Timelock after submit", true, timelockAfter.toString());
      await client.setIsAdapterAfterTimelock(
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.adapterAddress,
        true
      );
      logResult("Action was supposed to fail", false, "It passed");
    } catch (error) {
      logResult("Action failed", true, "It was supposed to fail");
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));

    logTitle("Execute after 5s");

    const timelockBeforeExecute = await client.getTimelock(
      TEST_CONFIG.vaultAddress,
      "setIsAdapter"
    );
    logResult(
      "Reading first timelock before execute",
      true,
      timelockBeforeExecute.toString()
    );
    await client.setIsAdapterAfterTimelock(
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.adapterAddress,
      true
    );
    logResult("Action was successful", true, "It passed");

    // // put back to 0s
    // logTitle("Put back to 0s");
    // await client.instantDecreaseTimelock(
    //   TEST_CONFIG.vaultAddress,
    //   "setIsAdapter",
    //   BigInt(0)
    // );
    // logResult("Action was successful", true, "It passed");

    // // =============================================
    // // 4. Post-Operation Verification
    // // =============================================
    // logTitle("Post-Operation Verification");

    // try {
    //   // Wait a bit for blockchain to update
    //   console.log("⏳ Waiting for blockchain state update...");
    //   await new Promise((resolve) => setTimeout(resolve, 2000));

    //   // Check final adapter status
    //   const { isAdapter, numberOfAdapters } = await checkAdapterStatus(
    //     client,
    //     TEST_CONFIG.vaultAddress,
    //     TEST_CONFIG.adapterAddress
    //   );

    //   // Verify if change was applied (for instant changes only)
    //   if (currentTimelock === 0 && !TEST_CONFIG.testTimelockExecution) {
    //     const expectedStatus = TEST_CONFIG.enableAdapter;
    //     const statusMatch = isAdapter === expectedStatus;
    //     logResult(
    //       "Status verification",
    //       statusMatch,
    //       statusMatch
    //         ? "✅ Adapter status updated correctly"
    //         : "❌ Adapter status mismatch"
    //     );
    //   } else if (TEST_CONFIG.testTimelockExecution) {
    //     logResult(
    //       "Timelock execution verification",
    //       true,
    //       "Change has been applied"
    //     );
    //   } else {
    //     logResult(
    //       "Status verification",
    //       true,
    //       "Change submitted (pending timelock)"
    //     );
    //   }
    // } catch (error) {
    //   logResult(
    //     "Post-operation verification",
    //     false,
    //     `Error: ${error.message}`
    //   );
    // }

    // =============================================
    // 5. Summary
    // =============================================
    logTitle("Summary");

    console.log("📊 Operation Summary:");
    try {
      console.log(`   • Vault Address: ${TEST_CONFIG.vaultAddress}`);
      console.log(`   • Adapter Address: ${TEST_CONFIG.adapterAddress}`);
      console.log(
        `   • Requested Action: ${
          TEST_CONFIG.enableAdapter ? "Enable" : "Disable"
        }`
      );
      console.log(`   • Timelock: ${currentTimelock} seconds`);
      console.log(`   • User is Curator: ${isCurator ? "Yes" : "No"}`);
      console.log(
        `   • Test Mode: ${
          TEST_CONFIG.testTimelockExecution
            ? "Timelock Execution"
            : "Normal Setting"
        }`
      );

      if (currentTimelock === 0) {
        console.log(`   • Method Used: Instant (multicall)`);
      } else {
        console.log(`   • Method Used: Submit (requires timelock execution)`);
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
  console.log("   PRIVATE_KEY=<your_private_key> (must be vault curator)");
  console.log("");
  console.log("2. Update TEST_CONFIG in this file:");
  console.log("   - vaultAddress: your vault address");
  console.log("   - adapterAddress: adapter address to manage");
  console.log("   - enableAdapter: true to enable, false to disable");
  console.log(
    "   - testTimelockExecution: true to test executing after timelock"
  );
  console.log("");
  console.log("3. Run: node test/curators/set-adapters.test.js");
  console.log("");
  console.log("⚠️ Important: Only the vault curator can manage adapters!");
  console.log(
    "💡 Tip: Check vault timelock - if > 0, you need two transactions:"
  );
  console.log("   1. Submit the change (this test)");
  console.log("   2. Execute after timelock (set testTimelockExecution=true)");
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
  checkAdapterStatus,
  setAdapterOptimal,
  executeAdapterAfterTimelock,
  checkTimelock,
};
