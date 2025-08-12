# MetaVault SDK

A TypeScript/JavaScript SDK for interacting with MetaVault ecosystem - create, manage, and interact with decentralized yield aggregation vaults.

## About MetaVault

MetaVault is a yield aggregation protocol that allows users to create and manage vaults that automatically distribute deposits across multiple underlying yield strategies. The protocol enables:

- **Vault Creation**: Deploy custom MetaVaults with configurable sub-vault allocations
- **Deposit/Withdraw**: Seamless interaction with vault deposits and withdrawals
- **Curator Management**: Advanced vault administration and rebalancing capabilities

This SDK provides a simple interface for developers to integrate with MetaVault on:

- **Base Mainnet (Chain ID: 8453)**
- _Additional networks coming soon_

## Installation

```bash
npm install metavault-sdk
```

## Basic Setup

1. Create a `.env` file in your project root with the following variables:

```shell
RPC_URL=https://base-mainnet.infura.io/v3/your_api_key_here

# Choose ONE of the following authentication methods:
MNEMONIC=your_wallet_mnemonic
# OR
PRIVATE_KEY=your_wallet_private_key_without_0x_prefix
```

2. Import and initialize the client:

```typescript
import { ByzantineClient } from "metavault-sdk";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Initialize wallet from either mnemonic or private key
const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(provider);
// OR const wallet = new ethers.Wallet(process.env.PRIVATE_KEY).connect(provider);

const client = new ByzantineClient(provider, wallet);
```

## Quick Start - Create a MetaVault

Here's a complete example showing how to create a new MetaVault:

```js
import { ByzantineClient } from "metavault-sdk";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  // Initialize provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(
    provider
  );

  // Initialize client
  const client = new ByzantineClient(provider, wallet);

  // Define vault parameters
  const vaultParams = {
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    vaultName: "My Yield Vault",
    vaultSymbol: "MYV",
    subVaults: [
      {
        vault: "0x1234...", // First underlying vault address
        percentage: BigInt(5000), // 50% allocation (basis points)
      },
      {
        vault: "0x5678...", // Second underlying vault address
        percentage: BigInt(5000), // 50% allocation
      },
    ],
    curatorFeePercentage: BigInt(100), // 1% curator fee
  };

  try {
    // Create the MetaVault
    console.log("Creating MetaVault...");
    const tx = await client.createMetaVault(vaultParams);
    const receipt = await tx.wait();

    console.log("MetaVault created successfully!");
    console.log("Transaction hash:", receipt.hash);

    // Get the new vault address from events
    const vaultAddress = client.getVaultAddressFromReceipt(receipt);
    console.log("New vault address:", vaultAddress);
  } catch (error) {
    console.error("Error creating vault:", error);
  }
}

main();
```

## Quick Start - Deposit & Withdraw

Here's how to interact with an existing MetaVault:

```js
import { ByzantineClient } from "metavault-sdk";
import { ethers } from "ethers";

async function vaultOperations() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(
    provider
  );
  const client = new ByzantineClient(provider, wallet);

  const vaultAddress = "0x..."; // Your vault address
  const depositAmount = ethers.parseUnits("100", 6); // 100 USDC

  try {
    // Deposit into vault
    console.log("Depositing into vault...");
    const depositTx = await client.deposit(vaultAddress, depositAmount);
    await depositTx.wait();
    console.log("Deposit successful!");

    // Check vault balance
    const balance = await client.getVaultBalance(vaultAddress);
    console.log("Vault balance:", ethers.formatUnits(balance, 6));

    // Withdraw from vault
    const withdrawAmount = ethers.parseUnits("50", 6); // 50 USDC
    console.log("Withdrawing from vault...");
    const withdrawTx = await client.withdraw(vaultAddress, withdrawAmount);
    await withdrawTx.wait();
    console.log("Withdrawal successful!");
  } catch (error) {
    console.error("Error during vault operations:", error);
  }
}
```

## Available Functions

### Vault Creation & Management

```js
// Create a new MetaVault
await client.createMetaVault(params);
await client.getVaultAddressFromReceipt(receipt);
await client.getFactoryAddress();

// Vault management (curator functions)
await client.rebalanceVault(vaultAddress);
await client.updateSubVaultPercentage(
  vaultAddress,
  subVaultAddress,
  newPercentage
);
await client.addSubVault(vaultAddress, subVaultAddress, percentage);
await client.removeSubVault(vaultAddress, subVaultAddress);
await client.setCuratorFee(vaultAddress, newFeePercentage);
```

### Vault Interactions

```js
// Deposit/Withdraw operations
await client.deposit(vaultAddress, amount);
await client.withdraw(vaultAddress, amount);
await client.redeem(vaultAddress, shares);

// Vault information
await client.getVaultBalance(vaultAddress);
await client.getVaultShares(vaultAddress, userAddress);
await client.getVaultTotalAssets(vaultAddress);
await client.getVaultInfo(vaultAddress);
```

## Testing

The SDK includes comprehensive tests:

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run all tests
npm run test

# Run specific tests
npm run test:create-vault
npm run test:read-vault
npm run test:deposit-vault
```

## Supported Networks

- **Base Mainnet (Chain ID: 8453)**
- _Additional networks coming soon_

## NPM Package

This SDK will be available on npm as `metavault-sdk`.

## Security

MetaVault contracts follow industry best practices and implement comprehensive security measures including timelock mechanisms and role-based access controls.

## License

ISC
