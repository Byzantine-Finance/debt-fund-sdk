// @ts-check

/**
 * Vault Adapters Management Test
 *
 * This test demonstrates how to manage vault adapters using the CuratorsClient.
 * Only the vault curator can perform these operations.
 *
 * Features tested:
 * - Reading current adapter status
 * - Adding adapters (addAdapter)
 * - Removing adapters (removeAdapter)
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
    const vaultCurator = client.curators.vault(vaultAddress);
    const isAdapter = await vaultCurator.getIsAdapter(adapterAddress);
    const numberOfAdapters = await vaultCurator.getAdaptersLength();
    const timelock = await client.getTimelock(vaultAddress, "addAdapter");
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
  functionName = "addAdapter"
) {
  try {
    const timelockBigInt = await client.getTimelock(vaultAddress, functionName);
    const timelockSeconds = Number(timelockBigInt);
    logResult(
      `Timelock for ${functionName}`,
      true,
      `${timelockSeconds} seconds`
    );
    return timelockSeconds;
  } catch (error) {
    logResult("Check timelock", false, `Error: ${error.message}`);
    return -1;
  }
}

/**
 * Add adapter using the optimal method based on timelock
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} adapterAddress - The adapter address
 * @param {number} timelock - The current timelock value
 * @returns {Promise<{success: boolean, method: string}>}
 */
async function addAdapterOptimal(
  client,
  vaultAddress,
  adapterAddress,
  timelock
) {
  try {
    const vaultCurator = client.curators.vault(vaultAddress);
    let tx;
    let method;

    if (timelock === 0) {
      // Use instant method when timelock is 0
      console.log(`🚀 Using instant method to add adapter (timelock = 0)...`);
      tx = await vaultCurator.instantAddAdapter(adapterAddress);
      method = "instant";
    } else {
      // Use submit method when timelock > 0
      console.log(
        `⏰ Using submit method to add adapter (timelock = ${timelock}s)...`
      );
      tx = await vaultCurator.submitAddAdapter(adapterAddress);
      method = "submit";
    }

    logResult(`Add adapter transaction sent`, true, tx.hash);

    // Wait for transaction confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      logResult(`Add adapter confirmed`, true, `Block: ${receipt.blockNumber}`);
      return { success: true, method };
    } else {
      logResult(`Add adapter failed`, false, "Transaction reverted");
      return { success: false, method };
    }
  } catch (error) {
    logResult(`Add adapter`, false, `Error: ${error.message}`);
    return { success: false, method: "unknown" };
  }
}

/**
 * Remove adapter using the optimal method based on timelock
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} adapterAddress - The adapter address
 * @param {number} timelock - The current timelock value
 * @returns {Promise<{success: boolean, method: string}>}
 */
async function removeAdapterOptimal(
  client,
  vaultAddress,
  adapterAddress,
  timelock
) {
  try {
    const vaultCurator = client.curators.vault(vaultAddress);
    let tx;
    let method;

    if (timelock === 0) {
      // Use instant method when timelock is 0
      console.log(
        `🚀 Using instant method to remove adapter (timelock = 0)...`
      );
      tx = await vaultCurator.instantRemoveAdapter(adapterAddress);
      method = "instant";
    } else {
      // Use submit method when timelock > 0
      console.log(
        `⏰ Using submit method to remove adapter (timelock = ${timelock}s)...`
      );
      tx = await vaultCurator.submitRemoveAdapter(adapterAddress);
      method = "submit";
    }

    logResult(`Remove adapter transaction sent`, true, tx.hash);

    // Wait for transaction confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      logResult(
        `Remove adapter confirmed`,
        true,
        `Block: ${receipt.blockNumber}`
      );
      return { success: true, method };
    } else {
      logResult(`Remove adapter failed`, false, "Transaction reverted");
      return { success: false, method };
    }
  } catch (error) {
    logResult(`Remove adapter`, false, `Error: ${error.message}`);
    return { success: false, method: "unknown" };
  }
}

/**
 * Execute add adapter after timelock (for submitted changes)
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} adapterAddress - The adapter address
 * @returns {Promise<boolean>}
 */
async function executeAddAdapterAfterTimelock(
  client,
  vaultAddress,
  adapterAddress
) {
  try {
    console.log(`⚡ Executing add adapter after timelock...`);
    const vaultCurator = client.curators.vault(vaultAddress);
    const tx = await vaultCurator.addAdapterAfterTimelock(adapterAddress);
    logResult(`Execute add adapter transaction sent`, true, tx.hash);

    // Wait for transaction confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      logResult(
        `Execute add adapter confirmed`,
        true,
        `Block: ${receipt.blockNumber}`
      );
      return true;
    } else {
      logResult(`Execute add adapter failed`, false, "Transaction reverted");
      return false;
    }
  } catch (error) {
    logResult(`Execute add adapter`, false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Execute remove adapter after timelock (for submitted changes)
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} adapterAddress - The adapter address
 * @returns {Promise<boolean>}
 */
async function executeRemoveAdapterAfterTimelock(
  client,
  vaultAddress,
  adapterAddress
) {
  try {
    console.log(`⚡ Executing remove adapter after timelock...`);
    const vaultCurator = client.curators.vault(vaultAddress);
    const tx = await vaultCurator.removeAdapterAfterTimelock(adapterAddress);
    logResult(`Execute remove adapter transaction sent`, true, tx.hash);

    // Wait for transaction confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      logResult(
        `Execute remove adapter confirmed`,
        true,
        `Block: ${receipt.blockNumber}`
      );
      return true;
    } else {
      logResult(`Execute remove adapter failed`, false, "Transaction reverted");
      return false;
    }
  } catch (error) {
    logResult(`Execute remove adapter`, false, `Error: ${error.message}`);
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
    logResult("Timelock to addAdapter", true, timelock.toString());

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
      logTitle("Adapter is already added, remove it");
      const removeResult = await removeAdapterOptimal(
        client,
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.adapterAddress,
        timelock
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { isAdapter: isAdapterAfter } = await checkAdapterStatus(
        client,
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.adapterAddress
      );
      if (!isAdapterAfter) {
        logResult("Adapter removal", true, "Successfully removed");
      } else {
        logResult("Adapter removal", false, "Failed to remove");
      }
      return;
    } else {
      logTitle("Adapter is not added, add it");
      const addResult = await addAdapterOptimal(
        client,
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.adapterAddress,
        timelock
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { isAdapter: isAdapterAfter } = await checkAdapterStatus(
        client,
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.adapterAddress
      );
      if (isAdapterAfter) {
        logResult("Adapter addition", true, "Successfully added");
      } else {
        logResult("Adapter addition", false, "Failed to add");
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
      "addAdapter"
    );
    logResult("Current timelock", true, timelockBefore.toString());
    await client.increaseTimelock(
      TEST_CONFIG.vaultAddress,
      "addAdapter",
      BigInt(5)
    );
    const timelockAfter = await client.getTimelock(
      TEST_CONFIG.vaultAddress,
      "addAdapter"
    );
    logResult("New timelock", true, timelockAfter.toString());

    await new Promise((resolve) => setTimeout(resolve, 1000));

    logTitle("Submit add adapter with fail");
    const vaultCurator = client.curators.vault(TEST_CONFIG.vaultAddress);
    await vaultCurator.submitAddAdapter(TEST_CONFIG.adapterAddress);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      // should fail because timelock is 5s, and we are trying to execute it immediately

      const timelockAfter = await client.getTimelock(
        TEST_CONFIG.vaultAddress,
        "addAdapter"
      );
      logResult("Timelock after submit", true, timelockAfter.toString());
      await vaultCurator.addAdapterAfterTimelock(TEST_CONFIG.adapterAddress);
      logResult("Action was supposed to fail", false, "It passed");
    } catch (error) {
      logResult("Action failed", true, "It was supposed to fail");
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));

    logTitle("Execute add adapter after 5s");

    const timelockBeforeExecute = await client.getTimelock(
      TEST_CONFIG.vaultAddress,
      "addAdapter"
    );
    logResult(
      "Reading first timelock before execute",
      true,
      timelockBeforeExecute.toString()
    );
    await vaultCurator.addAdapterAfterTimelock(TEST_CONFIG.adapterAddress);
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
  console.log("");
  console.log("3. Run: node test/curators/set-adapters.test.js");
  console.log("");
  console.log("⚠️ Important: Only the vault curator can manage adapters!");
  console.log(
    "💡 Tip: Check vault timelock - if > 0, you need two transactions:"
  );
  console.log("   1. Submit the change (this test)");
  console.log("   2. Execute after timelock");
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
  addAdapterOptimal,
  removeAdapterOptimal,
  executeAddAdapterAfterTimelock,
  executeRemoveAdapterAfterTimelock,
  checkTimelock,
};
