// @ts-check

/**
 * Common utilities for Byzantine Deposit SDK tests
 * Shared between simple-test.js and advanced-test.js
 */

const { ethers } = require("ethers");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Logging utilities
const logTitle = (title = "") => {
  if (title) {
    console.log(`\n===== ${title} =====`);
  }
  console.log("Test Name                                | Status | Result");
  console.log("-".repeat(70));
};

const logResult = (testName, passed, result = "") => {
  const status = passed ? "✅" : "❌";
  const paddedName = testName.padEnd(40);
  console.log(`${paddedName}| ${status}     | ${result}`);
};

// Simple test functions
const assert = (condition, message) => {
  if (!condition) {
    logResult(message, false);
    throw new Error(message);
  }
  return true;
};

const assertThrows = async (fn, message) => {
  try {
    await fn();
    logResult(message, false, "Expected function to throw");
    throw new Error(`Expected function to throw`);
  } catch (error) {
    logResult(message, true, `${error.message.substring(0, 30)}...`);
    return true;
  }
};

/**
 * Create a wallet from environment variables with optional address index
 * @param {ethers.Provider} provider - Ethers provider
 * @param {number} addressIndex - Address index for mnemonic derivation (default: 0)
 * @returns {ethers.Wallet|ethers.HDNodeWallet} Configured wallet
 */
function createWallet(provider, addressIndex = 0) {
  // Load environment variables
  require("dotenv").config();
  const { MNEMONIC, PRIVATE_KEY } = process.env;

  if (MNEMONIC) {
    if (addressIndex === 0) {
      // Use standard derivation for first address
      return ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    } else {
      // Use custom derivation for other addresses
      const baseMnemonic = ethers.Mnemonic.fromPhrase(MNEMONIC);
      const baseNode = ethers.HDNodeWallet.fromMnemonic(
        baseMnemonic,
        "m/44'/60'/0'/0"
      );
      return baseNode.deriveChild(addressIndex).connect(provider);
    }
  } else if (PRIVATE_KEY) {
    return new ethers.Wallet(PRIVATE_KEY).connect(provider);
  } else {
    throw new Error(
      "No wallet credentials provided - set MNEMONIC or PRIVATE_KEY in .env"
    );
  }
}

/**
 * Retrieve all token balances for a wallet
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} address - Wallet address to check
 * @param {object} networkConfig - Network configuration with token addresses
 * @returns {Promise<object>} Object with token balances
 */
async function getWalletBalances(provider, address, networkConfig) {
  try {
    // Get ETH balance
    const ethBalance = await provider.getBalance(address);

    const balances = {
      ETH: {
        balance: ethBalance,
        formatted: ethers.formatEther(ethBalance),
      },
    };

    // Only try to get stETH balance if the address exists in network config
    if (networkConfig.stETHAddress) {
      try {
        const stEthContract = new ethers.Contract(
          networkConfig.stETHAddress,
          ERC20_ABI,
          provider
        );
        const stEthBalance = await stEthContract.balanceOf(address);
        const stEthDecimals = await stEthContract.decimals();
        const stEthSymbol = await stEthContract.symbol();

        balances.stETH = {
          balance: stEthBalance,
          formatted: ethers.formatUnits(stEthBalance, stEthDecimals),
          symbol: stEthSymbol,
        };
      } catch (error) {
        console.warn(`⚠️ Error getting stETH balance: ${error.message}`);
        balances.stETH = { balance: 0n, formatted: "0", symbol: "stETH" };
      }
    } else {
      balances.stETH = { balance: 0n, formatted: "0", symbol: "stETH" };
    }

    // Only try to get wstETH balance if the address exists in network config
    if (networkConfig.wstETHAddress) {
      try {
        const wstEthContract = new ethers.Contract(
          networkConfig.wstETHAddress,
          ERC20_ABI,
          provider
        );
        const wstEthBalance = await wstEthContract.balanceOf(address);
        const wstEthDecimals = await wstEthContract.decimals();
        const wstEthSymbol = await wstEthContract.symbol();

        balances.wstETH = {
          balance: wstEthBalance,
          formatted: ethers.formatUnits(wstEthBalance, wstEthDecimals),
          symbol: wstEthSymbol,
        };
      } catch (error) {
        console.warn(`⚠️ Error getting wstETH balance: ${error.message}`);
        balances.wstETH = { balance: 0n, formatted: "0", symbol: "wstETH" };
      }
    } else {
      balances.wstETH = { balance: 0n, formatted: "0", symbol: "wstETH" };
    }

    return balances;
  } catch (error) {
    console.warn(`⚠️ Error getting wallet balances: ${error.message}`);
    return {
      ETH: { balance: 0n, formatted: "0" },
      stETH: { balance: 0n, formatted: "0", symbol: "stETH" },
      wstETH: { balance: 0n, formatted: "0", symbol: "wstETH" },
    };
  }
}

// Export utilities
module.exports = {
  logTitle,
  logResult,
  assert,
  assertThrows,
  getWalletBalances,
  createWallet,
};
