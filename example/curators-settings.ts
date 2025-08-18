import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, parseEther, parseUnits } from "ethers";
import {
  finalReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
} from "./utils-example";
import { TimelockFunction } from "../dist/clients/curators";

interface CuratorsSettingsConfig {
  allocator?: string[]; // Might have multiple allocators

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

  timelockFunctionsToIncrease: Partial<Record<TimelockFunction, number>>;
}

//*******************************************************************
//*  This is what you need to change to create a vault              *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const VAULT_ADDRESS = "0x9F940434cABB9d8c1b9C9a4A042a846c093A85e7";

const CURATORS_SETTINGS_CONFIG: CuratorsSettingsConfig = {
  allocator: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],

  performance_fee: parseUnits("0.05", 18), // 5%
  management_fee: parseUnits("0.05", 18), // 5%
  performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  max_rate: parseUnits("200", 18), // 200%

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
    // {
    //   address: "0xC768c589647798a6EE01A91FdE98EF2ed046DBD6", // AAVE stata vault
    //   type: "Aave",
    //   relative_cap: parseUnits("0.2", 18), // 20%
    //   absolute_cap: parseUnits("200", 6), // 200 USDC
    //   deallocate_penalty: parseEther("0.015"),
    // },
  ],

  timelockFunctionsToIncrease: {
    setSharesGate: 3600,
    setReceiveAssetsGate: 3600,
    setSendAssetsGate: 3600,
    setPerformanceFee: 3600,
    setPerformanceFeeRecipient: 3600,
    setManagementFee: 3600,
    setManagementFeeRecipient: 3600,
    setMaxRate: 3600,
    setForceDeallocatePenalty: 3600,
  },
};

async function main() {
  console.log("Start example to set curator settings of a vault");

  try {
    // ****************
    // Setup the test
    // ****************

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    await finalReading(client, VAULT_ADDRESS, userAddress);

    const curator = await client.getCurator(VAULT_ADDRESS);
    if (curator !== userAddress) {
      console.log("Access denied: only the curator can proceed here.");
      throw new Error("Access denied: only the curator can proceed here.");
    }

    const newAllocators = CURATORS_SETTINGS_CONFIG.allocator;

    if (newAllocators && newAllocators.length > 0) {
      for (const allocator of newAllocators) {
        try {
          const isAllocator = await client.getIsAllocator(
            VAULT_ADDRESS,
            allocator
          );
          if (isAllocator) {
            console.log(`Allocator ${allocator} is already set`);
            continue;
          }
          const tx = await client.instantSetIsAllocator(
            VAULT_ADDRESS,
            allocator,
            true
          );
          await tx.wait();
        } catch {
          const timelockSetIsAllocator = await client.getTimelock(
            VAULT_ADDRESS,
            "setIsAllocator"
          );
          console.error(
            `Error setting allocator ${allocator}, please wait ${timelockSetIsAllocator} seconds`
          );
        }
        await waitHalfSecond();
        console.log(`Allocator ${allocator} set to true`);
      }
    }

    const NEEDS_TO_ADD_UNDERLYING_VAULT = // Because only curator can add underlying vault
      CURATORS_SETTINGS_CONFIG.underlying_vaults &&
      CURATORS_SETTINGS_CONFIG.underlying_vaults.length > 0;
    const NEEDS_TO_CAP_UNDERLYING_VAULT = // Because only allocator can cap the underlying vault
      CURATORS_SETTINGS_CONFIG.underlying_vaults &&
      CURATORS_SETTINGS_CONFIG.underlying_vaults.some(
        (underlying) => underlying.relative_cap || underlying.absolute_cap
      );

    if (CURATORS_SETTINGS_CONFIG.underlying_vaults) {
      // Maps to store adapter addresses and caps for all underlying vaults
      const mappingAdapters = new Map<string, string>(); // Will store the address of the adapter for each underlying vault
      const mappingCaps = new Map<
        string,
        {
          relative_cap?: bigint;
          absolute_cap?: bigint;
          deallocate_penalty?: bigint;
        }
      >(); // Will store the relative and absolute caps for each underlying vault

      // First round: create adapters if needed and build mapping
      for (const underlying of CURATORS_SETTINGS_CONFIG.underlying_vaults) {
        let adapterAddress;

        console.log(`Processing underlying vault: ${underlying.address}`);

        // Try to find existing adapter
        try {
          adapterAddress = await client.findMorphoVaultV1Adapter(
            VAULT_ADDRESS,
            underlying.address
          );
          console.log(
            `Found existing adapter: ${adapterAddress} for ${underlying.address}`
          );
        } catch (error) {
          console.log(`No existing adapter found for ${underlying.address}`);
        }

        // If no adapter found or it's the zero address, create one
        if (
          !adapterAddress ||
          adapterAddress === "0x0000000000000000000000000000000000000000"
        ) {
          console.log(`Creating new adapter for ${underlying.address}`);
          const tx = await client.deployMorphoVaultV1Adapter(
            VAULT_ADDRESS,
            underlying.address
          );
          const receipt = await tx.wait();
          adapterAddress = tx.adapterAddress;
          console.log(`Deployed new adapter: ${adapterAddress}`);
        }

        // Store the adapter address in mapping
        if (adapterAddress) {
          mappingAdapters.set(underlying.address, adapterAddress);
        }

        // Store caps if they exist
        if (underlying.relative_cap || underlying.absolute_cap) {
          mappingCaps.set(underlying.address, {
            relative_cap: underlying.relative_cap,
            absolute_cap: underlying.absolute_cap,
            deallocate_penalty: underlying.deallocate_penalty,
          });
        }

        await waitHalfSecond();
      }

      // Second round: add the adapters to the vault
      console.log("Adding adapters to vault...");
      for (const [underlyingAddress, adapterAddress] of mappingAdapters) {
        try {
          console.log(
            `Setting adapter ${adapterAddress} for underlying ${underlyingAddress}`
          );
          await client.instantSetIsAdapter(VAULT_ADDRESS, adapterAddress, true);
          await waitHalfSecond();
        } catch (error) {
          console.error(
            `Error setting adapter for ${underlyingAddress}:`,
            error
          );
        }
      }

      // Third round: set caps if needed
      if (NEEDS_TO_CAP_UNDERLYING_VAULT) {
        console.log("Setting caps for adapters...");
        for (const [underlyingAddress, caps] of mappingCaps) {
          const adapterAddress = mappingAdapters.get(underlyingAddress);
          if (!adapterAddress) {
            console.warn(
              `No adapter found for ${underlyingAddress}, skipping caps`
            );
            continue;
          }

          try {
            if (caps.relative_cap) {
              console.log(
                `Setting relative cap ${caps.relative_cap} for ${adapterAddress}`
              );
              await client.instantIncreaseRelativeCap(
                VAULT_ADDRESS,
                adapterAddress,
                caps.relative_cap
              );
              await waitHalfSecond();
              // await client.setRelativeCap(VAULT_ADDRESS, adapterAddress, caps.relative_cap);
            }
            if (caps.absolute_cap) {
              console.log(
                `Setting absolute cap ${caps.absolute_cap} for ${adapterAddress}`
              );
              // TODO: Uncomment when method is available
              // await client.setAbsoluteCap(VAULT_ADDRESS, adapterAddress, caps.absolute_cap);
              await client.instantIncreaseAbsoluteCap(
                VAULT_ADDRESS,
                adapterAddress,
                caps.absolute_cap
              );
              await waitHalfSecond();
            }
            if (caps.deallocate_penalty) {
              console.log(
                `Setting deallocate penalty ${caps.deallocate_penalty} for ${adapterAddress}`
              );
              await client.instantSetForceDeallocatePenalty(
                VAULT_ADDRESS,
                adapterAddress,
                caps.deallocate_penalty
              );
              await waitHalfSecond();
            }
            await waitHalfSecond();
          } catch (error) {
            console.error(`Error setting caps for ${adapterAddress}:`, error);
          }
        }
      }

      console.log("Adapter mapping completed:");
      console.log(
        "Underlying -> Adapter mapping:",
        Object.fromEntries(mappingAdapters)
      );
      console.log("Caps mapping:", Object.fromEntries(mappingCaps));
    }

    await finalReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error curating vault:", error);
  }
}

main();
