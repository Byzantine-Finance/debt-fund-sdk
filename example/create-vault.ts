import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, parseEther, parseUnits, randomBytes } from "ethers";
import { TimelockFunction } from "../dist/clients/curators";
import {
  finalReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
} from "./utils-example";

interface SetupVaultConfig {
  owner?: string; // If not provided, we will use the user address
  asset: string;
  salt?: string; // To make the address deterministic
  name?: string;
  symbol?: string;

  curator?: string;
  allocator?: string[]; // Might have multiple allocators
  sentinel?: string[]; // Might have multiple sentinels

  performance_fee?: bigint; // 100% = 1e18, max 50% -> 0.5e18
  management_fee?: bigint; // 100% = 1e18, max 5%/year -> 0.05e18/31_536_000 = 1.3698630136986301e15
  performance_fee_recipient?: string;
  management_fee_recipient?: string;
  max_rate?: bigint; // 100% = 1e18, max 200%/year -> 200e16/31_536_000 = 6.3493150684931506e12

  underlying_vaults?: {
    address: string; // Address of the underlying vault or market
    type: "MorphoVaultV1" | "MorphoMarketV1" | "Aave" | "Euler" | "Compound"; // Because we need to select the right adapter
    relative_cap?: bigint; // 100% = 1e18, max 100% -> 1e18
    absolute_cap?: bigint;
    deallocate_penalty?: bigint; // 100% = 1e18, max 2% -> 0.02e18
  }[];

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
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  name: "Byzantine Vault",
  symbol: "BYZ",
  performance_fee: parseEther("0.5"), // 50%
  management_fee: parseEther("0.05") / 31536000n, // 5% / year
  performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  max_rate: parseEther("0.5") / 31536000n, // 50% / year
  curator: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  underlying_vaults: [
    {
      address: "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A", // Spark Morpho vault
      type: "MorphoVaultV1",
      relative_cap: parseUnits("0.5", 18), // 50%
      absolute_cap: parseUnits("800", 6), // 800 USDC
      deallocate_penalty: parseEther("0.02"),
    },
    {
      address: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738", // Seamless Morpho vault
      type: "MorphoVaultV1",
      relative_cap: parseUnits("0.3", 18), // 30%
      absolute_cap: parseUnits("300", 6), // 300 USDC
      deallocate_penalty: parseEther("0.02"),
    },
    {
      address: "0xC768c589647798a6EE01A91FdE98EF2ed046DBD6", // AAVE stata vault
      type: "Aave",
      relative_cap: parseUnits("0.2", 18), // 20%
      absolute_cap: parseUnits("200", 6), // 200 USDC
      deallocate_penalty: parseEther("0.015"),
    },
  ],
};

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
      SETUP_VAULT_CONFIG.underlying_vaults &&
      SETUP_VAULT_CONFIG.underlying_vaults.length > 0;
    const NEEDS_TO_CAP_UNDERLYING_VAULT = // Because only allocator can cap the underlying vault
      SETUP_VAULT_CONFIG.underlying_vaults &&
      SETUP_VAULT_CONFIG.underlying_vaults.some(
        (underlying) => underlying.relative_cap || underlying.absolute_cap
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
        SETUP_VAULT_CONFIG.performance_fee ||
        SETUP_VAULT_CONFIG.management_fee ||
        SETUP_VAULT_CONFIG.performance_fee_recipient ||
        SETUP_VAULT_CONFIG.management_fee_recipient ||
        SETUP_VAULT_CONFIG.max_rate);

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
    const receiptCreateVault = await txCreateVault.wait();
    const VAULT_ADDRESS = receiptCreateVault?.logs[0]?.address;

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
      console.log("Setting temporary curator to the user");
      await client.setCurator(VAULT_ADDRESS, userAddress);
    }
    await waitHalfSecond();

    console.log("💰 Setting fees");

    if (SETUP_VAULT_CONFIG.performance_fee_recipient) {
      await client.instantSetPerformanceFeeRecipient(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.performance_fee_recipient
      );
      await waitHalfSecond();
    }
    if (SETUP_VAULT_CONFIG.management_fee_recipient) {
      await client.instantSetManagementFeeRecipient(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.management_fee_recipient
      );
      await waitHalfSecond();
    }
    if (SETUP_VAULT_CONFIG.performance_fee) {
      await client.instantSetPerformanceFee(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.performance_fee
      );
      await waitHalfSecond();
    }
    if (SETUP_VAULT_CONFIG.management_fee) {
      await client.instantSetManagementFee(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.management_fee
      );
      await waitHalfSecond();
    }
    if (SETUP_VAULT_CONFIG.max_rate) {
      await client.instantSetMaxRate(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.max_rate
      );
      await waitHalfSecond();
    }

    console.log("🔍 Adding underlying vault");
    if (NEEDS_TO_ADD_UNDERLYING_VAULT) {
      console.log("Adding underlying vault");
      //   await client.addUnderlyingVault(VAULT_ADDRESS, SETUP_VAULT_CONFIG.underlying_vault);
      const mappingAdapters = new Map<string, string>(); // Will store the address of the adapter for each underlying vault, and if it is already an adapter, it will store the address of the adapter
      const mappingCaps = new Map<
        string,
        { relative_cap: bigint; absolute_cap: bigint }
      >(); // Will store the relative and absolute caps for each underlying vault
      // ****************
      // Add the underlying vault
      // ****************
      if (SETUP_VAULT_CONFIG.underlying_vaults) {
        // TODO: first loop when we create the adapters if needed
        for (const underlying of SETUP_VAULT_CONFIG.underlying_vaults || []) {
          // const adapterAddress = await client.createAdapter(
          //   VAULT_ADDRESS,
          //   underlying.address
          // );
          // if (adapterAddress) {
          //   mappingAdapters.set(underlying.address, adapterAddress);
          // } else {
          //   mappingAdapters.set(underlying.address, underlying.address);
          // }
        }

        // TODO: then add the adapters of the underlying vaults in the vault

        // ****************
        // Add the caps
        // ****************
        // Then, if we have caps, we add them
        if (NEEDS_TO_CAP_UNDERLYING_VAULT) {
          for (const underlying of SETUP_VAULT_CONFIG.underlying_vaults || []) {
            // if (underlying.relative_cap) {
            //   await client.setRelativeCap(VAULT_ADDRESS, underlying.address, underlying.relative_cap);
            // }
            // if (underlying.absolute_cap) {
            //   await client.setAbsoluteCap(VAULT_ADDRESS, underlying.address, underlying.absolute_cap);
            // }
          }
        }
      }

      // ****************
      // Go back to the original situation
      // ****************
      if (NEEDS_TEMPORARY_ALLOCATOR_ROLE) {
        console.log("Setting back the allocator to the user");
        await client.instantSetIsAllocator(VAULT_ADDRESS, userAddress, false);
        await waitHalfSecond();
      }
      if (!YOUR_ARE_SENTINEL) {
        console.log("Setting back the sentinel to the user");
        await client.setIsSentinel(VAULT_ADDRESS, userAddress, false);
        await waitHalfSecond();
      }
    }

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
    // Final step: retrieve and display all vault information
    // ****************
    await finalReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error creating vault:", error);
  }
}

main();
