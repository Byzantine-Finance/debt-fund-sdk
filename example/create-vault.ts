import { ByzantineClient } from "../src/clients/ByzantineClient";
import {
  ethers,
  formatUnits,
  parseEther,
  parseUnits,
  randomBytes,
} from "ethers";
import { TimelockFunction } from "../src/clients/curators";
import {
  fullReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
  setupCuratorsSettings,
  checkAndApproveIfNeeded,
  setupAllocatorsSettings,
  waitSecond,
  waitDelay,
} from "./utils";
import { CuratorsSettingsConfig } from "./curators-settings";
import { AllocatorSettingsConfig } from "./allocators-settings";
import { setupOwnerSettings } from "./utils/owner";
import { OwnerSettingsConfig } from "./owners-settings";

interface SetupVaultConfig {
  owner?: string; // If not provided, we will use the user address
  asset: string;
  salt?: string; // To make the address deterministic

  deposit_amount?: bigint;

  owner_settings?: OwnerSettingsConfig;

  curators_settings?: CuratorsSettingsConfig;

  allocator_settings?: AllocatorSettingsConfig;

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

  deposit_amount: parseUnits("0.1", 6), // 0.1 USDC

  owner_settings: {
    shares_name: "Byzantine Vault",
    shares_symbol: "BYZ",
    curator: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
    sentinels: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],
  },

  curators_settings: {
    allocators: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],

    // performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
    // management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
    // performance_fee: parseUnits("0.05", 18), // 5%
    // management_fee: parseUnits("0.05", 18) / 31536000n, // 5% / year

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
        deallocate_penalty: parseEther("0.01"),
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

  allocator_settings: {
    // max_rate: parseUnits("200", 16) / 31536000n, // 200% / year

    setLiquidityAdapterFromUnderlyingVaultAndData: {
      underlyingVault: "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A",
      liquidityData: "0x",
    },
    allocateConfigFromUnderlyingVault: [
      {
        underlyingVault: "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A",
        amountAsset: parseUnits("0.4", 6), // 0.4 USDC
      },
      {
        underlyingVault: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738",
        amountAsset: parseUnits("0.2", 6), // 0.2 USDC
      },
    ],
  },
};

const OWNER_SETTINGS: OwnerSettingsConfig =
  SETUP_VAULT_CONFIG.owner_settings || {};

const CURATORS_SETTINGS: CuratorsSettingsConfig =
  SETUP_VAULT_CONFIG.curators_settings || {};

const ALLOCATOR_SETTINGS: AllocatorSettingsConfig =
  SETUP_VAULT_CONFIG.allocator_settings || {};

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
      OWNER_SETTINGS.curator &&
      userAddress.toLowerCase() === OWNER_SETTINGS.curator.toLowerCase();
    const YOUR_ARE_ALLOCATOR =
      CURATORS_SETTINGS.allocators &&
      CURATORS_SETTINGS.allocators.some(
        (addr) => addr.toLowerCase() === userAddress.toLowerCase()
      );
    const YOUR_ARE_SENTINEL =
      OWNER_SETTINGS.sentinels &&
      OWNER_SETTINGS.sentinels.some(
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
        CURATORS_SETTINGS.management_fee_recipient);

    // Determine if a temporary owner role is needed (if the current user is not the owner but needs to perform owner actions)
    const NEEDS_TEMPORARY_OWNER_ROLE =
      !YOU_ARE_OWNER &&
      (NEEDS_TEMPORARY_CURATOR_ROLE ||
        OWNER_SETTINGS.shares_name ||
        OWNER_SETTINGS.shares_symbol ||
        OWNER_SETTINGS.curator ||
        OWNER_SETTINGS.sentinels ||
        OWNER_SETTINGS.new_owner);
    // ****************
    // Create the vault
    // ****************
    console.log(
      "Creating vault with owner",
      YOU_ARE_OWNER ? INTENDED_OWNER : userAddress
    );

    const txCreateVault = await client.createVault(
      YOU_ARE_OWNER ? INTENDED_OWNER : userAddress,
      SETUP_VAULT_CONFIG.asset,
      SETUP_VAULT_CONFIG.salt || ethers.hexlify(randomBytes(32))
    );
    console.log("Vault creation transaction sent", txCreateVault.hash);

    await txCreateVault.wait();
    await waitDelay(4000); // Wait for the vault to be created

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
    // Handle the roles
    // ****************

    if (NEEDS_TEMPORARY_OWNER_ROLE) {
      console.log(
        `👷‍⏳ We will need to set${
          NEEDS_TEMPORARY_OWNER_ROLE ? " temporary" : ""
        } owner to the user`
      );
      OWNER_SETTINGS.new_owner = userAddress;
    }

    if (NEEDS_TEMPORARY_CURATOR_ROLE || YOUR_ARE_CURATOR) {
      console.log(
        `👷‍⏳ We will need to set${
          NEEDS_TEMPORARY_CURATOR_ROLE ? " temporary" : ""
        } curator to the user`
      );
      OWNER_SETTINGS.curator = userAddress;
    }

    if (NEEDS_TEMPORARY_ALLOCATOR_ROLE || YOUR_ARE_ALLOCATOR) {
      console.log(
        `👷‍⏳ We will need to set${
          NEEDS_TEMPORARY_ALLOCATOR_ROLE ? " temporary" : ""
        } allocator to the user`
      );
      CURATORS_SETTINGS.allocators = [userAddress];
    }

    // ****************
    // Handle the owner settings
    // ****************
    await setupOwnerSettings(
      client,
      VAULT_ADDRESS,
      userAddress,
      OWNER_SETTINGS
    );

    if (SETUP_VAULT_CONFIG.deposit_amount) {
      console.log("\n\n || 💰 Depositing assets ||");
      console.log(
        `💸 Depositing ${formatUnits(
          SETUP_VAULT_CONFIG.deposit_amount,
          6
        )} USDC`
      );

      // Check and approve if needed, then deposit
      await checkAndApproveIfNeeded(
        client,
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.deposit_amount,
        userAddress,
        "deposit"
      );

      const txDeposit = await client.deposit(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.deposit_amount,
        userAddress
      );
      await waitHalfSecond();
      const receiptDeposit = await txDeposit.wait();
      console.log(
        `📤 Hash deposit: ${txDeposit.hash}, Block number: ${receiptDeposit?.blockNumber}, Gas used: ${receiptDeposit?.gasUsed}`
      );
    }

    // ****************
    // Handle the curators settings
    // ****************
    console.log("\n\n|| Setting curators settings ||");
    await setupCuratorsSettings(
      client,
      VAULT_ADDRESS,
      userAddress,
      CURATORS_SETTINGS
    );

    // Handle the allocators settings
    await setupAllocatorsSettings(
      client,
      VAULT_ADDRESS,
      userAddress,
      ALLOCATOR_SETTINGS
    );

    // ****************
    // Go back to the original situation
    // ****************
    console.log("\n\n || 👷‍ Setting back the roles ||");
    if (NEEDS_TEMPORARY_ALLOCATOR_ROLE) {
      console.log("👷‍❌ Setting back the allocator to the user");
      const tx = await client.instantSetIsAllocator(
        VAULT_ADDRESS,
        userAddress,
        false
      );
      await tx.wait();
      await waitHalfSecond();
    }
    if (!YOUR_ARE_SENTINEL) {
      console.log("👷‍❌ Setting back the sentinel to the user");
      const tx = await client.setIsSentinel(VAULT_ADDRESS, userAddress, false);
      await tx.wait();
      await waitHalfSecond();
    }
    // }

    if (NEEDS_TEMPORARY_CURATOR_ROLE) {
      console.log("👷‍❌ Setting back the curator to the intended curator");
      console.log("Current curator:", await client.getCurator(VAULT_ADDRESS));
      const tx = await client.setCurator(
        VAULT_ADDRESS,
        OWNER_SETTINGS.curator || "0x0000000000000000000000000000000000000000"
      );
      await tx.wait();
      await waitHalfSecond();
    }
    await waitHalfSecond();

    if (NEEDS_TEMPORARY_OWNER_ROLE) {
      console.log("👷‍❌ Setting back the owner to the user");
      const tx = await client.setOwner(
        VAULT_ADDRESS,
        "0x0000000000000000000000000000000000000000"
      );
      await tx.wait();
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
