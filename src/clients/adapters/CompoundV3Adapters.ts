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

export async function deployCompoundV3Adapter(
  contractProvider: ContractProvider,
  vaultAddress: string,
  comet: string,
  cometRewards: string
): Promise<DeployAdapterResult> {
  const adapterFactoryContract =
    await contractProvider.getCompoundV3AdapterFactoryContract();

  try {
    // First simulate the call to get the adapter address that will be created
    const adapterAddress =
      await adapterFactoryContract.createCompoundV3Adapter.staticCall(
        vaultAddress,
        comet,
        cometRewards
      );

    // Then execute the actual transaction
    const tx = await executeContractMethod(
      adapterFactoryContract,
      "createCompoundV3Adapter",
      vaultAddress,
      comet,
      cometRewards
    );

    // Add the adapter address property to the transaction object
    (tx as DeployAdapterResult).adapterAddress = adapterAddress;
    return tx as DeployAdapterResult;
  } catch (error) {
    throw formatContractError("createCompoundV3Adapter", error);
  }
}

// Read Functions

export async function isCompoundV3Adapter(
  contractProvider: ContractProvider,
  account: string
): Promise<boolean> {
  const adapterFactoryContract =
    await contractProvider.getCompoundV3AdapterFactoryContract();
  return await callContractMethod(
    adapterFactoryContract,
    "isCompoundV3Adapter",
    [account]
  );
}

export async function findCompoundV3Adapter(
  contractProvider: ContractProvider,
  vaultAddress: string,
  comet: string,
  cometRewards: string
): Promise<string> {
  const adapterFactoryContract =
    await contractProvider.getCompoundV3AdapterFactoryContract();
  return await callContractMethod(adapterFactoryContract, "compoundV3Adapter", [
    vaultAddress,
    comet,
    cometRewards,
  ]);
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
  return await callContractMethod(contract, "comet", []);
}

// Read Functions
