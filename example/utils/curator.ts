import { ByzantineClient } from "../../src";
import { waitHalfSecond } from "./toolbox";
import { CuratorsSettingsConfig } from "../curators-settings";
import { getIdData } from "../../src/clients/curators/Cap";

export async function setupCuratorsSettings(
  client: ByzantineClient,
  vaultAddress: string,
  userAddress: string,
  curatorsSettings: CuratorsSettingsConfig
) {
  try {
    const curator = await client.getCurator(vaultAddress);
    if (curator !== userAddress) {
      console.log("Access denied: only the curator can proceed here.");
      throw new Error("Access denied: only the curator can proceed here.");
    }

    console.log("💰 Setting fees");

    if (curatorsSettings.performance_fee_recipient) {
      const tx = await client.instantSetPerformanceFeeRecipient(
        vaultAddress,
        curatorsSettings.performance_fee_recipient
      );
      await tx.wait();
      await waitHalfSecond();
    }
    if (curatorsSettings.management_fee_recipient) {
      const tx = await client.instantSetManagementFeeRecipient(
        vaultAddress,
        curatorsSettings.management_fee_recipient
      );
      await tx.wait();
      await waitHalfSecond();
    }
    if (curatorsSettings.performance_fee) {
      const tx = await client.instantSetPerformanceFee(
        vaultAddress,
        curatorsSettings.performance_fee
      );
      await tx.wait();
      await waitHalfSecond();
    }
    if (curatorsSettings.management_fee) {
      const tx = await client.instantSetManagementFee(
        vaultAddress,
        curatorsSettings.management_fee
      );
      await tx.wait();
      await waitHalfSecond();
    }
    if (curatorsSettings.max_rate) {
      const tx = await client.instantSetMaxRate(
        vaultAddress,
        curatorsSettings.max_rate
      );
      await tx.wait();
      await waitHalfSecond();
    }

    const newAllocators = curatorsSettings.allocator;

    if (newAllocators && newAllocators.length > 0) {
      for (const allocator of newAllocators) {
        try {
          const isAllocator = await client.getIsAllocator(
            vaultAddress,
            allocator
          );
          if (isAllocator) {
            console.log(`Allocator ${allocator} is already set`);
            continue;
          }
          const tx = await client.instantSetIsAllocator(
            vaultAddress,
            allocator,
            true
          );
          await tx.wait();
        } catch {
          const timelockSetIsAllocator = await client.getTimelock(
            vaultAddress,
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
      curatorsSettings.underlying_vaults &&
      curatorsSettings.underlying_vaults.length > 0;
    const NEEDS_TO_CAP_BY_ID = // There must be at least one underlying vault with at least one cap_per_id
      curatorsSettings.underlying_vaults &&
      curatorsSettings.underlying_vaults.reduce(
        (acc, underlying) =>
          acc +
          (underlying.caps_per_id && underlying.caps_per_id.length > 0 ? 1 : 0),
        0
      ) > 0;

    if (curatorsSettings.underlying_vaults) {
      // Maps to store adapter addresses and deallocate penalties
      const mappingAdapters = new Map<string, string>(); // Will store the address of the adapter for each underlying vault
      const mappingDeallocatePenalties = new Map<string, bigint>(); // Will store deallocate penalties per adapter

      // First round: create adapters if needed and build mapping
      for (const underlying of curatorsSettings.underlying_vaults) {
        let adapterAddress;

        console.log(
          `- Processing underlying vault: ${underlying.address} (${underlying.type})`
        );

        // Try to find existing adapter
        try {
          adapterAddress = await client.findAdapter(
            vaultAddress,
            underlying.address,
            underlying.type
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
            underlying.type,
            vaultAddress,
            underlying.address,
            underlying.comet_rewards
          );
          await tx.wait();
          await waitHalfSecond();
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
          await client.instantSetIsAdapter(vaultAddress, adapterAddress, true);
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
            vaultAddress,
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
      if (NEEDS_TO_CAP_BY_ID && curatorsSettings.underlying_vaults) {
        console.log("  - Setting caps per ID...");

        for (const underlying of curatorsSettings.underlying_vaults) {
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
                  const vaultId = await client.getIdsAdapterERC4626(
                    adapterAddress
                  );

                  const currentRelativeCap = await client.getRelativeCap(
                    vaultAddress,
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
                      vaultAddress,
                      idData, // Use the ID directly as idData
                      capConfig.relative_cap
                    );
                  } else {
                    console.log(
                      `    - Decreasing relative cap ${capConfig.relative_cap} for ID ${capConfig.id} with idData ${idData}`
                    );
                    await client.decreaseRelativeCap(
                      vaultAddress,
                      idData, // Use the ID directly as idData
                      capConfig.relative_cap
                    );
                  }
                  await waitHalfSecond();
                }

                if (capConfig.absolute_cap) {
                  const vaultId = await client.getIdsAdapterERC4626(
                    adapterAddress
                  );

                  const currentAbsoluteCap = await client.getAbsoluteCap(
                    vaultAddress,
                    vaultId
                  );
                  if (currentAbsoluteCap <= capConfig.absolute_cap) {
                    console.log(
                      `    - Increasing absolute cap ${capConfig.absolute_cap} for ID ${capConfig.id} with idData ${idData}`
                    );
                    const tx = await client.instantIncreaseAbsoluteCap(
                      vaultAddress,
                      idData, // Use the ID directly as idData
                      capConfig.absolute_cap
                    );
                    await tx.wait();
                  } else {
                    console.log(
                      `    -  Decreasing absolute cap ${capConfig.absolute_cap} for ID ${capConfig.id} with idData ${idData}`
                    );
                    const tx = await client.decreaseAbsoluteCap(
                      vaultAddress,
                      idData, // Use the ID directly as idData
                      capConfig.absolute_cap
                    );
                    await tx.wait();
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
  } catch (error) {
    console.error("Error curating vault:", error);
  }
}
