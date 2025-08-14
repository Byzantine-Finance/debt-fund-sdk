# Debt Fund SDK

A TypeScript/JavaScript SDK for interacting with the Debt Fund ecosystem of Byzantine - create, manage, and interact with decentralized vaults.

## About Debt Fund

Debt Fund is a decentralized protocol that allows users to create and manage vaults with comprehensive role-based access control. The protocol enables:

- **Vault Creation**: Deploy new vaults with configurable parameters
- **Owner Operations**: Complete vault ownership management (roles, names, symbols)
- **Curator Management**: Advanced vault administration capabilities
- **Role Management**: Sophisticated access control with owners, curators, and sentinels

This SDK provides a simple and efficient interface for developers to integrate with Debt Fund on:

- **Base Mainnet (Chain ID: 8453)**
- _Additional networks coming soon_

## Installation

```bash
npm install byzantine/debt-fund-sdk
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
import { ByzantineClient } from "debt-fund-sdk";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Initialize wallet from either mnemonic or private key
const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(provider);
// OR const wallet = new ethers.Wallet(process.env.PRIVATE_KEY).connect(provider);

const client = new ByzantineClient(provider, wallet);
```

## Quick Start - Create a Vault

Here's a complete example showing how to create a new vault:

```js
import { ByzantineClient } from "debt-fund-sdk";
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

  try {
    // Create a new vault
    console.log("Creating vault...");
    const tx = await client.createVault(
      await wallet.getAddress(), // owner
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      "my-unique-salt-123" // unique salt for deterministic address
    );
    const receipt = await tx.wait();

    console.log("Vault created successfully!");
    console.log("Transaction hash:", receipt.hash);
    console.log("Block number:", receipt.blockNumber);
  } catch (error) {
    console.error("Error creating vault:", error);
  }
}

main();
```

## Quick Start - Vault Management

Here's how to manage an existing vault using our optimized API:

```js
import { ByzantineClient } from "debt-fund-sdk";
import { ethers } from "ethers";

async function vaultManagement() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(
    provider
  );
  const client = new ByzantineClient(provider, wallet);

  const vaultAddress = "0x..."; // Your vault address

  try {
    // OPTION 1: Traditional API (with vault address parameter)
    console.log("=== Traditional API ===");

    // Set vault name and symbol
    await client.setName(vaultAddress, "My Awesome Vault");
    await client.setSymbol(vaultAddress, "MAV");

    // Manage roles
    const curatorAddress = "0x...";
    await client.setCurator(vaultAddress, curatorAddress);

    // Check roles
    const owner = await client.getOwner(vaultAddress);
    const curator = await client.getCurator(vaultAddress);
    console.log("Owner:", owner);
    console.log("Curator:", curator);

    // OPTION 2: New VaultOwner API (recommended - no repeated vault address!)
    console.log("=== New VaultOwner API ===");

    // Get a VaultOwner instance for convenient operations
    const vault = client.vault(vaultAddress);

    // Much cleaner - no need to pass vault address every time!
    await vault.setName("My Even Better Vault");
    await vault.setSymbol("MEBV");
    await vault.setCurator(curatorAddress);

    // Set both name and symbol in a single transaction (gas efficient!)
    await vault.setNameAndSymbol("Final Vault Name", "FVN");

    // Role management without repetitive parameters
    await vault.setSentinel("0x...");
    const isOwner = await vault.getOwner();
    const isCurator = await vault.getCurator();

    console.log("Operations completed successfully!");
  } catch (error) {
    console.error("Error during vault management:", error);
  }
}
```

## Available Functions

### Vault Creation

```js
// Create a new vault
await client.createVault(owner, asset, salt);

// Get network information
await client.getNetworkConfig();
await client.getChainId();
await client.getFactoryContract();
```

### Owner Operations

```js
// Traditional API (requires vault address each time)
await client.setOwner(vaultAddress, newOwner);
await client.setCurator(vaultAddress, newCurator);
await client.setSentinel(vaultAddress, account);
await client.removeSentinel(vaultAddress, account);
await client.setName(vaultAddress, newName);
await client.setSymbol(vaultAddress, newSymbol);
await client.setNameAndSymbol(vaultAddress, newName, newSymbol);

// Read operations
await client.getOwner(vaultAddress);
await client.getCurator(vaultAddress);
await client.isSentinel(vaultAddress, account);
```

### VaultOwner API (Recommended)

```js
// Get a VaultOwner instance (creates contract once, reuses efficiently)
const vault = client.vault(vaultAddress);

// Role management (no vault address needed!)
await vault.setOwner(newOwner);
await vault.setCurator(newCurator);
await vault.setSentinel(account);
await vault.removeSentinel(account);

// Name and symbol management
await vault.setName(newName);
await vault.setSymbol(newSymbol);
await vault.setNameAndSymbol(newName, newSymbol); // Gas-efficient multicall

// Read operations
await vault.getOwner();
await vault.getCurator();
await vault.isSentinel(account);

// Utility methods
vault.getAddress(); // Get vault address
vault.getContract(); // Get ethers contract instance
```

### Advanced Usage - Direct Function Access

```js
// Import specific functions for advanced usage
import { setOwner, getOwner } from "debt-fund-sdk/clients/owners/ManageRole";
import { setName } from "debt-fund-sdk/clients/owners/NameAndSymbol";

// Get contract once, reuse for multiple operations
const vaultContract = client.getVaultContract(vaultAddress);

// Use functions directly with contract
await setOwner(vaultContract, newOwner);
await setName(vaultContract, newName);
const owner = await getOwner(vaultContract);
```

## Key Features

### 🚀 Optimized Performance

- **Efficient Contract Management**: Contract instances created once and reused
- **Gas-Efficient Operations**: Multicall support for batch operations
- **Reduced Redundancy**: No more repetitive `contractProvider.getVaultContract()` calls

### 🎯 Multiple API Styles

- **Traditional API**: Backward compatible, requires vault address parameter
- **VaultOwner API**: Modern, clean interface for single-vault operations
- **Direct Functions**: Advanced usage with direct function imports

### 🔒 Comprehensive Role Management

- **Owner Operations**: Complete vault ownership control
- **Curator Management**: Sophisticated vault administration
- **Sentinel System**: Flexible access control for multiple accounts

### ⚡ Developer Experience

- **TypeScript Support**: Full type safety and intellisense
- **Flexible Authentication**: Support for mnemonic or private key
- **Error Handling**: Comprehensive error handling and reporting

## Testing

The SDK includes comprehensive tests:

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run specific tests
node test/create-vault.test.js
node test/read-vault.test.js
node test/play-with-roles.test.js
node test/set-name-symbol.test.js
```

## Supported Networks

- **Base Mainnet (Chain ID: 8453)**
- _Additional networks coming soon_

## NPM Package

This SDK will be available on npm as `debt-fund-sdk`.

## Security

Debt Fund contracts follow industry best practices and implement comprehensive security measures including role-based access controls and timelock mechanisms for critical operations.

## License

ISC
