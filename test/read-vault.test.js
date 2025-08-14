// @ts-check

/**
 * Vault Basic Information Reading Test
 *
 * This test demonstrates how to read basic vault information including:
 * - Owner address
 * - Curator address
 * - Vault name
 * - Vault symbol
 *
 * Uses the simplified ByzantineClient to access vault metadata.
 */

const {
  logTitle,
  logResult,
  assert,
  setUpTest,
  vaultUserInformation,
} = require("./utils");

// 🎯 CONFIGURE YOUR VAULT ADDRESS HERE
const VAULT_ADDRESS = "0x90117b13DA1deB0716B6B435146c36e3819C81Ab"; // Replace with actual Vault address

// Test suite
async function runTests() {
  console.log("\n🧪 Vault Basic Information Reading Test 🧪\n");

  try {
    // Await setUpTest and check for undefined result to avoid destructuring error
    const setupResult = await setUpTest();
    if (!setupResult) {
      throw new Error(
        "Test setup failed. Please check your environment variables."
      );
    }
    const { provider, client, networkConfig, userAddress } = setupResult;

    // =============================================
    // 2. Vault Ownership Information
    // =============================================
    vaultUserInformation(client, VAULT_ADDRESS, userAddress);

    // =============================================
    // 3. Vault Metadata Information
    // =============================================
    logTitle("Vault Metadata Information");

    try {
      // Get vault contract to read name and symbol directly
      const vaultContract = client.getVaultContract(VAULT_ADDRESS);

      // Get vault name
      const vaultName = await vaultContract.name();
      logResult("Vault Name", true, vaultName);

      // Get vault symbol
      const vaultSymbol = await vaultContract.symbol();
      logResult("Vault Symbol", true, vaultSymbol);

      // Get vault decimals
      const vaultDecimals = await vaultContract.decimals();
      logResult("Vault Decimals", true, vaultDecimals.toString());

      // Get vault asset address
      const assetAddress = await vaultContract.asset();
      logResult("Asset Address", true, assetAddress);
    } catch (error) {
      logResult("Metadata info", false, `Error: ${error.message}`);
    }

    // =============================================
    // 4. Summary
    // =============================================
    logTitle("Summary");

    console.log("📊 Vault Summary:");
    try {
      const vaultContract = client.getVaultContract(VAULT_ADDRESS);
      const owner = await client.getOwner(VAULT_ADDRESS);
      const curator = await client.getCurator(VAULT_ADDRESS);
      const vaultName = await vaultContract.name();
      const vaultSymbol = await vaultContract.symbol();
      const vaultDecimals = await vaultContract.decimals();
      const assetAddress = await vaultContract.asset();

      console.log(`   • Vault Address: ${VAULT_ADDRESS}`);
      console.log(`   • Vault Name: ${vaultName}`);
      console.log(`   • Vault Symbol: ${vaultSymbol}`);
      console.log(`   • Vault decimals: ${vaultDecimals}`);
      console.log(`   • Asset Address: ${assetAddress}`);
      console.log(`   -`);
      console.log(`   • Owner: ${owner}`);
      console.log(`   • Curator: ${curator}`);
      console.log(`   -`);

      // Check user roles
      const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
      const isCurator = curator.toLowerCase() === userAddress.toLowerCase();
      const isSentinel = await client.isSentinel(VAULT_ADDRESS, userAddress);

      console.log(`   • User is Owner: ${isOwner ? "Yes" : "No"}`);
      console.log(`   • User is Curator: ${isCurator ? "Yes" : "No"}`);
      console.log(`   • User is Sentinel: ${isSentinel ? "Yes" : "No"}`);
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
