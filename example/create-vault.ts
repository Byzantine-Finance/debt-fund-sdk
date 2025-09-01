import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, parseEther, parseUnits, randomBytes } from "ethers";
import { TimelockFunction } from "../src/clients/curators";
import {
  fullReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
  setupCuratorsSettings,
} from "./utils";
import { CuratorsSettingsConfig } from "./curators-settings";

interface SetupVaultConfig {
  owner?: string; // If not provided, we will use the user address
  asset: string;
  salt?: string; // To make the address deterministic
  name?: string;
  symbol?: string;

  curator?: string;
  allocator?: string[]; // Might have multiple allocators
  sentinel?: string[]; // Might have multiple sentinels

  curators_settings?: CuratorsSettingsConfig;

  // Timelock configuration: a mapping from each TimelockFunction to a number (duration in seconds)
  // Will be set at the end of the script so we can do the other actions before
  timelock?: Partial<Record<TimelockFunction, number>>;
}

//*******************************************************************
//*  This is what you need to change to create a vault              *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const SETUP_VAULT_CONFIG: SetupVaultConfig = {
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  name: "Byzantine Vault",
  symbol: "BYZ",

  curator: "0xe5b709A14859EdF820347D78E587b1634B0ec771",

  curators_settings: {
    performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
    management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
    performance_fee: parseUnits("0.05", 18), // 5%
    management_fee: parseUnits("0.05", 18) / 31536000n, // 5% / year
    max_rate: parseUnits("200", 16) / 31536000n, // 200% / year

    underlying_vaults: [
      {
        address: "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A", // Spark Morpho vault
        type: "erc4626",
        deallocate_penalty: parseEther("0.02"),
        caps_per_id: [
          {
            relative_cap: parseUnits("0.5", 18), // 50%
            absolute_cap: parseUnits("800", 6), // 800 USDC
          },
        ],
      },
      {
        address: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738", // Seamless Morpho vault
        type: "erc4626Merkl",
        deallocate_penalty: parseEther("0.02"),
        caps_per_id: [
          {
            relative_cap: parseUnits("0.3", 18), // 30%
            absolute_cap: parseUnits("300", 6), // 300 USDC
          },
        ],
      },
      {
        address: "0xC768c589647798a6EE01A91FdE98EF2ed046DBD6", // AAVE stata vault
        type: "erc4626Merkl",
        deallocate_penalty: parseEther("0.015"),
        caps_per_id: [
          {
            relative_cap: parseUnits("0.2", 18), // 20%
            absolute_cap: parseUnits("200", 6), // 200 USDC
          },
        ],
      },
      {
        address: "0x3128a0F7f0ea68E7B7c9B00AFa7E41045828e858", // Spark base
        type: "erc4626",
        deallocate_penalty: parseEther("0.015"),
        caps_per_id: [
          {
            relative_cap: parseUnits("0.2", 18), // 20%
            absolute_cap: parseUnits("200", 6), // 200 USDC
          },
        ],
      },
      {
        address: "0xb125E6687d4313864e53df431d5425969c15Eb2F", // Compound base
        comet_rewards: "0x123964802e6ABabBE1Bc9547D72Ef1B69B00A6b1",
        type: "compoundV3",
        deallocate_penalty: parseEther("0.015"),
        caps_per_id: [
          {
            relative_cap: parseUnits("0.2", 18), // 20%
            absolute_cap: parseUnits("200", 6), // 200 USDC
          },
        ],
      },
    ],
    // timelockFunctionsToIncrease: {},
  },
};

const CURATORS_SETTINGS: CuratorsSettingsConfig =
  SETUP_VAULT_CONFIG.curators_settings || {};

// let VAULT_ADDRESS: string;
// let client: ByzantineClient;
// let userAddress: string;

async function main() {
  console.log("Start example to create and configure a vault");

  try {
    // ****************
    // Setup the test
    // ****************

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    // Determine the intended owner address for the vault
    // If SETUP_VAULT_CONFIG.owner is not set, use the current user address
    // If the user is not the intended owner, set the user as the owner (for testing flexibility)
    const INTENDED_OWNER = SETUP_VAULT_CONFIG.owner || userAddress;
    const YOU_ARE_OWNER =
      userAddress.toLowerCase() === INTENDED_OWNER.toLowerCase();
    const YOUR_ARE_CURATOR =
      SETUP_VAULT_CONFIG.curator &&
      userAddress.toLowerCase() === SETUP_VAULT_CONFIG.curator.toLowerCase();
    const YOUR_ARE_ALLOCATOR =
      SETUP_VAULT_CONFIG.allocator &&
      SETUP_VAULT_CONFIG.allocator.some(
        (addr) => addr.toLowerCase() === userAddress.toLowerCase()
      );
    const YOUR_ARE_SENTINEL =
      SETUP_VAULT_CONFIG.sentinel &&
      SETUP_VAULT_CONFIG.sentinel.some(
        (addr) => addr.toLowerCase() === userAddress.toLowerCase()
      );
    const NEEDS_TO_ADD_UNDERLYING_VAULT = // Because only curator can add underlying vault
      CURATORS_SETTINGS?.underlying_vaults &&
      CURATORS_SETTINGS.underlying_vaults.length > 0;
    const NEEDS_TO_CAP_UNDERLYING_VAULT = // Because only allocator can cap the underlying vault
      CURATORS_SETTINGS?.underlying_vaults &&
      CURATORS_SETTINGS.underlying_vaults.some((underlying) =>
        underlying.caps_per_id?.some(
          (cap) => cap.relative_cap || cap.absolute_cap
        )
      );
    // Determine if a temporary allocator role is needed (if the current user is not an allocator but needs to cap underlying vaults)
    const NEEDS_TEMPORARY_ALLOCATOR_ROLE =
      !YOUR_ARE_ALLOCATOR && NEEDS_TO_CAP_UNDERLYING_VAULT;

    // Determine if a temporary curator role is needed (if the current user is not a curator but needs to perform curator actions)
    const NEEDS_TEMPORARY_CURATOR_ROLE =
      !YOUR_ARE_CURATOR &&
      (NEEDS_TEMPORARY_ALLOCATOR_ROLE ||
        NEEDS_TO_ADD_UNDERLYING_VAULT ||
        NEEDS_TO_CAP_UNDERLYING_VAULT ||
        CURATORS_SETTINGS.performance_fee ||
        CURATORS_SETTINGS.management_fee ||
        CURATORS_SETTINGS.performance_fee_recipient ||
        CURATORS_SETTINGS.management_fee_recipient ||
        CURATORS_SETTINGS.max_rate);

    // Determine if a temporary owner role is needed (if the current user is not the owner but needs to perform owner actions)
    const NEEDS_TEMPORARY_OWNER_ROLE =
      !YOU_ARE_OWNER &&
      (NEEDS_TEMPORARY_CURATOR_ROLE ||
        SETUP_VAULT_CONFIG.name ||
        SETUP_VAULT_CONFIG.symbol);
    // ****************
    // Create the vault
    // ****************
    const txCreateVault = await client.createVault(
      YOU_ARE_OWNER ? INTENDED_OWNER : userAddress,
      SETUP_VAULT_CONFIG.asset,
      SETUP_VAULT_CONFIG.salt || ethers.hexlify(randomBytes(32))
    );
    await waitHalfSecond();
    console.log("Vault creation transaction sent", txCreateVault.hash);

    const VAULT_ADDRESS = txCreateVault.vaultAddress;

    if (!VAULT_ADDRESS) {
      throw new Error("Vault address not found");
    }

    console.log("Vault created successfully!");
    console.log("📨 Vault address:", VAULT_ADDRESS);

    if (!YOU_ARE_OWNER && NEEDS_TEMPORARY_OWNER_ROLE) {
      console.log(
        "You are not the owner, we will set the owner to the intended owner, but put back the intended owner at the end"
      );
      await client.setOwner(VAULT_ADDRESS, INTENDED_OWNER);
      await waitHalfSecond();
    }

    // ****************
    // Handle the name and symbol
    // ****************
    console.log("🔤 Setting name and symbol");
    if (SETUP_VAULT_CONFIG.name && SETUP_VAULT_CONFIG.symbol) {
      await client.setSharesNameAndSymbol(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.name,
        SETUP_VAULT_CONFIG.symbol
      );
    } else if (SETUP_VAULT_CONFIG.name) {
      await client.setSharesName(VAULT_ADDRESS, SETUP_VAULT_CONFIG.name);
    } else if (SETUP_VAULT_CONFIG.symbol) {
      await client.setSharesSymbol(VAULT_ADDRESS, SETUP_VAULT_CONFIG.symbol);
    }
    await waitHalfSecond();

    // ****************
    // Handle the fees
    // ****************

    if (NEEDS_TEMPORARY_CURATOR_ROLE || YOUR_ARE_CURATOR) {
      console.log(
        `👷‍ Setting${
          NEEDS_TEMPORARY_CURATOR_ROLE ? " temporary" : ""
        } curator to the user`
      );
      const tx = await client.setCurator(VAULT_ADDRESS, userAddress);
      await tx.wait();
    }
    await waitHalfSecond();

    // ****************
    // Handle the curators settings
    // ****************
    await setupCuratorsSettings(
      client,
      VAULT_ADDRESS,
      userAddress,
      CURATORS_SETTINGS
    );

    // ****************
    // Go back to the original situation
    // ****************
    if (NEEDS_TEMPORARY_ALLOCATOR_ROLE) {
      console.log("👷‍❌ Setting back the allocator to the user");
      await client.instantSetIsAllocator(VAULT_ADDRESS, userAddress, false);
      await waitHalfSecond();
    }
    if (!YOUR_ARE_SENTINEL) {
      console.log("👷‍❌ Setting back the sentinel to the user");
      await client.setIsSentinel(VAULT_ADDRESS, userAddress, false);
      await waitHalfSecond();
    }
    // }

    if (NEEDS_TEMPORARY_CURATOR_ROLE) {
      console.log("Setting back the curator to the intended curator");
      console.log("Current curator:", await client.getCurator(VAULT_ADDRESS));
      await client.setCurator(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.curator ||
          "0x0000000000000000000000000000000000000000"
      );
      await waitHalfSecond();
    }
    await waitHalfSecond();

    if (NEEDS_TEMPORARY_OWNER_ROLE) {
      console.log("Setting back the owner to the user");
      await client.setOwner(
        VAULT_ADDRESS,
        "0x0000000000000000000000000000000000000000"
      );
    }

    // ****************
    // Final step: if it works or not,retrieve and display all vault information
    // ****************
    await fullReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error creating vault:", error);
  } finally {
  }
}

main();
