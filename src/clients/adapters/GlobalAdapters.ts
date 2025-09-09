import { ethers } from "ethers";
import {
  callContractMethod,
  executeContractMethod,
  formatContractError,
} from "../../utils/contractErrorHandler";
import { ContractProvider } from "../../utils";
import { AdapterType } from "./AdaptersClient";
import { MorphoVaultV1AdapterFactoryABI } from "../../constants/abis";
import { getNetworkConfig } from "../../constants/networks";
import * as ERC4626AdaptersFunctions from "./ERC4626Adapters";
import * as ERC4626MerklAdaptersFunctions from "./ERC4626MerklAdapters";
import * as CompoundV3AdaptersFunctions from "./CompoundV3Adapters";
import * as MorphoMarketV1AdaptersFunctions from "./MorphoMarketV1Adapters";
import * as GlobalAdaptersFunctions from "./GlobalAdapters";

// ========================================
// Global Adapters
// ========================================
//
// This module provides functions to retrieve general information about any adapter,
// including its type and the address of its factory.
// These utilities are adapter-agnostic and work for all adapter types.

export interface DeployAdapterResult
  extends ethers.ContractTransactionResponse {
  adapterAddress: string;
}

export async function deployAdapter(
  contractProvider: ContractProvider,
  type: AdapterType,
  parentAddress: string,
  underlyingAddress: string,
  cometRewards?: string
): Promise<DeployAdapterResult> {
  switch (type) {
    case "erc4626":
      return await ERC4626AdaptersFunctions.deployERC4626Adapter(
        contractProvider,
        parentAddress,
        underlyingAddress
      );
    case "erc4626Merkl":
      return await ERC4626MerklAdaptersFunctions.deployERC4626MerklAdapter(
        contractProvider,
        parentAddress,
        underlyingAddress
      );
    case "compoundV3":
      if (!cometRewards) {
        throw new Error(
          "Comet rewards are required to deploy compoundV3 adapter"
        );
      }
      return await CompoundV3AdaptersFunctions.deployCompoundV3Adapter(
        contractProvider,
        parentAddress,
        underlyingAddress,
        cometRewards
      );
    case "morphoMarketV1":
      return await MorphoMarketV1AdaptersFunctions.deployMorphoMarketV1Adapter(
        contractProvider,
        parentAddress,
        underlyingAddress
      );
  }
}

export async function getAdapterFactoryAddress(
  contractProvider: ContractProvider,
  adapterAddress: string
): Promise<string> {
  try {
    const adapterContract =
      contractProvider.getMorphoMarketV1AdapterContract(adapterAddress);

    return (
      await callContractMethod(adapterContract, "factory", [])
    ).toLowerCase();
  } catch (error) {
    throw formatContractError("getAdapterFactoryAddress", error);
  }
}

export async function getAdapterType(
  contractProvider: ContractProvider,
  adapterAddress: string
): Promise<AdapterType | undefined> {
  try {
    const adapterFactoryAddress = (
      await getAdapterFactoryAddress(contractProvider, adapterAddress)
    ).toLowerCase();
    const networkConfig = await contractProvider.getNetworkConfig();
    switch (adapterFactoryAddress) {
      case networkConfig.adapters.erc4626AdapterFactory.toLowerCase():
        return "erc4626";
      case networkConfig.adapters.erc4626MerklAdapterFactory.toLowerCase():
        return "erc4626Merkl";
      case networkConfig.adapters.compoundV3AdapterFactory.toLowerCase():
        return "compoundV3";
      case networkConfig.adapters.morphoMarketV1AdapterFactory.toLowerCase():
        return "morphoMarketV1";
      default:
        throw new Error(
          `Invalid adapter factory address: ${adapterFactoryAddress}`
        );
    }
  } catch (error) {
    throw formatContractError("getAdapterType", error);
  }
}

export async function getIsAdapter(
  contractProvider: ContractProvider,
  adapterType: AdapterType,
  adapterAddress: string
): Promise<boolean> {
  switch (adapterType) {
    case "erc4626":
      return await ERC4626AdaptersFunctions.isERC4626Adapter(
        contractProvider,
        adapterAddress
      );
    case "erc4626Merkl":
      return await ERC4626MerklAdaptersFunctions.isERC4626MerklAdapter(
        contractProvider,
        adapterAddress
      );
    case "compoundV3":
      return await CompoundV3AdaptersFunctions.isCompoundV3Adapter(
        contractProvider,
        adapterAddress
      );
    case "morphoMarketV1":
      return await MorphoMarketV1AdaptersFunctions.isMorphoMarketV1Adapter(
        contractProvider,
        adapterAddress
      );
    default:
      throw new Error(`Invalid adapter type: ${adapterType}`);
  }
}

// Read Functions
