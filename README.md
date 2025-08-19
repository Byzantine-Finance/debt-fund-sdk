# Debt Fund SDK

A TypeScript/JavaScript SDK for interacting with the Debt Fund ecosystem of Byzantine - create, manage, and interact with decentralized vaults.

## About Debt Fund

Debt Fund is a decentralized protocol that allows users to create and manage vaults with comprehensive role-based access control and sophisticated parameter management. The protocol enables:

- **Vault Creation**: Deploy new vaults with deterministic addresses and configurable parameters
- **Owner Operations**: Complete vault ownership management (roles, metadata, access control)
- **Curator Management**: Advanced vault administration with fee management, adapter configuration, and timelock controls
- **Adapter Management**: Deploy and manage Morpho Vault V1 and Market V1 adapters for underlying protocols
- **Timelock System**: Secure parameter changes with customizable delays for critical operations
- **Role Management**: Sophisticated access control with owners, curators, sentinels, and allocators

This SDK provides a comprehensive interface for developers to integrate with Debt Fund on:

- **Base Mainnet (Chain ID: 8453)**
- **Ethereum Sepolia (Chain ID: 11155111)** - for testing
- _Additional networks coming soon_

## Installation

```bash
npm install @byzantine/debt-fund-sdk
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
import { ByzantineClient } from "@byzantine/debt-fund-sdk";
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
import { ByzantineClient } from "@byzantine/debt-fund-sdk";
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

Here's how to manage an existing vault:

```js
import { ByzantineClient } from "@byzantine/debt-fund-sdk";
import { ethers } from "ethers";

async function vaultManagement() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(
    provider
  );
  const client = new ByzantineClient(provider, wallet);

  const vaultAddress = "0x..."; // Your vault address

  try {
    // Owner Operations
    console.log("=== Owner Operations ===");

    // Set vault shares name and symbol
    await client.setSharesName(vaultAddress, "My Awesome Vault");
    await client.setSharesSymbol(vaultAddress, "MAV");

    // Or set both in a single transaction (gas efficient!)
    await client.setSharesNameAndSymbol(vaultAddress, "My Vault", "MVT");

    // Manage roles
    const curatorAddress = "0x...";
    await client.setCurator(vaultAddress, curatorAddress);
    await client.setIsSentinel(vaultAddress, "0x...", true);

    // Check roles
    const owner = await client.getOwner(vaultAddress);
    const curator = await client.getCurator(vaultAddress);
    const isSentinel = await client.isSentinel(vaultAddress, "0x...");
    console.log("Owner:", owner);
    console.log("Curator:", curator);
    console.log("Is Sentinel:", isSentinel);

    // Curator Operations
    console.log("=== Curator Operations ===");

    // Fee management
    await client.instantSetPerformanceFee(
      vaultAddress,
      ethers.parseEther("0.1")
    ); // 10%
    await client.instantSetManagementFee(
      vaultAddress,
      ethers.parseEther("0.02") / 31536000n
    ); // 2% per year
    await client.instantSetPerformanceFeeRecipient(vaultAddress, "0x...");

    // Adapter management
    await client.instantSetIsAdapter(vaultAddress, "0x...", true);

    // Deploy and manage Morpho adapters
    const morphoVaultAddress = "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A";
    const adapterTx = await client.deployMorphoVaultV1Adapter(
      vaultAddress,
      morphoVaultAddress
    );
    const adapterReceipt = await adapterTx.wait();
    console.log("Deployed adapter:", adapterTx.adapterAddress);

    // Add the adapter to the vault
    await client.instantSetIsAdapter(
      vaultAddress,
      adapterTx.adapterAddress,
      true
    );

    // Get fee information
    const performanceFee = await client.getPerformanceFee(vaultAddress);
    const managementFee = await client.getManagementFee(vaultAddress);
    console.log("Performance Fee:", performanceFee);
    console.log("Management Fee:", managementFee);

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
await client.getVaultFactoryContract();
```

### Owner Operations

```js
// Role management
await client.setOwner(vaultAddress, newOwner);
await client.setCurator(vaultAddress, newCurator);
await client.setIsSentinel(vaultAddress, account, true); // true = add, false = remove

// Vault metadata
await client.setSharesName(vaultAddress, newName);
await client.setSharesSymbol(vaultAddress, newSymbol);
await client.setSharesNameAndSymbol(vaultAddress, newName, newSymbol); // Gas-efficient multicall

// Read operations
await client.getOwner(vaultAddress);
await client.getCurator(vaultAddress);
await client.isSentinel(vaultAddress, account);
await client.getVaultName(vaultAddress);
await client.getVaultSymbol(vaultAddress);
await client.getAsset(vaultAddress);
```

### Curator Operations

#### Fee Management

```js
// Fee recipients (You need to set the address of the recipient before setting the fee)
await client.submitPerformanceFeeRecipient(vaultAddress, recipient);
await client.setPerformanceFeeRecipientAfterTimelock(vaultAddress, recipient);
await client.instantSetPerformanceFeeRecipient(vaultAddress, recipient); // Gas-efficient with multicall when 0 timelock
await client.getPerformanceFeeRecipient(vaultAddress);

await client.submitManagementFeeRecipient(vaultAddress, recipient);
await client.setManagementFeeRecipientAfterTimelock(vaultAddress, recipient);
await client.instantSetManagementFeeRecipient(vaultAddress, recipient); // Gas-efficient with multicall when 0 timelock
await client.getManagementFeeRecipient(vaultAddress);

// Performance Fee
await client.submitPerformanceFee(vaultAddress, fee);
await client.setPerformanceFeeAfterTimelock(vaultAddress, fee);
await client.instantSetPerformanceFee(vaultAddress, fee); // Gas-efficient with multicall when 0 timelock
await client.getPerformanceFee(vaultAddress);

// Management Fee
await client.submitManagementFee(vaultAddress, fee);
await client.setManagementFeeAfterTimelock(vaultAddress, fee);
await client.instantSetManagementFee(vaultAddress, fee); // Gas-efficient with multicall when 0 timelock
await client.getManagementFee(vaultAddress);

// Force deallocate penalty
await client.submitForceDeallocatePenalty(vaultAddress, adapter, penalty);
await client.setForceDeallocatePenaltyAfterTimelock(
  vaultAddress,
  adapter,
  penalty
);
await client.instantSetForceDeallocatePenalty(vaultAddress, adapter, penalty); // Gas-efficient with multicall when 0 timelock
await client.getForceDeallocatePenalty(vaultAddress, adapter);
```

#### Max Rate Management

```js
// Max rate
await client.submitMaxRate(vaultAddress, maxRate);
await client.setMaxRateAfterTimelock(vaultAddress, maxRate);
await client.instantSetMaxRate(vaultAddress, maxRate); // Gas-efficient with multicall when 0 timelock
await client.getMaxRate(vaultAddress);
```

#### Allocator Management

```js
// Submit allocator for timelock
await client.submitIsAllocator(vaultAddress, account, isAllocator);
await client.setIsAllocatorAfterTimelock(vaultAddress, account, isAllocator);
await client.instantSetIsAllocator(vaultAddress, account, isAllocator); // Gas-efficient when timelock = 0

// Check allocator status
await client.getIsAllocator(vaultAddress, account);
await client.isAllocator(vaultAddress, account);
```

#### Adapter Management

```js
// Generic adapter deployment and management
const adapterTx = await client.deployAdapter(
  "morphoVaultV1", // or "morphoMarketV1"
  vaultAddress,
  underlyingAddress
);
const adapterAddress = adapterTx.adapterAddress;

// Find existing adapters
const existingAdapter = await client.findAdapter(
  "morphoVaultV1", // or "morphoMarketV1"
  vaultAddress,
  underlyingAddress
);

// Check adapter types
const isVaultAdapter = await client.isAdapter("morphoVaultV1", account);
const isMarketAdapter = await client.isAdapter("morphoMarketV1", account);

// Adapter configuration in vault
await client.submitIsAdapter(vaultAddress, adapter, true);
await client.setIsAdapterAfterTimelock(vaultAddress, adapter, true);
await client.instantSetIsAdapter(vaultAddress, adapter, true); // Gas-efficient with multicall when 0 timelock

// Query adapter status
await client.getIsAdapter(vaultAddress, adapter);
await client.getAdaptersLength(vaultAddress);
await client.getAdapterByIndex(vaultAddress, 0);

// Get adapter information
await client.getIdsAdapterVaultV1(adapterAddress);
await client.getIdsAdapterMarketV1(adapterAddress, marketParams);
await client.getUnderlyingVaultFromAdapterV1(adapterAddress);
await client.getUnderlyingMarketFromAdapterV1(adapterAddress);
```

#### Cap Management

```js
// Absolute Cap
await client.submitIncreaseAbsoluteCap(vaultAddress, idData, newAbsoluteCap);
await client.setIncreaseAbsoluteCapAfterTimelock(
  vaultAddress,
  idData,
  newAbsoluteCap
);
await client.instantIncreaseAbsoluteCap(vaultAddress, idData, newAbsoluteCap); // Gas-efficient when timelock = 0
await client.decreaseAbsoluteCap(vaultAddress, idData, newAbsoluteCap);
await client.getAbsoluteCap(vaultAddress, id);

// Relative Cap
await client.submitIncreaseRelativeCap(vaultAddress, idData, newRelativeCap);
await client.setIncreaseRelativeCapAfterTimelock(
  vaultAddress,
  idData,
  newRelativeCap
);
await client.instantIncreaseRelativeCap(vaultAddress, idData, newRelativeCap); // Gas-efficient when timelock = 0
await client.decreaseRelativeCap(vaultAddress, idData, newRelativeCap);
await client.getRelativeCap(vaultAddress, id);
```

#### Timelock Management

```js
// Timelock operations
await client.getTimelock(vaultAddress, functionName);
await client.getExecutableAt(vaultAddress, data);
await client.increaseTimelock(vaultAddress, functionName, newDuration);
await client.submitDecreaseTimelock(vaultAddress, functionName, newDuration);
await client.setDecreaseTimelockAfterTimelock(
  vaultAddress,
  functionName,
  newDuration
);
await client.instantDecreaseTimelock(vaultAddress, functionName, newDuration); // Gas-efficient with multicall when 0 timelock

// Submit and revoke operations
await client.submit(vaultAddress, data);
await client.revoke(vaultAddress, functionName, params);
await client.abdicateSubmit(vaultAddress, functionName);

// Utility
client.getTimelockFunctionSelector(functionName);
```

## Complete Adapter Management Example

Here's a comprehensive example showing how to set up adapters for underlying protocols:

```js
import { ByzantineClient } from "@byzantine/debt-fund-sdk";
import { ethers } from "ethers";

async function setupAdapters() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(
    provider
  );
  const client = new ByzantineClient(provider, wallet);

  const vaultAddress = "0x..."; // Your vault address

  // Define underlying protocols to integrate
  const morphoVaults = [
    "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A", // Spark Morpho vault
    "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738", // Seamless Morpho vault
  ];

  try {
    console.log("🚀 Setting up vault adapters...");

    // Deploy adapters for each underlying vault
    for (const underlyingVault of morphoVaults) {
      console.log(`Processing underlying vault: ${underlyingVault}`);

      // Check if adapter already exists
      let adapterAddress;
      try {
        adapterAddress = await client.findMorphoVaultV1Adapter(
          vaultAddress,
          underlyingVault
        );
        console.log(`Found existing adapter: ${adapterAddress}`);
      } catch (error) {
        console.log("No existing adapter found, creating new one...");

        // Deploy new adapter
        const adapterTx = await client.deployMorphoVaultV1Adapter(
          vaultAddress,
          underlyingVault
        );
        await adapterTx.wait();
        adapterAddress = adapterTx.adapterAddress;
        console.log(`Deployed new adapter: ${adapterAddress}`);
      }

      // Add adapter to vault (if not already added)
      const isAdapter = await client.getIsAdapter(vaultAddress, adapterAddress);
      if (!isAdapter) {
        console.log("Adding adapter to vault...");
        await client.instantSetIsAdapter(vaultAddress, adapterAddress, true);
        console.log("✅ Adapter added to vault");
      } else {
        console.log("✅ Adapter already configured in vault");
      }
    }

    // Display final adapter configuration
    const adaptersLength = await client.getAdaptersLength(vaultAddress);
    console.log(`\n📊 Vault has ${adaptersLength} adapters configured:`);

    for (let i = 0; i < adaptersLength; i++) {
      const adapter = await client.getAdapterByIndex(vaultAddress, i);
      console.log(`  ${i + 1}. ${adapter}`);
    }

    console.log("\n🎉 Adapter setup completed successfully!");
  } catch (error) {
    console.error("❌ Error setting up adapters:", error);
  }
}

setupAdapters();
```

## Key Features

### 🚀 Comprehensive Vault Management

- **Vault Creation**: Deploy new vaults with deterministic addresses
- **Owner Operations**: Complete vault ownership and metadata control
- **Curator Management**: Advanced fee management and adapter configuration
- **Adapter Ecosystem**: Deploy and manage Morpho Vault V1 and Market V1 adapters
- **Timelock System**: Secure parameter changes with customizable delays

### ⚡ Optimized Performance

- **Gas-Efficient Operations**: Multicall wrappers for instant operations when timelock = 0
- **Contract Instance Caching**: Contract instances created once and reused
- **Reduced Redundancy**: No repetitive contract provider calls
- **Batch Operations**: Support for multiple operations in single transaction
- **Adapter Deployment**: Efficient adapter creation and integration workflows

### 🎯 Three-Tier Timelock Operation System

Most sensitive vault operations require a timelock mechanism for security. To make this easy to use, we provide three wrapper functions for each timelocked operation:

#### 1. `submit<FunctionName>()`

Submits a parameter change proposal that must wait for the timelock delay before execution.

```js
await client.submitPerformanceFee(vaultAddress, newFee);
// Must wait for timelock delay before execution
```

#### 2. `set<FunctionName>AfterTimelock()`

Executes a previously submitted change after the timelock delay has passed.

```js
await client.setPerformanceFeeAfterTimelock(vaultAddress, newFee);
// Executes the change that was submitted earlier
```

#### 3. `instant<FunctionName>()`

**Gas-efficient instant execution** - Only available when timelock is set to 0. Uses multicall wrapper for optimized gas usage.

```js
await client.instantSetPerformanceFee(vaultAddress, newFee);
// Immediate execution (only if timelock = 0) with gas optimization
```

**Usage Pattern:**

- **Standard workflow**: Use `submit*()` then `set*AfterTimelock()` after delay
- **Zero timelock**: Use `instant*()` for immediate, gas-efficient execution
- **Emergency**: Timelock can be set to 0 for instant operations when needed

### 🔒 Comprehensive Role Management

- **Owner Operations**: Complete vault ownership control and metadata management
- **Curator Management**: Fee configuration, adapter management, and advanced parameters
- **Sentinel System**: Flexible access control for multiple accounts
- **Allocator System**: Control over vault allocation strategies

### 🔌 Multi-Protocol Adapter Support

- **Morpho Vault V1**: Deploy adapters for Morpho vault integration
- **Morpho Market V1**: Deploy adapters for Morpho market integration
- **Adapter Discovery**: Find existing adapters to avoid duplicate deployments
- **Adapter Validation**: Verify adapter types and configurations
- **Future-Ready**: Extensible architecture for additional protocol adapters

### ⚡ Developer Experience

- **TypeScript Support**: Full type safety and intellisense
- **Flexible Authentication**: Support for mnemonic or private key
- **Error Handling**: Comprehensive error handling and reporting
- **Direct Contract Access**: Advanced usage with direct contract instances

## Examples and Testing

The SDK includes comprehensive examples and tests:

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run the complete vault creation example
node example/create-vault.ts

# Run specific tests
node test/create-vault.test.js
node test/read-vault.test.js
node test/play-with-roles.test.js
node test/set-name-symbol.test.js
node test/curators/fees.test.js
node test/curators/timelock.test.js
```

### Complete Vault Setup Example

The `example/create-vault.ts` file demonstrates a complete vault setup including:

- Vault creation with deterministic address
- Setting vault name and symbol
- Configuring performance and management fees
- Setting fee recipients
- Managing roles (owner, curator, sentinel)
- Configuring underlying vault adapters
- Setting up timelock parameters

This example shows the full lifecycle of vault creation and configuration.

## Supported Networks

- **Base Mainnet (Chain ID: 8453)**

  - Byzantine Factory: `0x9615550EA8Fa52bdAC83de3FC9A280dBa3D981eE`
  - Morpho Vault V1 Adapter Factory: `0xbA98A4d436e79639A1598aFc988eFB7A828d7F08`
  - Morpho Market V1 Adapter Factory: `0xf21189365131551Ba4c3613252B1bcCdA60BD1e6`

- **Ethereum Sepolia (Chain ID: 11155111)** - Testing

  - Byzantine Factory: `0xf9332a83747b169f99dc4b247f3f1f7f22863703`
  - Morpho Vault V1 Adapter Factory: `0x650CDA0043f61E49383dD201b318Ad94f4C3A7A1`
  - Morpho Market V1 Adapter Factory: `0xE5B709A14859EdF820347D78E587b1634B0ec771`

- _Additional networks coming soon_

## NPM Package

This SDK is available on npm as `@byzantine/debt-fund-sdk`.

## Security

Debt Fund contracts follow industry best practices and implement comprehensive security measures including role-based access controls and timelock mechanisms for critical operations.

## License

ISC
