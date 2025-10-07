import { ByzantineClient } from "../src/clients/ByzantineClient";
import {
  formatUnits,
  JsonRpcProvider,
  parseUnits,
  Wallet,
  ZeroAddress,
} from "ethers";
import {
  fullReading,
  waitHalfSecond,
  RPC_URL,
  MNEMONIC,
  waitSecond,
} from "./utils/toolbox";
import { checkAndApproveIfNeeded } from "./utils/depositor";

interface VaultOperations {
  depositAmount?: bigint;
  mintAmount?: bigint;
  withdrawAmount?: bigint;
  redeemAmount?: bigint;
}

const VAULT_ADDRESS = "0x08077ad8ddca0aa4f91922d9397d48877257fdd7";

// Example configuration for deposit operations
const DEPOSIT_CONFIG: VaultOperations = {
  // depositAmount: parseUnits("0.1", 6), // 1.0 USDC (6 decimals)
  // mintAmount: parseUnits("0.5", 18), // 0.5 byzUSDC (18 decimals) - will use ~0.5 USDC
  // withdrawAmount: parseUnits("0.04", 6), // 0.3 USDC (6 decimals)
  // redeemAmount: 1198496n, // parseUnits("0.2", 18), // 0.2 byzUSDC (18 decimals) - will give ~0.2 USDC
};

async function main() {
  console.log("🚀 Start comprehensive vault operations test");
  console.log("=".repeat(60));

  try {
    const provider = new JsonRpcProvider(RPC_URL);
    const wallet = Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();
    console.log(`👤 User address: ${userAddress}`);
    console.log(`🏦 Vault address: ${VAULT_ADDRESS}`);

    // const adapterTx = await client.deployAdapter(
    //   "compoundV3",
    //   "0x08077ad8ddca0aa4f91922d9397d48877257fdd7",
    //   "0xb125E6687d4313864e53df431d5425969c15Eb2F",
    //   "0x123964802e6ABabBE1Bc9547D72Ef1B69B00A6b1"
    // );
    // await adapterTx.wait();
    // const adapterAddress = adapterTx.adapterAddress;
    // console.log(`🔍 Adapter address: ${adapterAddress}`);

    // Verify the vault exists by getting its asset
    console.log("\n🔍 Verifying vault exists...");
    const assetAddress = await client.getAsset(VAULT_ADDRESS);
    console.log(`💰 Asset address: ${assetAddress}`);

    if (!assetAddress || assetAddress === ZeroAddress) {
      throw new Error(
        "Invalid asset address returned from vault. Please provide a valid vault address."
      );
    }
    console.log("✅ Vault is valid!");

    // ========================================
    // INITIAL STATE
    // ========================================
    await fullReading(client, VAULT_ADDRESS, userAddress);

    await displayBalances(client, VAULT_ADDRESS, userAddress, "Initial");

    // ========================================
    // DEPOSIT ASSETS
    // ========================================
    if (DEPOSIT_CONFIG.depositAmount) {
      console.log(
        `💸 Depositing ${formatUnits(DEPOSIT_CONFIG.depositAmount, 6)} USDC`
      );

      // Check and approve if needed, then deposit
      await checkAndApproveIfNeeded(
        client,
        VAULT_ADDRESS,
        DEPOSIT_CONFIG.depositAmount,
        userAddress,
        "deposit"
      );

      const txDeposit = await client.deposit(
        VAULT_ADDRESS,
        DEPOSIT_CONFIG.depositAmount,
        userAddress
      );
      await waitHalfSecond();
      const receiptDeposit = await txDeposit.wait();
      console.log(
        `📤 Hash deposit: ${txDeposit.hash}, Block number: ${receiptDeposit?.blockNumber}, Gas used: ${receiptDeposit?.gasUsed}`
      );

      // Display balances after deposit
      await displayBalances(
        client,
        VAULT_ADDRESS,
        userAddress,
        "After Deposit"
      );
    }

    // ========================================
    // MINT SHARES
    // ========================================
    if (DEPOSIT_CONFIG.mintAmount) {
      console.log(
        `🪙 Minting shares for ${formatUnits(
          DEPOSIT_CONFIG.mintAmount,
          18
        )} byzUSDC`
      );

      // Check and approve if needed, then mint
      await checkAndApproveIfNeeded(
        client,
        VAULT_ADDRESS,
        DEPOSIT_CONFIG.mintAmount, // This is in shares, the function will calculate assets needed
        userAddress,
        "mint"
      );

      const txMint = await client.mint(
        VAULT_ADDRESS,
        DEPOSIT_CONFIG.mintAmount,
        userAddress
      );
      await waitHalfSecond();
      const receiptMint = await txMint.wait();
      console.log(
        `📤 Hash mint: ${txMint.hash}, Block number: ${receiptMint?.blockNumber}, Gas used: ${receiptMint?.gasUsed}`
      );

      // Display balances after mint
      await displayBalances(client, VAULT_ADDRESS, userAddress, "After Mint");
    }

    // ========================================
    // WITHDRAW ASSETS
    // ========================================
    if (DEPOSIT_CONFIG.withdrawAmount) {
      console.log(
        `💸 Withdrawing ${formatUnits(DEPOSIT_CONFIG.withdrawAmount, 6)} USDC`
      );

      // Check if we have enough shares to withdraw
      const sharesBeforeWithdraw = await client.getSharesBalance(
        VAULT_ADDRESS,
        userAddress
      );
      console.log(
        `   📊 Current shares balance: ${formatUnits(
          sharesBeforeWithdraw,
          18
        )} byzUSDC`
      );

      // Perform withdraw (no approval needed for shares)
      const txWithdraw = await client.withdraw(
        VAULT_ADDRESS,
        DEPOSIT_CONFIG.withdrawAmount,
        userAddress,
        userAddress
      );
      await waitHalfSecond();
      const receiptWithdraw = await txWithdraw.wait();
      console.log(
        `📤 Hash withdraw: ${txWithdraw.hash}, Block number: ${receiptWithdraw?.blockNumber}, Gas used: ${receiptWithdraw?.gasUsed}`
      );

      // Display balances after withdraw
      await displayBalances(
        client,
        VAULT_ADDRESS,
        userAddress,
        "After Withdraw"
      );
    }

    // ========================================
    // REDEEM SHARES
    // ========================================
    if (DEPOSIT_CONFIG.redeemAmount) {
      console.log(
        `🔄 Redeeming shares for ${formatUnits(
          DEPOSIT_CONFIG.redeemAmount,
          18
        )} byzUSDC`
      );

      // Check if we have enough shares to redeem
      const sharesBeforeRedeem = await client.getSharesBalance(
        VAULT_ADDRESS,
        userAddress
      );
      console.log(
        `   📊 Current shares balance: ${formatUnits(
          sharesBeforeRedeem,
          18
        )} byzUSDC`
      );

      if (sharesBeforeRedeem < DEPOSIT_CONFIG.redeemAmount) {
        throw new Error(
          `Insufficient shares for redeem. Have: ${formatUnits(
            sharesBeforeRedeem,
            18
          )} byzUSDC, Need: ${formatUnits(
            DEPOSIT_CONFIG.redeemAmount,
            18
          )} byzUSDC`
        );
      }

      // Perform redeem
      const txRedeem = await client.redeem(
        VAULT_ADDRESS,
        DEPOSIT_CONFIG.redeemAmount,
        userAddress,
        userAddress
      );
      await waitHalfSecond();
      const receiptRedeem = await txRedeem.wait();
      console.log(
        `📤 Hash redeem: ${txRedeem.hash}, Block number: ${receiptRedeem?.blockNumber}, Gas used: ${receiptRedeem?.gasUsed}`
      );

      // Display balances after redeem
      await displayBalances(client, VAULT_ADDRESS, userAddress, "After Redeem");
    }
    // ========================================
    // FINAL STATE
    // ========================================

    await fullReading(client, VAULT_ADDRESS, userAddress);

    console.log("\n🎉 All vault operations completed successfully!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Error in vault operations test:", error);
  }
}

// Helper function to display balances
async function displayBalances(
  client: ByzantineClient,
  vaultAddress: string,
  userAddress: string,
  stage: string
) {
  console.log(`\n📊 ${stage} Balances:`);
  console.log("─".repeat(40));

  try {
    const sharesBalance = await client.getSharesBalance(
      vaultAddress,
      userAddress
    );
    const usdcBalance = await client.getAssetBalance(vaultAddress, userAddress);
    const currentAllowance = await client.getAssetAllowance(
      vaultAddress,
      userAddress
    );

    console.log(
      `   🪙 Shares:     ${sharesBalance
        .toString()
        .padStart(20)} -> ${formatUnits(sharesBalance, 18)} byzUSDC`
    );
    console.log(
      `   💰 USDC:       ${usdcBalance
        .toString()
        .padStart(20)} -> ${formatUnits(usdcBalance, 6)} USDC`
    );
    console.log(
      `   🔓 Allowance:  ${currentAllowance
        .toString()
        .padStart(20)} -> ${formatUnits(currentAllowance, 6)} USDC`
    );
    console.log("-".repeat(60), "\n\n");
  } catch (error) {
    console.log(`   ❌ Error getting balances: ${error}`);
  }
}

main();
