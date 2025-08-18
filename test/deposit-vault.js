// /**
//  * MetaVault Deposit Test
//  *
//  * This test demonstrates how to approve and deposit USDC into a MetaVault
//  * using the Byzantine SDK Client. It covers the complete deposit workflow
//  * including token approval and actual deposit execution.
//  *
//  * Tests included:
//  * 1. Initialize the Byzantine client
//  * 2. Check user's USDC balance
//  * 3. Approve the vault to spend USDC
//  * 4. Deposit 0.5 USDC into the vault
//  * 5. Verify the deposit was successful
//  */

// const { ethers } = require("ethers");
// const { ByzantineClient, getNetworkConfig } = require("../dist");
// const { logTitle, logResult, assert, createWallet } = require("./utils");
// require("dotenv").config();

// // 🎯 CONFIGURE YOUR VAULT ADDRESS HERE
// const VAULT_ADDRESS = "0xB989B2AFf5aC29318E32B0F3Ef708e6Ee6E91ea6"; // Replace with actual MetaVault address

// // Amount to deposit (0.5 USDC)
// const DEPOSIT_AMOUNT = ethers.parseUnits("0.5", 6); // USDC has 6 decimals

// // ERC20 ABI for token operations
// const ERC20_ABI = [
//   "function balanceOf(address owner) view returns (uint256)",
//   "function approve(address spender, uint256 amount) returns (bool)",
//   "function allowance(address owner, address spender) view returns (uint256)",
//   "function decimals() view returns (uint8)",
//   "function symbol() view returns (string)",
// ];

// // Test suite
// async function runDepositTest() {
//   console.log("\n🧪 MetaVault Deposit Test 🧪\n");

//   try {
//     // Check if environment variables are set
//     const { RPC_URL, MNEMONIC, PRIVATE_KEY, DEFAULT_CHAIN_ID } = process.env;
//     const chainId = DEFAULT_CHAIN_ID ? parseInt(DEFAULT_CHAIN_ID) : 11155111; // Default to Sepolia

//     if (!RPC_URL) {
//       throw new Error(
//         "RPC_URL not set in .env file. Cannot proceed with deposit test."
//       );
//     }

//     if (!MNEMONIC && !PRIVATE_KEY) {
//       throw new Error(
//         "Neither MNEMONIC nor PRIVATE_KEY set in .env file. Cannot proceed with deposit test."
//       );
//     }

//     console.log(
//       `Network: ${
//         chainId === 1
//           ? "Ethereum Mainnet"
//           : chainId === 8453
//           ? "Base Mainnet"
//           : chainId === 11155111
//           ? "Ethereum Sepolia"
//           : "Unknown"
//       } (Chain ID: ${chainId})\n`
//     );

//     console.log(`🏦 Vault Address: ${VAULT_ADDRESS}`);
//     console.log(
//       `💰 Deposit Amount: ${ethers.formatUnits(DEPOSIT_AMOUNT, 6)} USDC\n`
//     );

//     // Initialize provider and wallet
//     const provider = new ethers.JsonRpcProvider(RPC_URL);
//     const wallet = createWallet(provider, 0);
//     const userAddress = await wallet.getAddress();

//     // Get network configuration
//     const networkConfig = getNetworkConfig(/** @type {any} */ (chainId));
//     if (!networkConfig || !networkConfig.USDCaddress) {
//       throw new Error(`USDC not available on chain ${chainId}`);
//     }

//     const usdcAddress = networkConfig.USDCaddress;
//     console.log(`💵 USDC Address: ${usdcAddress}`);
//     console.log(`👤 User Address: ${userAddress}\n`);

//     // Initialize the Byzantine client
//     const client = new ByzantineClient(
//       /** @type {any} */ (provider),
//       /** @type {any} */ (wallet)
//     );

//     // Initialize vault-specific clients
//     client.initializeVaultClients(VAULT_ADDRESS);
//     logResult("Client initialization", true);

//     // Create USDC contract instance
//     const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, wallet);

//     // =============================================
//     // 1. Check User's USDC Balance
//     // =============================================
//     logTitle("Pre-Deposit Checks");

//     const userUsdcBalance = await usdcContract.balanceOf(userAddress);
//     const usdcSymbol = await usdcContract.symbol();
//     const usdcDecimals = await usdcContract.decimals();

//     console.log(
//       `💰 Your ${usdcSymbol} balance: ${ethers.formatUnits(
//         userUsdcBalance,
//         usdcDecimals
//       )} ${usdcSymbol}`
//     );

//     if (userUsdcBalance < DEPOSIT_AMOUNT) {
//       throw new Error(
//         `Insufficient USDC balance. Required: ${ethers.formatUnits(
//           DEPOSIT_AMOUNT,
//           usdcDecimals
//         )} ${usdcSymbol}, Available: ${ethers.formatUnits(
//           userUsdcBalance,
//           usdcDecimals
//         )} ${usdcSymbol}`
//       );
//     }
//     logResult(
//       "USDC balance check",
//       true,
//       `${ethers.formatUnits(
//         userUsdcBalance,
//         usdcDecimals
//       )} ${usdcSymbol} available`
//     );

//     // Check current allowance
//     const currentAllowance = await usdcContract.allowance(
//       userAddress,
//       VAULT_ADDRESS
//     );
//     console.log(
//       `📝 Current allowance: ${ethers.formatUnits(
//         currentAllowance,
//         usdcDecimals
//       )} ${usdcSymbol}`
//     );

//     // Get vault information
//     const vaultAsset = await client.asset();
//     if (vaultAsset.toLowerCase() !== usdcAddress.toLowerCase()) {
//       throw new Error(
//         `Vault asset mismatch. Expected: ${usdcAddress}, Got: ${vaultAsset}`
//       );
//     }
//     logResult("Vault asset verification", true, `Vault uses ${usdcSymbol}`);

//     // Preview deposit
//     const expectedShares = await client.previewDeposit(DEPOSIT_AMOUNT);
//     logResult(
//       "Deposit preview",
//       true,
//       `${ethers.formatEther(expectedShares)} shares expected`
//     );

//     // =============================================
//     // 2. Approve USDC Spending
//     // =============================================
//     logTitle("Token Approval");

//     if (currentAllowance < DEPOSIT_AMOUNT) {
//       console.log(
//         `🔐 Approving vault to spend ${ethers.formatUnits(
//           DEPOSIT_AMOUNT,
//           usdcDecimals
//         )} ${usdcSymbol}...`
//       );

//       const approveTx = await usdcContract.approve(
//         VAULT_ADDRESS,
//         DEPOSIT_AMOUNT
//       );
//       console.log(`📝 Approval transaction: ${approveTx.hash}`);

//       const approveReceipt = await approveTx.wait();
//       if (approveReceipt?.status === 1) {
//         logResult(
//           "USDC approval",
//           true,
//           `Transaction confirmed in block ${approveReceipt.blockNumber}`
//         );
//       } else {
//         throw new Error("Approval transaction failed");
//       }

//       // Verify allowance
//       const newAllowance = await usdcContract.allowance(
//         userAddress,
//         VAULT_ADDRESS
//       );
//       if (newAllowance >= DEPOSIT_AMOUNT) {
//         logResult(
//           "Allowance verification",
//           true,
//           `${ethers.formatUnits(
//             newAllowance,
//             usdcDecimals
//           )} ${usdcSymbol} approved`
//         );
//       } else {
//         throw new Error("Allowance verification failed");
//       }
//     } else {
//       logResult("USDC approval", true, "Sufficient allowance already exists");
//     }

//     // =============================================
//     // 3. Perform Deposit
//     // =============================================
//     logTitle("Vault Deposit");

//     // Get pre-deposit balances
//     const preDepositUsdcBalance = await usdcContract.balanceOf(userAddress);
//     const preDepositShares = await client.balanceOf(userAddress);
//     const preDepositVaultTvl = await client.totalAssets();

//     console.log(`📊 Pre-deposit state:`);
//     console.log(
//       `   • Your ${usdcSymbol}: ${ethers.formatUnits(
//         preDepositUsdcBalance,
//         usdcDecimals
//       )} ${usdcSymbol}`
//     );
//     console.log(
//       `   • Your shares: ${ethers.formatEther(preDepositShares)} shares`
//     );
//     console.log(
//       `   • Vault TVL: ${ethers.formatUnits(
//         preDepositVaultTvl,
//         usdcDecimals
//       )} ${usdcSymbol}\n`
//     );

//     console.log(
//       `💰 Depositing ${ethers.formatUnits(
//         DEPOSIT_AMOUNT,
//         usdcDecimals
//       )} ${usdcSymbol}...`
//     );

//     const depositTx = await client.deposit(DEPOSIT_AMOUNT, userAddress);
//     console.log(`📝 Deposit transaction: ${depositTx.hash}`);

//     const depositReceipt = await depositTx.wait();
//     if (depositReceipt?.status === 1) {
//       logResult(
//         "Deposit execution",
//         true,
//         `Transaction confirmed in block ${depositReceipt.blockNumber}`
//       );
//     } else {
//       throw new Error("Deposit transaction failed");
//     }

//     // =============================================
//     // 4. Verify Deposit Results
//     // =============================================
//     logTitle("Post-Deposit Verification");

//     // Get post-deposit balances
//     const postDepositUsdcBalance = await usdcContract.balanceOf(userAddress);
//     const postDepositShares = await client.balanceOf(userAddress);
//     const postDepositVaultTvl = await client.totalAssets();

//     console.log(`📊 Post-deposit state:`);
//     console.log(
//       `   • Your ${usdcSymbol}: ${ethers.formatUnits(
//         postDepositUsdcBalance,
//         usdcDecimals
//       )} ${usdcSymbol}`
//     );
//     console.log(
//       `   • Your shares: ${ethers.formatEther(postDepositShares)} shares`
//     );
//     console.log(
//       `   • Vault TVL: ${ethers.formatUnits(
//         postDepositVaultTvl,
//         usdcDecimals
//       )} ${usdcSymbol}\n`
//     );

//     // Calculate changes
//     const usdcSpent = preDepositUsdcBalance - postDepositUsdcBalance;
//     const sharesReceived = postDepositShares - preDepositShares;
//     const tvlIncrease = postDepositVaultTvl - preDepositVaultTvl;

//     // Verify deposit amount
//     if (usdcSpent === DEPOSIT_AMOUNT) {
//       logResult(
//         "USDC deduction",
//         true,
//         `${ethers.formatUnits(usdcSpent, usdcDecimals)} ${usdcSymbol} deducted`
//       );
//     } else {
//       logResult(
//         "USDC deduction",
//         false,
//         `Expected: ${ethers.formatUnits(
//           DEPOSIT_AMOUNT,
//           usdcDecimals
//         )}, Actual: ${ethers.formatUnits(usdcSpent, usdcDecimals)}`
//       );
//     }

//     // Verify shares received
//     if (sharesReceived > 0n) {
//       logResult(
//         "Shares received",
//         true,
//         `${ethers.formatEther(sharesReceived)} shares minted`
//       );
//     } else {
//       logResult("Shares received", false, "No shares received");
//     }

//     // Verify TVL increase
//     if (tvlIncrease > 0n) {
//       logResult(
//         "Vault TVL increase",
//         true,
//         `+${ethers.formatUnits(tvlIncrease, usdcDecimals)} ${usdcSymbol}`
//       );
//     } else {
//       logResult("Vault TVL increase", false, "TVL did not increase");
//     }

//     // Calculate actual vs expected shares
//     const shareDifference =
//       sharesReceived > expectedShares
//         ? sharesReceived - expectedShares
//         : expectedShares - sharesReceived;
//     const shareTolerancePercent = (shareDifference * 100n) / expectedShares;

//     if (shareTolerancePercent <= 5n) {
//       // 5% tolerance
//       logResult(
//         "Share amount accuracy",
//         true,
//         `Within 5% of preview (${ethers.formatEther(
//           sharesReceived
//         )} vs ${ethers.formatEther(expectedShares)})`
//       );
//     } else {
//       logResult(
//         "Share amount accuracy",
//         false,
//         `Significant difference from preview (${ethers.formatEther(
//           sharesReceived
//         )} vs ${ethers.formatEther(expectedShares)})`
//       );
//     }

//     // =============================================
//     // 5. Summary
//     // =============================================
//     logTitle("Deposit Summary");

//     console.log("✅ Deposit completed successfully!");
//     console.log(`📈 Summary:`);
//     console.log(
//       `   • Deposited: ${ethers.formatUnits(
//         DEPOSIT_AMOUNT,
//         usdcDecimals
//       )} ${usdcSymbol}`
//     );
//     console.log(`   • Received: ${ethers.formatEther(sharesReceived)} shares`);
//     console.log(
//       `   • Share price: ${ethers.formatUnits(
//         (DEPOSIT_AMOUNT * ethers.parseEther("1")) / sharesReceived,
//         usdcDecimals
//       )} ${usdcSymbol} per share`
//     );
//     console.log(`   • Gas used: ${depositReceipt?.gasUsed?.toString()} units`);
//     console.log(`   • Transaction hash: ${depositTx.hash}`);

//     // Calculate the value of received shares
//     const shareValue = await client.convertToAssets(sharesReceived);
//     console.log(
//       `   • Current share value: ${ethers.formatUnits(
//         shareValue,
//         usdcDecimals
//       )} ${usdcSymbol}`
//     );

//     console.log("\n🎉 Deposit test completed successfully! 🎉\n");
//   } catch (error) {
//     console.error(`\n❌ DEPOSIT TEST FAILED: ${error.message}\n`);
//     console.error(error);
//     process.exit(1);
//   }
// }

// // Instructions for usage
// if (!process.env.RPC_URL) {
//   console.log("📋 To run this deposit test:");
//   console.log("1. Create a .env file with:");
//   console.log("   RPC_URL=<your_rpc_endpoint>");
//   console.log("   PRIVATE_KEY=<your_private_key> (with USDC balance)");
//   console.log("   DEFAULT_CHAIN_ID=11155111 (for Sepolia)");
//   console.log("");
//   console.log("2. Ensure you have at least 0.5 USDC in your wallet");
//   console.log("3. Update VAULT_ADDRESS constant in this file");
//   console.log("4. Run: node test/deposit-vault.js");
//   console.log("");
//   console.log("⚠️ Warning: This test will spend real USDC from your wallet!");
//   console.log("");
// }

// // Run test if file is executed directly
// if (require.main === module) {
//   runDepositTest()
//     .then(() => process.exit(0))
//     .catch((error) => {
//       console.error("Deposit test failed:", error);
//       process.exit(1);
//     });
// }

// module.exports = { runDepositTest };
