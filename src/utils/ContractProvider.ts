import { ethers } from "ethers";
import { MetaVaultFactoryAbi, MetaVaultAbi } from "../constants";

/**
 * Simple Contract Provider for MetaVault and MetaVaultFactory contracts
 */
export class ContractProvider {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  /**
   * Creates a new ContractProvider instance
   * @param provider Ethereum provider
   * @param signer Optional signer for transactions
   */
  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
  }

  /**
   * Get the MetaVault contract instance
   * @param vaultAddress The address of the MetaVault
   * @returns The MetaVault contract instance
   */
  public getMetaVaultContract(vaultAddress: string): ethers.Contract {
    return new ethers.Contract(
      vaultAddress,
      MetaVaultAbi,
      this.signer || this.provider
    );
  }

  /**
   * Get the MetaVaultFactory contract instance
   * @param factoryAddress The address of the MetaVaultFactory
   * @returns The MetaVaultFactory contract instance
   */
  public getMetaVaultFactoryContract(factoryAddress: string): ethers.Contract {
    return new ethers.Contract(
      factoryAddress,
      MetaVaultFactoryAbi,
      this.signer || this.provider
    );
  }
}
