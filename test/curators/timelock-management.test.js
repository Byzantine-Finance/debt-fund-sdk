// @ts-check

/**
 * Vault Timelock Management Test
 *
 * This test demonstrates how to manage vault function timelocks using the ByzantineClient.
 * Only the vault curator can perform these operations.
 *
 * Features tested:
 * - Reading current timelock durations
 * - Increasing timelock duration (immediate)
 * - Submitting timelock decrease requests
 * - Checking executable timestamps
 * - Getting function selectors
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
  functionsToTest: ["addAdapter", "removeAdapter"], // Functions to test timelock on
  newTimelock: 3600n, // 1 hour in seconds
};

/**
 * Check current timelock settings for a function
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} functionName - The function name to check
 * @returns {Promise<{timelock: bigint, selector: string}>}
 */
async function checkTimelockStatus(client, vaultAddress, functionName) {
  try {
    logTitle(
      `Check timelock status for function ${functionName} on vault ${vaultAddress}`
    );

    // Get current timelock duration
    const timelock = await client.getTimelock(vaultAddress, functionName);
    logResult("Current timelock duration", `${timelock} seconds`);

    // Get function selector
    const selector = client.getTimelockFunctionSelector(functionName);
    logResult("Function selector", selector);

    return { timelock, selector };
  } catch (error) {
    console.error("❌ Error checking timelock status:", error.message);
    throw error;
  }
}

/**
 * Test increasing timelock duration (immediate effect)
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} functionName - The function name
 * @param {bigint} newDuration - New timelock duration
 */
async function testIncreaseTimelock(
  client,
  vaultAddress,
  functionName,
  newDuration
) {
  try {
    logTitle(`Increase timelock for ${functionName} to ${newDuration} seconds`);

    const tx = await client.instantIncreaseTimelock(
      vaultAddress,
      functionName,
      newDuration
    );
    logResult("Transaction hash", tx.hash);

    const receipt = await tx.wait();
    logResult("Transaction confirmed in block", receipt.blockNumber);
    logResult("Gas used", receipt.gasUsed.toString());

    // Verify the change
    const newTimelock = await client.getTimelock(vaultAddress, functionName);
    logResult("New timelock duration", `${newTimelock} seconds`);

    assert(
      newTimelock === newDuration,
      "Timelock should be updated to new duration"
    );
  } catch (error) {
    console.error("❌ Error increasing timelock:", error.message);
    throw error;
  }
}

/**
 * Test submitting a timelock decrease request
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} functionName - The function name
 * @param {bigint} newDuration - New timelock duration
 */
async function testSubmitDecreaseTimelock(
  client,
  vaultAddress,
  functionName,
  newDuration
) {
  try {
    logTitle(
      `Submit timelock decrease for ${functionName} to ${newDuration} seconds`
    );

    const tx = await client.submitDecreaseTimelock(
      vaultAddress,
      functionName,
      newDuration
    );
    logResult("Transaction hash", tx.hash);

    const receipt = await tx.wait();
    logResult("Transaction confirmed in block", receipt.blockNumber);
    logResult("Gas used", receipt.gasUsed.toString());

    // Get the calldata to check executable time
    const vaultContract = client.getVaultContract(vaultAddress);
    const selector = client.getTimelockFunctionSelector(functionName);
    const calldata = vaultContract.interface.encodeFunctionData(
      "decreaseTimelock",
      [selector, newDuration]
    );

    const executableAt = await client.getExecutableAt(vaultAddress, calldata);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const waitTime = executableAt - now;

    logResult("Executable at timestamp", executableAt.toString());
    logResult("Wait time", `${waitTime} seconds`);
  } catch (error) {
    console.error("❌ Error submitting timelock decrease:", error.message);
    throw error;
  }
}

/**
 * Test instant timelock decrease (only works when current timelock is 0)
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} functionName - The function name
 * @param {bigint} newDuration - New timelock duration
 */
async function testInstantDecreaseTimelock(
  client,
  vaultAddress,
  functionName,
  newDuration
) {
  try {
    logTitle(
      `Instant timelock decrease for ${functionName} to ${newDuration} seconds`
    );

    // Check current timelock first
    const currentTimelock = await client.getTimelock(
      vaultAddress,
      functionName
    );
    if (currentTimelock !== 0n) {
      logResult(
        "⚠️ Current timelock is not 0, instant decrease not possible",
        `${currentTimelock} seconds`
      );
      return false;
    }

    const tx = await client.instantDecreaseTimelock(
      vaultAddress,
      functionName,
      newDuration
    );
    logResult("Transaction hash", tx.hash);

    const receipt = await tx.wait();
    logResult("Transaction confirmed in block", receipt.blockNumber);
    logResult("Gas used", receipt.gasUsed.toString());

    // Verify the change
    const newTimelock = await client.getTimelock(vaultAddress, functionName);
    logResult("New timelock duration", `${newTimelock} seconds`);

    assert(
      newTimelock === newDuration,
      "Timelock should be updated to new duration"
    );
    return true;
  } catch (error) {
    console.error("❌ Error with instant timelock decrease:", error.message);
    if (error.message.includes("Cannot instantly decrease timelock")) {
      logResult(
        "Expected error",
        "Cannot instantly decrease timelock when current timelock > 0"
      );
      return false;
    } else {
      throw error;
    }
  }
}

/**
 * Main test function
 */
async function main() {
  logTitle("🎯 Vault Timelock Management Tests");

  try {
    // Await setUpTest and check for undefined result to avoid destructuring error
    const setupResult = await setUpTest();
    if (!setupResult) {
      throw new Error(
        "Test setup failed. Please check your environment variables."
      );
    }
    const { client, ownerWallet, curatorWallet } = setupResult;

    // Switch to curator wallet for timelock operations
    client.useSigner(curatorWallet);
    const curatorAddress = await curatorWallet.getAddress();
    logResult("Using curator wallet", curatorAddress);

    // Make sure we're the curator
    await client.setCurator(TEST_CONFIG.vaultAddress, curatorAddress);

    await vaultUserInformation(
      client,
      TEST_CONFIG.vaultAddress,
      curatorAddress
    );

    // 1. Check initial timelock status
    const initialStatus = await checkTimelockStatus(
      client,
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.functionName
    );

    console.log("\n" + "=".repeat(80));

    // 2. Test getting function selector
    logTitle("Test Function Selector");
    const selector = client.getTimelockFunctionSelector(
      TEST_CONFIG.functionName
    );
    logResult("Selector for " + TEST_CONFIG.functionName, selector);

    console.log("\n" + "=".repeat(80));

    // 3. Test increasing timelock (always works immediately)
    if (initialStatus.timelock < TEST_CONFIG.newTimelock) {
      await testIncreaseTimelock(
        client,
        TEST_CONFIG.vaultAddress,
        TEST_CONFIG.functionName,
        TEST_CONFIG.newTimelock
      );
    } else {
      logResult(
        "ℹ️ Skipping increase",
        "Current timelock already >= new timelock"
      );
    }

    console.log("\n" + "=".repeat(80));

    // 4. Test submitting timelock decrease
    logTitle("Test Submit Timelock Decrease");
    await testSubmitDecreaseTimelock(
      client,
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.functionName,
      1800n // Decrease to 30 minutes
    );

    console.log("\n" + "=".repeat(80));

    // 5. Test instant decrease example (will likely fail unless timelock is 0)
    logTitle("Test Instant Timelock Decrease (Example)");
    const instantSuccess = await testInstantDecreaseTimelock(
      client,
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.functionName,
      900n // 15 minutes
    );

    if (!instantSuccess) {
      console.log("ℹ️ Instant decrease failed as expected (timelock > 0)");
    }

    console.log("\n" + "=".repeat(80));
    logTitle("✅ All timelock tests completed successfully!");

    // 6. Summary
    const finalTimelock = await client.getTimelock(
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.functionName
    );
    logResult("Final timelock duration", `${finalTimelock} seconds`);
  } catch (error) {
    console.error("❌ Test failed:", error);
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
  console.log("   - functionName: function to test timelock on");
  console.log("   - newTimelock: new timelock duration to test");
  console.log("");
  console.log("3. Run: node test/curators/timelock-management.test.js");
  console.log("");
  console.log("⚠️ Important: Only the vault curator can manage timelocks!");
  console.log(
    "💡 Tip: This test will increase timelock then submit a decrease request"
  );
}

// Run the test
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Unhandled error:", error);
    process.exit(1);
  });
}

module.exports = {
  main,
  checkTimelockStatus,
  testIncreaseTimelock,
  testSubmitDecreaseTimelock,
  testInstantDecreaseTimelock,
};
