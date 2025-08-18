import { ethers } from "ethers";
import {
  callContractMethod,
  executeContractMethod,
  formatContractError,
} from "../../utils/contractErrorHandler";
import { ContractProvider } from "../../utils";

// ========================================
// Factory Functions
// ========================================

export interface DeployAdapterResult
  extends ethers.ContractTransactionResponse {
  adapterAddress: string;
}

export async function deployMorphoVaultV1Adapter(
  contractProvider: ContractProvider,
  vaultAddress: string,
  underlyingVault: string
): Promise<DeployAdapterResult> {
  const adapterFactoryContract =
    await contractProvider.getMorphoVaultV1AdapterFactoryContract();

  try {
    // First simulate the call to get the adapter address that will be created
    const adapterAddress =
      await adapterFactoryContract.createMorphoVaultV1Adapter.staticCall(
        vaultAddress,
        underlyingVault
      );

    // Then execute the actual transaction
    const tx = await executeContractMethod(
      adapterFactoryContract,
      "createMorphoVaultV1Adapter",
      vaultAddress,
      underlyingVault
    );

    // Add the adapter address property to the transaction object
    (tx as DeployAdapterResult).adapterAddress = adapterAddress;
    return tx as DeployAdapterResult;
  } catch (error) {
    throw formatContractError("deployMorphoVaultV1Adapter", error);
  }
}

// Read Functions

export async function isMorphoVaultV1Adapter(
  contractProvider: ContractProvider,
  account: string
): Promise<boolean> {
  const adapterFactoryContract =
    await contractProvider.getMorphoVaultV1AdapterFactoryContract();
  return await callContractMethod(
    adapterFactoryContract,
    "isMorphoVaultV1Adapter",
    account
  );
}

export async function findMorphoVaultV1Adapter(
  contractProvider: ContractProvider,
  vaultAddress: string,
  underlyingVault: string
): Promise<string> {
  const adapterFactoryContract =
    await contractProvider.getMorphoVaultV1AdapterFactoryContract();
  return await callContractMethod(
    adapterFactoryContract,
    "morphoVaultV1Adapter",
    [vaultAddress, underlyingVault]
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
export async function getIds(
  contractProvider: ContractProvider,
  adapterAddress: string
): Promise<string> {
  const contract = await contractProvider.getMorphoVaultV1AdapterContract(
    adapterAddress
  );
  return await callContractMethod(contract, "ids", []);
}
