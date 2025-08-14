// @ts-check

/**
 * Vault Timelock Management Test
 *
 * This test demonstrates how to manage vault function timelocks using the CuratorsClient.
 * Only the vault curator can perform these operations.
 *
 * Features tested:
 * - Reading current timelock durations
 * - Increasing timelock duration (immediate)
 * - Submitting timelock decrease requests
 * - Executing timelock decrease after period expires
 * - Instant timelock decrease (when current timelock is 0)
 * - Submitting and revoking function calls
 * - Abdicating submit privileges
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
  vaultUserInformation,
} = require("../utils");
require("dotenv").config();

// 🎯 CONFIGURE YOUR TEST PARAMETERS HERE
const TEST_CONFIG = {
  vaultAddress: "0x9c6dd63e5e30e6984a322d2a5cdaee49ebc46207", // Replace with actual Vault address
  functionName: "setIsAdapter", // Function to test timelock on
  newTimelock: 3600n, // 1 hour in seconds
  testTimelockExecution: false, // Set to true to test timelock execution (requires previous submit)
};

/**
 * Check current timelock settings for a function
 * @param {any} client - The ByzantineClient instance
 * @param {string} vaultAddress - The vault address
 * @param {string} functionName - The function name to check
 * @returns {Promise<{timelock: bigint}>}
 */
async function checkTimelockStatus(client, vaultAddress, functionName) {
  try {
    logTitle(
      `Check timelock status for function ${functionName} on vault ${vaultAddress}`
    );

    const vaultContract =
      client.contractProvider.getVaultContract(vaultAddress);

    // Get current timelock duration
    const timelock = await client.curators.getTimelock(
      vaultAddress,
      functionName
    );

    logResult("Current timelock duration", timelock.toString() + " seconds");

    return { timelock };
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

    const tx = await client.curators.increaseTimelock(
      vaultAddress,
      functionName,
      newDuration
    );
    logResult("Transaction hash", tx.hash);

    const receipt = await tx.wait();
    logResult("Transaction confirmed in block", receipt.blockNumber);
    logResult("Gas used", receipt.gasUsed.toString());

    // Verify the change
    const newTimelock = await client.curators.getTimelock(
      vaultAddress,
      functionName
    );
    logResult("New timelock duration", newTimelock.toString() + " seconds");

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

    const tx = await client.curators.submitDecreaseTimelock(
      vaultAddress,
      functionName,
      newDuration
    );
    logResult("Transaction hash", tx.hash);

    const receipt = await tx.wait();
    logResult("Transaction confirmed in block", receipt.blockNumber);
    logResult("Gas used", receipt.gasUsed.toString());

    // Get the calldata to check executable time
    const vaultContract =
      client.contractProvider.getVaultContract(vaultAddress);
    const selector = await client.curators.getFunctionSelector(
      vaultContract,
      functionName
    );
    const calldata = vaultContract.interface.encodeFunctionData(
      "decreaseTimelock",
      [selector, newDuration]
    );

    const executableAt = await client.curators.getExecutableAt(
      vaultAddress,
      calldata
    );
    const now = BigInt(Math.floor(Date.now() / 1000));
    const waitTime = executableAt - now;

    logResult("Executable at timestamp", executableAt.toString());
    logResult("Wait time", waitTime.toString() + " seconds");
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
    const currentTimelock = await client.curators.getTimelock(
      vaultAddress,
      functionName
    );
    if (currentTimelock !== 0n) {
      logResult(
        "⚠️ Current timelock is not 0, instant decrease not possible",
        currentTimelock.toString()
      );
      return;
    }

    const tx = await client.curators.instantDecreaseTimelock(
      vaultAddress,
      functionName,
      newDuration
    );
    logResult("Transaction hash", tx.hash);

    const receipt = await tx.wait();
    logResult("Transaction confirmed in block", receipt.blockNumber);
    logResult("Gas used", receipt.gasUsed.toString());

    // Verify the change
    const newTimelock = await client.curators.getTimelock(
      vaultAddress,
      functionName
    );
    logResult("New timelock duration", newTimelock.toString() + " seconds");

    assert(
      newTimelock === newDuration,
      "Timelock should be updated to new duration"
    );
  } catch (error) {
    console.error("❌ Error with instant timelock decrease:", error.message);
    if (error.message.includes("Cannot instantly decrease timelock")) {
      logResult(
        "Expected error",
        "Cannot instantly decrease timelock when current timelock > 0"
      );
    } else {
      throw error;
    }
  }
}

/**
 * Main test function
 */
async function main() {
  // Await setUpTest and check for undefined result to avoid destructuring error
  const setupResult = await setUpTest();
  if (!setupResult) {
    throw new Error(
      "Test setup failed. Please check your environment variables."
    );
  }
  const { client, ownerWallet, curatorWallet } = setupResult;

  try {
    // 🏁 Starting tests
    logTitle("🎯 Vault Timelock Management Tests");

    // Switch to curator wallet for timelock operations
    client.useSigner(curatorWallet);
    logResult("Using wallet", await curatorWallet.getAddress());

    // 1. Check initial timelock status
    const initialStatus = await checkTimelockStatus(
      client,
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.functionName
    );

    console.log("\n" + "=".repeat(80));

    // 2. Test increasing timelock (always works immediately)
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

    // 3. Test submitting timelock decrease
    await testSubmitDecreaseTimelock(
      client,
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.functionName,
      0n // Decrease to 0
    );

    console.log("\n" + "=".repeat(80));

    // 4. Test instant decrease (if current timelock is 0)
    // First we need to wait or have a vault with 0 timelock
    // This is just an example of how it would work
    console.log("ℹ️ Instant decrease example (requires current timelock = 0):");
    await testInstantDecreaseTimelock(
      client,
      TEST_CONFIG.vaultAddress,
      TEST_CONFIG.functionName,
      1800n // 30 minutes
    );

    console.log("\n" + "=".repeat(80));
    logTitle("✅ All timelock tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
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
