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

export async function deployMorphoMarketV1Adapter(
  contractProvider: ContractProvider,
  vaultAddress: string,
  morphoMarketV1: string
): Promise<DeployAdapterResult> {
  const adapterFactoryContract =
    await contractProvider.getMorphoMarketV1AdapterFactoryContract();

  try {
    console.log("Deploying Morpho Market V1 Adapter");
    // First simulate the call to get the adapter address that will be created
    const adapterAddress =
      await adapterFactoryContract.createMorphoMarketV1Adapter.staticCall(
        vaultAddress,
        morphoMarketV1
      );
    console.log("Adapter address", adapterAddress);
    // Then execute the actual transaction
    const tx = await executeContractMethod(
      adapterFactoryContract,
      "createMorphoMarketV1Adapter",
      [vaultAddress, morphoMarketV1]
    );

    console.log("Transaction", tx);

    // Add the adapter address property to the transaction object
    (tx as DeployAdapterResult).adapterAddress = adapterAddress;
    return tx as DeployAdapterResult;
  } catch (error) {
    throw formatContractError("createMorphoMarketV1Adapter", error);
  }
}

// Read Functions

export async function isMorphoMarketV1Adapter(
  contractProvider: ContractProvider,
  account: string
): Promise<boolean> {
  const adapterFactoryContract =
    await contractProvider.getMorphoMarketV1AdapterFactoryContract();
  return await callContractMethod(
    adapterFactoryContract,
    "isMorphoMarketV1Adapter",
    [account]
  );
}

export async function findMorphoMarketV1Adapter(
  contractProvider: ContractProvider,
  vaultAddress: string,
  morphoMarketV1: string
): Promise<string> {
  const adapterFactoryContract =
    await contractProvider.getMorphoMarketV1AdapterFactoryContract();
  return await callContractMethod(
    adapterFactoryContract,
    "morphoMarketV1Adapter",
    [vaultAddress, morphoMarketV1]
  );
}

// ========================================
// Adapters
// ========================================

export interface MarketParams {
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: string;
}

/**
 * Get the ids of the markets of a Morpho Market V1 Adapter
 * @param contractProvider The contract provider
 * @param adapterAddress The address of the Morpho Market V1 Adapter
 * @param marketParams The market parameters
 * @returns The ids of the markets
 */
export async function getIds(
  contract: ethers.Contract,
  marketParams: MarketParams
): Promise<string[]> {
  return await callContractMethod(contract, "ids", [marketParams]);
}

export async function getUnderlying(
  contract: ethers.Contract
): Promise<string> {
  return await callContractMethod(contract, "morphoMarketV1", []);
}
