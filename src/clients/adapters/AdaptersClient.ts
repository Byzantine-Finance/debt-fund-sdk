import { ethers } from "ethers";
import { ContractProvider } from "../../utils";

// Import all the specialized functions
import * as MorphoVaultV1AdaptersFunctions from "./MorphoVaultV1Adapters";
import * as MorphoMarketV1AdaptersFunctions from "./MorphoMarketV1Adapters";

export type AdapterType = "morphoVaultV1" | "morphoMarketV1";

/**
 * Factory client for deploying and managing adapters
 * Provides:
 * - Adapter deployment through factories
 * - Adapter lookup and validation
 * - Utility methods for adapter factories
 */
export class AdaptersFactoryClient {
  private contractProvider: ContractProvider;

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.contractProvider = new ContractProvider(provider, signer);
  }

  // ========================================
  // ADAPTER DEPLOYMENT
  // ========================================

  /**
   * Deploy a new adapter of the specified type
   * @param type The type of adapter to deploy
   * @param parentAddress The parent vault address
   * @param underlyingAddress The underlying address (morphoVault or morpho)
   * @returns Transaction response with adapter address
   */
  async deployAdapter(
    type: AdapterType,
    parentAddress: string,
    underlyingAddress: string
  ): Promise<MorphoVaultV1AdaptersFunctions.DeployAdapterResult> {
    if (type === "morphoVaultV1") {
      return await MorphoVaultV1AdaptersFunctions.deployMorphoVaultV1Adapter(
        this.contractProvider,
        parentAddress,
        underlyingAddress
      );
    } else if (type === "morphoMarketV1") {
      return await MorphoMarketV1AdaptersFunctions.deployMorphoMarketV1Adapter(
        this.contractProvider,
        parentAddress,
        underlyingAddress
      );
    } else {
      throw new Error(`Invalid adapter type: ${type}`);
    }
  }

  // ========================================
  // ADAPTER LOOKUP
  // ========================================

  /**
   * Find an existing adapter address
   * @param type The type of adapter
   * @param parentAddress The parent vault address
   * @param underlyingAddress The underlying address
   * @returns The adapter address
   */
  async findAdapter(
    type: AdapterType,
    parentAddress: string,
    underlyingAddress: string
  ): Promise<string> {
    if (type === "morphoVaultV1") {
      return await MorphoVaultV1AdaptersFunctions.findMorphoVaultV1Adapter(
        this.contractProvider,
        parentAddress,
        underlyingAddress
      );
    } else if (type === "morphoMarketV1") {
      return await MorphoMarketV1AdaptersFunctions.findMorphoMarketV1Adapter(
        this.contractProvider,
        parentAddress,
        underlyingAddress
      );
    } else {
      throw new Error(`Invalid adapter type: ${type}`);
    }
  }

  /**
   * Check if an address is a valid adapter of the specified type
   * @param type The type of adapter
   * @param account The address to check
   * @returns True if the address is a valid adapter
   */
  async isAdapter(type: AdapterType, account: string): Promise<boolean> {
    if (type === "morphoVaultV1") {
      return await MorphoVaultV1AdaptersFunctions.isMorphoVaultV1Adapter(
        this.contractProvider,
        account
      );
    } else if (type === "morphoMarketV1") {
      return await MorphoMarketV1AdaptersFunctions.isMorphoMarketV1Adapter(
        this.contractProvider,
        account
      );
    }
    throw new Error(`Invalid adapter type: ${type}`);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the Morpho Vault V1 Factory contract instance
   */
  async getMorphoVaultV1Factory(): Promise<ethers.Contract> {
    return await this.contractProvider.getMorphoVaultV1AdapterFactoryContract();
  }

  /**
   * Get the Morpho Market V1 Factory contract instance
   */
  async getMorphoMarketV1Factory(): Promise<ethers.Contract> {
    return await this.contractProvider.getMorphoMarketV1AdapterFactoryContract();
  }
}

/**
 * Main client for adapter operations
 * Provides:
 * - AdapterInstance factory for adapter-specific operations
 * - Utility methods for working with adapters
 */
export class AdaptersClient {
  private contractProvider: ContractProvider;

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.contractProvider = new ContractProvider(provider, signer);
  }

  // ========================================
  // ADAPTER INSTANCE FACTORY
  // ========================================

  /**
   * Get an AdapterInstance for a specific adapter
   * This provides a convenient way to work with a single adapter
   * All adapter operations should be done through the returned AdapterInstance
   * @param adapterAddress The adapter address
   * @param type The type of adapter
   * @returns AdapterInstance
   */
  adapter(adapterAddress: string, type: AdapterType): AdapterInstance {
    return new AdapterInstance(this.contractProvider, adapterAddress, type);
  }
}

/**
 * AdapterInstance class for convenient operations on a specific adapter
 * This eliminates the need to pass adapterAddress and type repeatedly
 */
export class AdapterInstance {
  private contractProvider: ContractProvider;
  private adapterAddress: string;
  private adapterType: AdapterType;
  private adapterContract: ethers.Contract;

  constructor(
    contractProvider: ContractProvider,
    adapterAddress: string,
    type: AdapterType
  ) {
    this.contractProvider = contractProvider;
    this.adapterAddress = adapterAddress;
    this.adapterType = type;

    // Get the appropriate contract based on type
    if (type === "morphoVaultV1") {
      this.adapterContract =
        contractProvider.getVaultV1AdapterContract(adapterAddress);
    } else if (type === "morphoMarketV1") {
      this.adapterContract =
        contractProvider.getMarketV1AdapterContract(adapterAddress);
    } else {
      throw new Error(`Invalid adapter type: ${type}`);
    }
  }

  // ========================================
  // ADAPTER OPERATIONS
  // ========================================

  /**
   * Get the IDs for a Morpho Vault V1 Adapter
   * Note: This method only works for morphoVaultV1 adapters
   * @returns The adapter ID
   */
  async getIdsVaultV1(): Promise<string> {
    if (this.adapterType !== "morphoVaultV1") {
      throw new Error("getIdsVaultV1 only works with morphoVaultV1 adapters");
    }
    return await MorphoVaultV1AdaptersFunctions.getIds(this.adapterContract);
  }

  async getUnderlyingVaultFromAdapterV1(): Promise<string> {
    if (this.adapterType !== "morphoVaultV1") {
      throw new Error(
        "getUnderlyingVaultFromAdapterV1 only works with morphoVaultV1 adapters"
      );
    }
    return await MorphoVaultV1AdaptersFunctions.getUnderlying(
      this.adapterContract
    );
  }

  /**
   * Get the IDs for a Morpho Market V1 Adapter
   * Note: This method only works for morphoMarketV1 adapters
   * @param marketParams The market parameters
   * @returns The adapter IDs
   */
  async getIdsMarketV1(
    marketParams: MorphoMarketV1AdaptersFunctions.MarketParams
  ): Promise<string[]> {
    if (this.adapterType !== "morphoMarketV1") {
      throw new Error("getIdsMarketV1 only works with morphoMarketV1 adapters");
    }
    return await MorphoMarketV1AdaptersFunctions.getIds(
      this.adapterContract,
      marketParams
    );
  }

  async getUnderlyingMarketFromAdapterV1(): Promise<string> {
    if (this.adapterType !== "morphoMarketV1") {
      throw new Error(
        "getUnderlyingMarketFromAdapterV1 only works with morphoMarketV1 adapters"
      );
    }
    return await MorphoMarketV1AdaptersFunctions.getUnderlying(
      this.adapterContract
    );
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the adapter address
   * @returns The adapter address
   */
  getAddress(): string {
    return this.adapterAddress;
  }

  /**
   * Get the adapter type
   * @returns The adapter type
   */
  getType(): AdapterType {
    return this.adapterType;
  }

  /**
   * Get the adapter contract instance
   * @returns Adapter contract instance
   */
  getContract(): ethers.Contract {
    return this.adapterContract;
  }
}
