import { ethers } from "ethers";
import {
  callContractMethod,
  executeContractMethod,
  formatContractError,
} from "../../utils/contractErrorHandler";
import { ContractProvider } from "../../utils";
import { DeployAdapterResult } from "./GlobalAdapters";

// ========================================
// Factory Functions
// ========================================

export async function deployERC4626Adapter(
  contractProvider: ContractProvider,
  vaultAddress: string,
  morphoVaultV1: string
): Promise<DeployAdapterResult> {
  const adapterFactoryContract =
    await contractProvider.getERC4626AdapterFactoryContract();

  try {
    // First simulate the call to get the adapter address that will be created
    const adapterAddress =
      await adapterFactoryContract.createMorphoVaultV1Adapter.staticCall(
        vaultAddress,
        morphoVaultV1
      );

    // Then execute the actual transaction
    const tx = await executeContractMethod(
      adapterFactoryContract,
      "createMorphoVaultV1Adapter",
      vaultAddress,
      morphoVaultV1
    );

    // Add the adapter address property to the transaction object
    (tx as DeployAdapterResult).adapterAddress = adapterAddress;
    return tx as DeployAdapterResult;
  } catch (error) {
    throw formatContractError("deployMorphoVaultV1Adapter", error);
  }
}

// Read Functions

export async function isERC4626Adapter(
  contractProvider: ContractProvider,
  account: string
): Promise<boolean> {
  const adapterFactoryContract =
    await contractProvider.getERC4626AdapterFactoryContract();
  return await callContractMethod(
    adapterFactoryContract,
    "isMorphoVaultV1Adapter",
    [account]
  );
}

export async function findERC4626Adapter(
  contractProvider: ContractProvider,
  vaultAddress: string,
  morphoVaultV1: string
): Promise<string> {
  const adapterFactoryContract =
    await contractProvider.getERC4626AdapterFactoryContract();
  return await callContractMethod(
    adapterFactoryContract,
    "morphoVaultV1Adapter",
    [vaultAddress, morphoVaultV1]
  );
}

// ========================================
// Adapters
// ========================================

/**
 * Get the ids of the markets of a Morpho Vault V1 Adapter
 * @param contractProvider The contract provider
 * @param adapterAddress The address of the Morpho Vault V1 Adapter
 * @returns The ids of the markets
 */
export async function getIds(contract: ethers.Contract): Promise<string> {
  return await callContractMethod(contract, "ids", []);
}

export async function getUnderlying(
  contract: ethers.Contract
): Promise<string> {
  return await callContractMethod(contract, "morphoVaultV1", []);
}

// Read Functions
