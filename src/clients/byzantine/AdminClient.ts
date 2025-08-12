import { ethers } from "ethers";
import { ContractProvider, executeContractMethod } from "../../utils";
import { getNetworkConfig } from "../../constants/networks";

/**
 * Client for Byzantine administrative functions on MetaVaultFactory
 */
export class AdminClient {
  private contractProvider: ContractProvider;
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.contractProvider = new ContractProvider(provider, signer);
    this.provider = provider;
  }

  /**
   * Get the factory address for the current chain
   * @returns The MetaVaultFactory address
   */
  private async getFactoryAddress(): Promise<string> {
    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);

    const networkConfig = getNetworkConfig(chainId as any);
    if (!networkConfig || !networkConfig.byzantineFactoryAddress) {
      throw new Error(`MetaVaultFactory not deployed on chain ${chainId}`);
    }

    return networkConfig.byzantineFactoryAddress;
  }

  /**
   * Get the MetaVaultFactory contract instance
   * @returns The MetaVaultFactory contract instance
   */
  private async getFactoryContract(): Promise<ethers.Contract> {
    const factoryAddress = await this.getFactoryAddress();
    return this.contractProvider.getMetaVaultFactoryContract(factoryAddress);
  }

  /**
   * Get the Byzantine fee settings from the factory
   * @returns Byzantine fee recipient and percentage
   */
  async getByzantineFeeSettings(): Promise<{
    recipient: string;
    percentage: bigint;
  }> {
    const factoryContract = await this.getFactoryContract();
    const [recipient, percentage] =
      await factoryContract.getByzantineFeeSettings();

    return {
      recipient,
      percentage,
    };
  }

  /**
   * Get the Byzantine fee percentage from the factory
   * @returns Byzantine fee percentage
   */
  async getByzantineFeePercentage(): Promise<bigint> {
    const factoryContract = await this.getFactoryContract();
    return await factoryContract.byzantineFeePercentage();
  }

  /**
   * Get the Byzantine fee recipient from the factory
   * @returns Byzantine fee recipient address
   */
  async getByzantineFeeRecipient(): Promise<string> {
    const factoryContract = await this.getFactoryContract();
    return await factoryContract.byzantineFeeRecipient();
  }

  /**
   * Set the Byzantine fee percentage (admin only)
   * @param feePercentage The new fee percentage (in basis points)
   * @returns Transaction response
   */
  async setByzantineFeePercentage(
    feePercentage: bigint
  ): Promise<ethers.TransactionResponse> {
    const factoryContract = await this.getFactoryContract();
    return await executeContractMethod(
      factoryContract,
      "setByzantineFeePercentage",
      feePercentage
    );
  }

  /**
   * Set the Byzantine fee recipient (admin only)
   * @param recipient The new fee recipient address
   * @returns Transaction response
   */
  async setByzantineFeeRecipient(
    recipient: string
  ): Promise<ethers.TransactionResponse> {
    const factoryContract = await this.getFactoryContract();
    return await executeContractMethod(
      factoryContract,
      "setByzantineFeeRecipient",
      recipient
    );
  }
}
