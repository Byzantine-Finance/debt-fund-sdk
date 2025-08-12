import { ethers } from "ethers";
import { ContractProvider, executeContractMethod } from "../../utils";
import { getNetworkConfig } from "../../constants/networks";

export interface SubVault {
  vault: string;
  percentage: bigint;
}

export interface CreateMetaVaultParams {
  asset: string;
  vaultName: string;
  vaultSymbol: string;
  subVaults: SubVault[];
  curatorFeePercentage: bigint;
}

export class CreateClient {
  private contractProvider: ContractProvider;
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.contractProvider = new ContractProvider(provider, signer);
    this.provider = provider;
  }

  /**
   * Get the factory address for the current network
   * @returns Factory address
   */
  private async getFactoryAddress(): Promise<string> {
    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId) as any;
    const networkConfig = getNetworkConfig(chainId);

    if (!networkConfig?.byzantineFactoryAddress) {
      throw new Error(`MetaVaultFactory not deployed on chain ${chainId}`);
    }

    return networkConfig.byzantineFactoryAddress;
  }

  /**
   * Create a new MetaVault
   * @param params Parameters for creating the MetaVault
   * @returns Transaction response
   */
  async createMetaVault(
    params: CreateMetaVaultParams
  ): Promise<ethers.TransactionResponse> {
    const factoryAddress = await this.getFactoryAddress();
    const factoryContract =
      this.contractProvider.getMetaVaultFactoryContract(factoryAddress);

    const subVaultsFormatted = params.subVaults.map((subVault) => [
      subVault.vault,
      subVault.percentage,
    ]);

    return await executeContractMethod(
      factoryContract,
      "createMetaVault",
      params.asset,
      params.vaultName,
      params.vaultSymbol,
      subVaultsFormatted,
      params.curatorFeePercentage
    );
  }
}
