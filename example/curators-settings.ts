import { ByzantineClient } from "../src/clients/ByzantineClient";
import { AbiCoder, ethers, parseEther, parseUnits } from "ethers";
import {
  finalReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
} from "./utils-example";
import { TimelockFunction } from "../dist/clients/curators";
import { getIdData } from "../src/clients/curators/Cap";

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
    deallocate_penalty?: bigint; // 100% = 1e18, max 2% -> 0.02e18 (per adapter)

    // New structure for caps per ID
    caps_per_id?: {
      id?: string; // If don't specify, we take the first ID from the adapter
      relative_cap?: bigint; // 100% = 1e18, max 100% -> 1e18
      absolute_cap?: bigint;
    }[];
  }[];

  timelockFunctionsToIncrease: Partial<Record<TimelockFunction, number>>;
}

//*******************************************************************
//*  This is what you need to change to create a vault              *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const VAULT_ADDRESS = "0x2B68d57CC2d5b763609570047E2435B8ECD9ff32";

const CURATORS_SETTINGS_CONFIG: CuratorsSettingsConfig = {
  allocator: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],

  performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
  management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
  performance_fee: parseUnits("0.05", 18), // 5%
  management_fee: parseUnits("0.05", 18), // 5%
  max_rate: parseUnits("200", 18), // 200%

  underlying_vaults: [
    {
      address: "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A", // Spark Morpho vault
      type: "MorphoVaultV1",
      deallocate_penalty: parseEther("0.02"),
      caps_per_id: [
        {
          relative_cap: parseUnits("0.24", 18), // 34%
          absolute_cap: parseUnits("200", 6), // 800 USDC
        },
      ],
    },
    {
      address: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738", // Seamless Morpho vault
      type: "MorphoVaultV1",
      deallocate_penalty: parseEther("0.02"),
      // caps_per_id: [
      //   {
      //     id: "0x6feb657053c1e6004f89bb249621bde61a42536e87fdcdf6e5cc01e5f867ff8b", // ID from Adapter 1
      //     relative_cap: parseUnits("0.3", 18), // 30%
      //     absolute_cap: parseUnits("300", 6), // 300 USDC
      //   },
      // ],
    },
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
    const NEEDS_TO_CAP_BY_ID = // There must be at least one underlying vault with at least one cap_per_id
      CURATORS_SETTINGS_CONFIG.underlying_vaults &&
      CURATORS_SETTINGS_CONFIG.underlying_vaults.reduce(
        (acc, underlying) =>
          acc +
          (underlying.caps_per_id && underlying.caps_per_id.length > 0 ? 1 : 0),
        0
      ) > 0;

    if (CURATORS_SETTINGS_CONFIG.underlying_vaults) {
      // Maps to store adapter addresses and deallocate penalties
      const mappingAdapters = new Map<string, string>(); // Will store the address of the adapter for each underlying vault
      const mappingDeallocatePenalties = new Map<string, bigint>(); // Will store deallocate penalties per adapter

      // First round: create adapters if needed and build mapping
      for (const underlying of CURATORS_SETTINGS_CONFIG.underlying_vaults) {
        let adapterAddress;

        console.log(`- Processing underlying vault: ${underlying.address}`);

        // Try to find existing adapter
        try {
          adapterAddress = await client.findAdapter(
            "morphoVaultV1",
            VAULT_ADDRESS,
            underlying.address
          );
          console.log(
            `  - Found existing adapter: ${adapterAddress} for ${underlying.address}`
          );
        } catch (error) {
          console.log(
            `  - No existing adapter found for ${underlying.address}`
          );
        }

        // If no adapter found or it's the zero address, create one
        if (
          !adapterAddress ||
          adapterAddress === "0x0000000000000000000000000000000000000000"
        ) {
          console.log(`    - Creating new adapter for ${underlying.address}`);
          const tx = await client.deployAdapter(
            "morphoVaultV1",
            VAULT_ADDRESS,
            underlying.address
          );
          const receipt = await tx.wait();
          adapterAddress = tx.adapterAddress;
          console.log(`    - Deployed new adapter: ${adapterAddress}`);
        }

        // Store the adapter address in mapping
        if (adapterAddress) {
          mappingAdapters.set(underlying.address, adapterAddress);
        }

        // Store deallocate penalty if it exists
        if (underlying.deallocate_penalty) {
          mappingDeallocatePenalties.set(
            underlying.address,
            underlying.deallocate_penalty
          );
        }

        await waitHalfSecond();
      }

      // Second round: add the adapters to the vault
      console.log("  - Adding adapters to vault...");
      for (const [underlyingAddress, adapterAddress] of mappingAdapters) {
        try {
          console.log(
            `    - Setting adapter ${adapterAddress} for underlying ${underlyingAddress}`
          );
          await client.instantSetIsAdapter(VAULT_ADDRESS, adapterAddress, true);
          await waitHalfSecond();
        } catch (error) {
          console.error(
            `    - Error setting adapter for ${underlyingAddress}:`,
            error
          );
        }
      }

      // Third round: set deallocate penalties for adapters
      console.log("  - Setting deallocate penalties for adapters...");
      for (const [underlyingAddress, penalty] of mappingDeallocatePenalties) {
        const adapterAddress = mappingAdapters.get(underlyingAddress);
        if (!adapterAddress) {
          console.warn(
            `    - No adapter found for ${underlyingAddress}, skipping deallocate penalty`
          );
          continue;
        }
        try {
          console.log(
            `    - Setting deallocate penalty ${penalty} for ${adapterAddress}`
          );
          await client.instantSetForceDeallocatePenalty(
            VAULT_ADDRESS,
            adapterAddress,
            penalty
          );
          await waitHalfSecond();
        } catch (error) {
          console.error(
            `    - Error setting deallocate penalty for ${adapterAddress}:`,
            error
          );
        }
      }

      console.log("  - Adapter mapping completed:");
      console.log(
        "    - Underlying -> Adapter mapping:",
        Object.fromEntries(mappingAdapters)
      );
      console.log(
        "    - Deallocate penalties mapping:",
        Object.fromEntries(mappingDeallocatePenalties)
      );

      // Fourth round: set caps per ID if configured
      if (NEEDS_TO_CAP_BY_ID && CURATORS_SETTINGS_CONFIG.underlying_vaults) {
        console.log("  - Setting caps per ID...");

        for (const underlying of CURATORS_SETTINGS_CONFIG.underlying_vaults) {
          if (underlying.caps_per_id && underlying.caps_per_id.length > 0) {
            for (const capConfig of underlying.caps_per_id) {
              try {
                // Get the adapter address for this underlying
                const adapterAddress = mappingAdapters.get(underlying.address);
                if (!adapterAddress) {
                  console.warn(
                    `    - No adapter found for underlying ${underlying.address}, skipping caps for ID ${capConfig.id}`
                  );
                  continue;
                }

                console.log(
                  `    - Setting caps for ID ${capConfig.id} (from underlying ${underlying.address}, adapter ${adapterAddress})`
                );

                const idData = getIdData("this", [adapterAddress]);

                if (capConfig.relative_cap) {
                  const vaultId = await client.getIdsAdapterVaultV1(
                    adapterAddress
                  );

                  const currentRelativeCap = await client.getRelativeCap(
                    VAULT_ADDRESS,
                    vaultId
                  );
                  // console.log(
                  //   "currentRelativeCap",
                  //   currentRelativeCap,
                  //   " and capConfig.relative_cap",
                  //   capConfig.relative_cap,
                  //   " and currentRelativeCap <= capConfig.relative_cap",
                  //   currentRelativeCap <= capConfig.relative_cap
                  // );
                  if (currentRelativeCap <= capConfig.relative_cap) {
                    console.log(
                      `    - Increasing relative cap ${capConfig.relative_cap} for ID ${capConfig.id} with idData ${idData}`
                    );
                    await client.instantIncreaseRelativeCap(
                      VAULT_ADDRESS,
                      idData, // Use the ID directly as idData
                      capConfig.relative_cap
                    );
                  } else {
                    console.log(
                      `    - Decreasing relative cap ${capConfig.relative_cap} for ID ${capConfig.id} with idData ${idData}`
                    );
                    await client.decreaseRelativeCap(
                      VAULT_ADDRESS,
                      idData, // Use the ID directly as idData
                      capConfig.relative_cap
                    );
                  }
                  await waitHalfSecond();
                }

                if (capConfig.absolute_cap) {
                  const vaultId = await client.getIdsAdapterVaultV1(
                    adapterAddress
                  );

                  const currentAbsoluteCap = await client.getAbsoluteCap(
                    VAULT_ADDRESS,
                    vaultId
                  );
                  if (currentAbsoluteCap <= capConfig.absolute_cap) {
                    console.log(
                      `    - Increasing absolute cap ${capConfig.absolute_cap} for ID ${capConfig.id} with idData ${idData}`
                    );
                    await client.instantIncreaseAbsoluteCap(
                      VAULT_ADDRESS,
                      idData, // Use the ID directly as idData
                      capConfig.absolute_cap
                    );
                  } else {
                    console.log(
                      `    -  Decreasing absolute cap ${capConfig.absolute_cap} for ID ${capConfig.id} with idData ${idData}`
                    );
                    await client.decreaseAbsoluteCap(
                      VAULT_ADDRESS,
                      idData, // Use the ID directly as idData
                      capConfig.absolute_cap
                    );
                  }

                  await waitHalfSecond();
                }
              } catch (error) {
                console.error(
                  `    - Error setting caps for ID ${capConfig.id}:`,
                  error
                );
              }
            }
          }
        }
      }
    }

    await finalReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error curating vault:", error);
  }
}

main();
