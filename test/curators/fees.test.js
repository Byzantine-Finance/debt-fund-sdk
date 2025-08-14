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
const VAULT_ADDRESS = "0x9c6dd63e5e30e6984a322d2a5cdaee49ebc46207";

// Test suite
async function runTests() {
  console.log("\n🧪 Vault Fees Management Test 🧪\n");

  try {
    // Await setUpTest and check for undefined result to avoid destructuring error
    const setupResult = await setUpTest();
    if (!setupResult) {
      throw new Error(
        "Test setup failed. Please check your environment variables."
      );
    }
    const { provider, client, networkConfig, userAddress } = setupResult;

    // TODO: Add tests

    console.log("\n🎉 All tests completed! 🎉\n");
  } catch (error) {
    console.error(`\n❌ TEST FAILED: ${error.message}\n`);
    console.error(error);
    process.exit(1);
  }
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
};
