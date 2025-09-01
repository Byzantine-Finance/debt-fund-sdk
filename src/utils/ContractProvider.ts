import { ethers } from "ethers";
import {
  MorphoVaultV1AdapterFactoryABI,
  MorphoMarketV1AdapterFactoryABI,
  MorphoVaultV1AdapterABI,
  MorphoMarketV1AdapterABI,
  ERC4626MerklAdapterFactoryABI,
  ERC4626MerklAdapterABI,
  CompoundV3AdapterFactoryABI,
  CompoundV3AdapterABI,
  VAULT_FACTORY_ABI,
  VAULT_ABI,
} from "../constants";
import { getNetworkConfig } from "../constants/networks";
import { ChainsOptions } from "../types";

/**
 * Smart Contract Provider for Vault and VaultFactory contracts
 * Automatically detects the chain ID from the provider
 */
export class ContractProvider {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private chainIdCache?: ChainsOptions;

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
   * Get the chain ID from the provider (cached)
   * @returns The chain ID
   */
  private async getChainId(): Promise<ChainsOptions> {
    if (this.chainIdCache) {
      return this.chainIdCache;
    }

    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId) as ChainsOptions;

    // Validate that the chain is supported
    const config = getNetworkConfig(chainId);
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    this.chainIdCache = chainId;
    return chainId;
  }

  /**
   * Get the factory address for the current network
   * @returns Factory address
   */
  private async getFactoryAddress(): Promise<string> {
    const chainId = await this.getChainId();
    return getNetworkConfig(chainId).byzantineFactoryAddress;
  }

  /**
   * Get the adapter factory address for the current network
   * @returns Adapter factory address
   */

  private async getERC4626AdapterFactoryAddress(): Promise<string> {
    const chainId = await this.getChainId();
    return getNetworkConfig(chainId).adapters.erc4626AdapterFactory;
  }

  private async getERC4626MerklAdapterFactoryAddress(): Promise<string> {
    const chainId = await this.getChainId();
    return getNetworkConfig(chainId).adapters.erc4626MerklAdapterFactory;
  }

  private async getCompoundV3AdapterFactoryAddress(): Promise<string> {
    const chainId = await this.getChainId();
    return getNetworkConfig(chainId).adapters.compoundV3AdapterFactory;
  }

  private async getMorphoMarketV1AdapterFactoryAddress(): Promise<string> {
    const chainId = await this.getChainId();
    return getNetworkConfig(chainId).adapters.morphoMarketV1AdapterFactory;
  }

  /**
   * Get the Vault contract instance
   * @param vaultAddress The address of the Vault
   * @returns The Vault contract instance
   */
  public getVaultContract(vaultAddress: string): ethers.Contract {
    return new ethers.Contract(
      vaultAddress,
      VAULT_ABI,
      this.signer || this.provider
    );
  }

  public getERC4626AdapterContract(adapterAddress: string): ethers.Contract {
    return new ethers.Contract(
      adapterAddress,
      MorphoVaultV1AdapterABI,
      this.signer || this.provider
    );
  }

  public getERC4626MerklAdapterContract(
    adapterAddress: string
  ): ethers.Contract {
    return new ethers.Contract(
      adapterAddress,
      ERC4626MerklAdapterABI,
      this.signer || this.provider
    );
  }

  public getMorphoMarketV1AdapterContract(
    adapterAddress: string
  ): ethers.Contract {
    return new ethers.Contract(
      adapterAddress,
      MorphoMarketV1AdapterABI,
      this.signer || this.provider
    );
  }

  public getCompoundV3AdapterContract(adapterAddress: string): ethers.Contract {
    return new ethers.Contract(
      adapterAddress,
      CompoundV3AdapterABI,
      this.signer || this.provider
    );
  }

  /**
   * Get the VaultFactory contract instance for the current network
   * @returns The VaultFactory contract instance
   */
  public async getVaultFactoryContract(): Promise<ethers.Contract> {
    const factoryAddress = await this.getFactoryAddress();
    return new ethers.Contract(
      factoryAddress,
      VAULT_FACTORY_ABI,
      this.signer || this.provider
    );
  }

  /**
   * Get the Morpho Vault V1 Adapter Factory contract instance
   * @returns The Morpho Vault V1 Adapter Factory contract instance
   */
  public async getERC4626AdapterFactoryContract(): Promise<ethers.Contract> {
    const adapterFactoryAddress = await this.getERC4626AdapterFactoryAddress();
    return new ethers.Contract(
      adapterFactoryAddress,
      MorphoVaultV1AdapterFactoryABI,
      this.signer || this.provider
    );
  }

  public async getERC4626MerklAdapterFactoryContract(): Promise<ethers.Contract> {
    const adapterFactoryAddress =
      await this.getERC4626MerklAdapterFactoryAddress();
    return new ethers.Contract(
      adapterFactoryAddress,
      ERC4626MerklAdapterFactoryABI,
      this.signer || this.provider
    );
  }

  public async getCompoundV3AdapterFactoryContract(): Promise<ethers.Contract> {
    const adapterFactoryAddress =
      await this.getCompoundV3AdapterFactoryAddress();
    return new ethers.Contract(
      adapterFactoryAddress,
      CompoundV3AdapterFactoryABI,
      this.signer || this.provider
    );
  }

  /**
   * Get the Morpho Market V1 Adapter Factory contract instance
   * @returns The Morpho Market V1 Adapter Factory contract instance
   */
  public async getMorphoMarketV1AdapterFactoryContract(): Promise<ethers.Contract> {
    const adapterFactoryAddress =
      await this.getMorphoMarketV1AdapterFactoryAddress();
    return new ethers.Contract(
      adapterFactoryAddress,
      MorphoMarketV1AdapterFactoryABI,
      this.signer || this.provider
    );
  }

  /**
   * Get the current chain ID
   * @returns The chain ID
   */
  public async getCurrentChainId(): Promise<ChainsOptions> {
    return this.getChainId();
  }

  /**
   * Get the network configuration for the current chain
   * @returns Network configuration
   */
  public async getNetworkConfig() {
    const chainId = await this.getChainId();
    return getNetworkConfig(chainId);
  }
}
