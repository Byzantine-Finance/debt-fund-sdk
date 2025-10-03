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

- **Base Mainnet (Chain ID: 8453)** - It is on mainnet, but please only use it as a testnet with small amounts
<!-- - **Arbitrum One (Chain ID: 42161)** - It is on mainnet, but please only use it as a testnet with small amounts -->
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
    await client.instantAddAdapter(vaultAddress, "0x...");

    // Deploy and manage adapters
    const underlyingAddress = "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A";
    const adapterTx = await client.deployAdapter(
      "erc4626", // adapter type
      vaultAddress,
      underlyingAddress
    );
    const adapterReceipt = await adapterTx.wait();
    console.log("Deployed adapter:", adapterTx.adapterAddress);

    // Add the adapter to the vault
    await client.instantAddAdapter(vaultAddress, adapterTx.adapterAddress);

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

### User Operations (Deposits & Withdrawals)

```js
// Deposit assets into vault
await client.deposit(vaultAddress, amountAssets, receiver);

// Mint shares by depositing assets
await client.mint(vaultAddress, amountShares, receiver);

// Withdraw assets from vault
await client.withdraw(vaultAddress, amountAssets, receiver, onBehalf);

// Redeem shares for assets
await client.redeem(vaultAddress, amountShares, receiver, onBehalf);

// Transfer shares
await client.transfer(vaultAddress, to, shares);
await client.transferFrom(vaultAddress, from, to, shares);

// Approve shares for transfers
await client.approve(vaultAddress, spender, shares);

// Approve assets for vault operations
await client.approveAsset(vaultAddress, amount);

// Preview functions for calculating amounts
await client.previewDeposit(vaultAddress, assets); // Calculate shares for deposit
await client.previewMint(vaultAddress, shares); // Calculate assets needed for mint
await client.previewRedeem(vaultAddress, shares); // Calculate assets for redemption
await client.previewWithdraw(vaultAddress, assets); // Calculate shares needed for withdrawal

// Read balances and allowances
await client.getSharesBalance(vaultAddress, account);
await client.getAssetBalance(vaultAddress, account);
await client.getAssetAllowance(vaultAddress, owner);
await client.getAllowance(vaultAddress, userAddress);
await client.getTotalAssets(vaultAddress);
await client.getTotalSupply(vaultAddress);
await client.getVirtualShares(vaultAddress);
await client.getAsset(vaultAddress);
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
await client.getSharesName(vaultAddress);
await client.getSharesSymbol(vaultAddress);
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

#### Allocator Operations

```js
// Liquidity adapter configuration
await client.setLiquidityAdapterAndData(
  vaultAddress,
  newLiquidityAdapter,
  newLiquidityData
);

// Asset allocation and deallocation
await client.allocate(vaultAddress, adapter, data, assets);
await client.deallocate(vaultAddress, adapter, data, assets);

// Read allocation information
await client.getLiquidityAdapter(vaultAddress);
await client.getLiquidityData(vaultAddress);
await client.getAllocation(vaultAddress, id);
await client.getIdleBalance(vaultAddress);
```

#### Adapter Management

```js
// Generic adapter deployment and management
const adapterTx = await client.deployAdapter(
  "erc4626", // or "erc4626Merkl", or "compoundV3", or "morphoMarketV1"
  vaultAddress,
  underlyingAddress,
  cometRewards // optional, only for compoundV3 adapters
);
const adapterAddress = adapterTx.adapterAddress;

// Find existing adapters
const existingAdapter = await client.findAdapter(
  vaultAddress,
  underlyingAddress,
  "erc4626" // or "erc4626Merkl", or "compoundV3", or "morphoMarketV1"
);

// Check adapter types
const isERC4626Adapter = await client.isAdapter("erc4626", account);
const isERC4626MerklAdapter = await client.isAdapter("erc4626Merkl", account);
const isCompoundV3Adapter = await client.isAdapter("compoundV3", account);
const isMarketAdapter = await client.isAdapter("morphoMarketV1", account);

// Adapter configuration in vault
await client.submitAddAdapter(vaultAddress, adapter);
await client.addAdapterAfterTimelock(vaultAddress, adapter);
await client.instantRemoveAdapter(vaultAddress, adapter); // Gas-efficient with multicall when 0 timelock
await client.submitRemoveAdapter(vaultAddress, adapter);
await client.removeAdapterAfterTimelock(vaultAddress, adapter);
await client.instantRemoveAdapter(vaultAddress, adapter); // Gas-efficient with multicall when 0 timelock

// Query adapter status
await client.getIsAdapter(vaultAddress, adapter);
await client.getAdaptersLength(vaultAddress);
await client.getAdapterByIndex(vaultAddress, 0);

// Get adapter information
await client.getIdsAdapterERC4626(adapterAddress);
await client.getIdsAdapterERC4626Merkl(adapterAddress);
await client.getIdsAdapterCompoundV3(adapterAddress);
await client.getIdsAdapterMarketV1(adapterAddress, marketParams);
await client.getUnderlyingAdapterERC4626(adapterAddress);
await client.getUnderlyingAdapterERC4626Merkl(adapterAddress);
await client.getUnderlyingAdapterCompoundV3(adapterAddress);
await client.getUnderlyingAdapterMarketV1(adapterAddress);

// Global adapter utilities
await client.getAdapterFactoryAddress(adapterAddress);
await client.getAdapterType(adapterAddress); // Return "erc4626", "erc4626Merkl", "compoundV3", or "morphoMarketV1"

// Morpho Market V1 specific
await client.getAdapterMarketParamsListLength(adapterAddress);
await client.getAdapterMarketParamsList(adapterAddress, index);
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

// Increase timelock (requires timelock)
await client.submitIncreaseTimelock(vaultAddress, functionName, newDuration);
await client.increaseTimelockAfterTimelock(
  vaultAddress,
  functionName,
  newDuration
);
await client.instantIncreaseTimelock(vaultAddress, functionName, newDuration); // Gas-efficient with multicall when 0 timelock

// Decrease timelock
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

// Utility
client.getTimelockFunctionSelector(functionName);
```

## Adapter Types and Protocol Integration

### Understanding Adapter Types

The SDK supports different adapter types to integrate with various DeFi protocols:

#### **ERC4626 Adapters**

Standard ERC4626 vault integration for protocols like Morpho Vaults, Aave, or Spark. Users manually claim rewards or the vault receives them.

#### **ERC4626Merkl Adapters**

ERC4626 vault integration with automated Merkl rewards claiming and compounding. A designated "skim claimer" or bot can claim and compound Merkl rewards directly for better "native" yield.

#### **CompoundV3 Adapters**

Direct integration with Compound V3 markets for lending/borrowing operations with supply and borrow functionality.

#### **MorphoMarketV1 Adapters**

Integration with Morpho V1 markets for peer-to-peer lending operations (supply, borrow, repay, withdraw) with multiple market parameters.

### Supported Protocols and Adapters

| Protocol           | Adapter Type                | Description                                         | Find Vaults                                                        |
| ------------------ | --------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| **Morpho Vaults**  | `erc4626` or `erc4626Merkl` | Morpho's ERC4626 vaults with optional Merkl rewards | [Morpho Earn](https://app.morpho.org/base/earn)                    |
| **Morpho Markets** | `morphoMarketV1`            | Morpho V1 peer-to-peer lending markets              | [Morpho Explore](https://app.morpho.org/ethereum/explore)          |
| **Aave**           | `erc4626` or `erc4626Merkl` | Aave's ERC4626-compatible vaults (stataUSDC, etc.)  | [Aave Search](https://search.onaave.com/?q=stata%20USDC)           |
| **Compound V3**    | `compoundV3`                | Compound V3 lending markets                         | [Compound Docs](https://docs.compound.finance/#protocol-contracts) |
| **Spark**          | `erc4626`                   | Sky's savings tokens (sUSDC, etc.)                  | [Spark Docs](https://docs.spark.fi/dev/deployments/)               |

### How to Choose the Right Adapter

- **ERC4626-compatible vaults**: Use `erc4626` for basic integration or `erc4626Merkl` if the protocol offers Merkl rewards
- **Compound V3**: Use `compoundV3` adapter
- **Morpho V1 markets**: Use `morphoMarketV1` adapter
- **Always verify**: Check protocol documentation for correct adapter type and underlying address

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
        adapterAddress = await client.findAdapter(
          vaultAddress,
          underlyingVault,
          "erc4626" // adapter type
        );
        console.log(`Found existing adapter: ${adapterAddress}`);
      } catch (error) {
        console.log("No existing adapter found, creating new one...");

        // Deploy new adapter
        const adapterTx = await client.deployAdapter(
          "erc4626", // adapter type
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
        await client.instantAddAdapter(vaultAddress, adapterAddress);
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
- **User Operations**: Complete deposit/withdrawal lifecycle with intelligent approval management

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

### 💰 Smart User Operations

- **Preview Functions**: Calculate exact amounts for deposits, mints, withdrawals, and redemptions
- **Intelligent Approvals**: Automatic calculation of required asset amounts for mint operations
- **Complete Lifecycle**: Support for all user-facing vault operations (deposit, mint, withdraw, redeem)
- **Transfer Support**: Full ERC20-like share transfer functionality
- **Balance Management**: Comprehensive balance and allowance tracking

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

  - Byzantine Factory: `0x4501125508079A99ebBebCE205DeC9593C2b5857`
  - Morpho Vault V1 Adapter Factory: `0x0f52A6D95d1C29806696FfaC4EB9F563e90faB9B`
  - Morpho Market V1 Adapter Factory: `0x96E2F9E6077C9B8FcA5Bb0F31F7A977ffC047F6E`
  - Erc4626Merkl Adapter Factory: `0xdF311B93f922867A686abA9b233Fd7C65d66f83d`
  - CompoundV3 Adapter Factory: `0xA4dF9668EE53A896BdF40A7AeAC1364129F3c168`

<!-- - **Arbitrum One (Chain ID: 42161)**

  - Byzantine Factory: `0x4D4A1eF022410b1a5c04049E5c3b1651FDd9EcBA`
  - Morpho Vault V1 Adapter Factory: `0x53DB20783687cea8A2dF0dd6b47e977B90f85E2F`
  - Morpho Market V1 Adapter Factory: `0xA8b523fcf34F2f63d26e709a16c9bC41801f1fC9` -->

- _Additional networks coming soon_

## NPM Package

This SDK is available on npm as `@byzantine/debt-fund-sdk`.

## Security

Debt Fund contracts follow industry best practices and implement comprehensive security measures including role-based access controls and timelock mechanisms for critical operations.

## License

ISC
