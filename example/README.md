# Byzantine SDK Examples

This directory contains practical examples demonstrating how to use the Byzantine SDK for DeFi vault management. Each example showcases different aspects of vault creation, configuration, and management operations.

## How to Run Examples

All examples can be executed using the following command format:

```bash
npx tsx example/[filename].ts
```

**Global prerequisites:**

- Set up your `.env` file with `RPC_URL` and `MNEMONIC`
- Ensure you have the required permissions (owner, curator, allocator) for the specific vault operations
- Have sufficient funds for gas fees

## Examples Overview

### 🏗️ Create Simple Vault

**Command:** `npx tsx example/create-vault-simple.ts`

**Requirements:** Global requirements above

**Description:** Minimal vault creation example that demonstrates the simplest way to create a new vault. Creates a vault with default settings using your address as owner and a random salt for deterministic address generation. Perfect for beginners who want to understand the basic vault creation process.

### 🏛️ Create Advanced Vault

**Command:** `npx tsx example/create-vault.ts`

**Requirements:** Global requirements above + define `SETUP_VAULT_CONFIG` following the `SetupVaultConfig` interface

**Description:** Complex automation script that creates and fully configures vaults in a single execution. Automatically handles all necessary transactions to set up the vault according to your specifications. Most parameters are optional - the script adapts based on what you define. If you want underlying vaults but don't want to be the final curator, the script temporarily assigns you as curator to add vaults and configure everything, then transfers the role to your intended curator. Same logic applies to other roles. Perfect for production vault deployment with complex configurations.

### 👑 Manage Owner Settings

**Command:** `npx tsx example/owners-settings.ts`

**Requirements:** Global requirements above + owner role on the target vault, set `VAULT_ADDRESS` and `OWNER_SETTINGS_CONFIG`

**Description:** Demonstrates owner-specific operations like setting vault name/symbol, assigning curator and sentinel roles, and transferring ownership. Shows the administrative capabilities available to vault owners and how to manage access controls. Important for understanding vault governance and role management.

### ⚙️ Configure Curator Settings

**Command:** `npx tsx example/curators-settings.ts`

**Requirements:** Global requirements above + curator role on the target vault, set `VAULT_ADDRESS` and `CURATORS_SETTINGS_CONFIG`

**Description:** Shows how curators can configure vault parameters including performance fees, management fees, max rates, and underlying vault caps. Demonstrates timelock management for sensitive operations and how to set relative/absolute caps for different vault strategies. Essential for understanding fee management and risk controls.

### 🔌 Deploy Morpho Adapters

**Command:** `npx tsx example/morpho-adapters.ts`

**Requirements:** Global requirements above + set `VAULT_ADDRESS`, `MORPHO_VAULT_V1`, and `MORPHO_CONTRACT` variables

**Description:** Comprehensive example of working with Morpho Vault V1 adapters. Shows how to check existing adapters, deploy new ones, and retrieve adapter information including IDs and underlying vault details. Demonstrates the complete lifecycle of Morpho adapter management within a Byzantine vault.

### 📊 Set Adapter Caps

**Command:** `npx tsx example/set-cap-adapter.ts`

**Requirements:** Global requirements above + set `VAULT_ADDRESS` and `CAPS_CONFIG` variables

**Description:** Shows how to set caps (both relative and absolute) for specific adapters within a vault. Demonstrates the process of configuring allocation limits and how to use the instant cap increase functionality. Important for understanding risk management and allocation controls.

### 🛠️ Utility Functions

**Command:** Not directly runnable - utility functions for other examples

**Requirements:** N/A (utility file)

**Description:** Contains shared utility functions used across all examples including environment configuration, helper functions for timelock operations, and comprehensive vault state reading functions. Provides common functionality for vault information display and configuration management.
