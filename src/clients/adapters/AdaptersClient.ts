import { ethers } from "ethers";
import { ContractProvider } from "../../utils";

// Import all the specialized functions
import * as ERC4626AdaptersFunctions from "./ERC4626Adapters";
import * as ERC4626MerklAdaptersFunctions from "./ERC4626MerklAdapters";
import * as CompoundV3AdaptersFunctions from "./CompoundV3Adapters";
import * as MorphoMarketV1AdaptersFunctions from "./MorphoMarketV1Adapters";
import * as GlobalAdaptersFunctions from "./GlobalAdapters";
import { DeployAdapterResult } from "./GlobalAdapters";

export type AdapterType =
  | "erc4626"
  | "erc4626Merkl"
  | "compoundV3"
  | "morphoMarketV1";

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
   * @param cometRewards The comet rewards address (only required for compoundV3 adapters)
   * @returns Transaction response with adapter address
   */
  async deployAdapter(
    type: AdapterType,
    parentAddress: string,
    underlyingAddress: string,
    cometRewards?: string
  ): Promise<DeployAdapterResult> {
    return await GlobalAdaptersFunctions.deployAdapter(
      this.contractProvider,
      type,
      parentAddress,
      underlyingAddress,
      cometRewards
    );
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
    switch (type) {
      case "erc4626":
        return await ERC4626AdaptersFunctions.findERC4626Adapter(
          this.contractProvider,
          parentAddress,
          underlyingAddress
        );
      case "erc4626Merkl":
        return await ERC4626MerklAdaptersFunctions.findERC4626MerklAdapter(
          this.contractProvider,
          parentAddress,
          underlyingAddress
        );
      case "compoundV3":
        return await CompoundV3AdaptersFunctions.findCompoundV3Adapter(
          this.contractProvider,
          parentAddress,
          underlyingAddress
        );
      case "morphoMarketV1":
        return await MorphoMarketV1AdaptersFunctions.findMorphoMarketV1Adapter(
          this.contractProvider,
          parentAddress,
          underlyingAddress
        );
      default:
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
    return await GlobalAdaptersFunctions.getIsAdapter(
      this.contractProvider,
      type,
      account
    );
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the Morpho Vault V1 Factory contract instance, named ERC4626Factory
   */
  async getERC4626Factory(): Promise<ethers.Contract> {
    return await this.contractProvider.getERC4626AdapterFactoryContract();
  }

  /**
   * Get the ERC4626Merkl Factory contract instance, named ERC4626MerklFactory
   */
  async getERC4626MerklFactory(): Promise<ethers.Contract> {
    return await this.contractProvider.getERC4626MerklAdapterFactoryContract();
  }

  /**
   * Get the Compound V3 Factory contract instance, named CompoundV3Factory
   */
  async getCompoundV3Factory(): Promise<ethers.Contract> {
    return await this.contractProvider.getCompoundV3AdapterFactoryContract();
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

  globalAdapter(adapterAddress: string): AdapterInstance {
    return new AdapterInstance(
      this.contractProvider,
      adapterAddress,
      "erc4626"
    ); // The type is not important here
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
    switch (type) {
      case "erc4626":
        this.adapterContract =
          contractProvider.getERC4626AdapterContract(adapterAddress);
        break;
      case "erc4626Merkl":
        this.adapterContract =
          contractProvider.getERC4626MerklAdapterContract(adapterAddress);
        break;
      case "compoundV3":
        this.adapterContract =
          contractProvider.getCompoundV3AdapterContract(adapterAddress);
        break;
      case "morphoMarketV1":
        this.adapterContract =
          contractProvider.getMorphoMarketV1AdapterContract(adapterAddress);
        break;
      default:
        throw new Error(`Invalid adapter type: ${type}`);
    }
  }

  // ========================================
  // ADAPTER OPERATIONS
  // ========================================

  // ========================================
  // = ERC4626 ADAPTER OPERATIONS
  // ========================================
  /**
   * Get the IDs for a Morpho Vault V1 Adapter
   * Note: This method only works for morphoVaultV1 adapters
   * @returns The adapter ID
   */
  async getIdsERC4626(): Promise<string> {
    if (this.adapterType !== "erc4626") {
      throw new Error("getIdsERC4626 only works with erc4626 adapters");
    }
    return await ERC4626AdaptersFunctions.getIds(this.adapterContract);
  }

  async getUnderlyingERC4626(): Promise<string> {
    if (this.adapterType !== "erc4626") {
      throw new Error(
        "getUnderlyingVaultFromAdapterV1 only works with erc4626 adapters"
      );
    }
    return await ERC4626AdaptersFunctions.getUnderlying(this.adapterContract);
  }

  // ========================================
  // = ERC4626Merkl ADAPTER OPERATIONS
  // ========================================
  /**
   * Get the IDs for a Morpho Vault V1 Adapter
   * Note: This method only works for morphoVaultV1 adapters
   * @returns The adapter ID
   */
  async getIdsERC4626Merkl(): Promise<string> {
    if (this.adapterType !== "erc4626Merkl") {
      throw new Error(
        "getIdsERC4626Merkl only works with erc4626Merkl adapters"
      );
    }
    return await ERC4626MerklAdaptersFunctions.getIds(this.adapterContract);
  }

  async getUnderlyingERC4626Merkl(): Promise<string> {
    if (this.adapterType !== "erc4626Merkl") {
      throw new Error(
        "getUnderlyingVaultFromAdapterV1 only works with erc4626Merkl adapters"
      );
    }
    return await ERC4626MerklAdaptersFunctions.getUnderlying(
      this.adapterContract
    );
  }

  // ========================================
  // = Compound V3 ADAPTER OPERATIONS
  // ========================================
  /**
   * Get the IDs for a Compound V3 Adapter
   * Note: This method only works for compoundV3 adapters
   * @returns The adapter ID
   */
  async getIdsCompoundV3(): Promise<string> {
    if (this.adapterType !== "compoundV3") {
      throw new Error("getIdsCompoundV3 only works with compoundV3 adapters");
    }
    return await CompoundV3AdaptersFunctions.getIds(this.adapterContract);
  }

  async getUnderlyingCompoundV3(): Promise<string> {
    if (this.adapterType !== "compoundV3") {
      throw new Error(
        "getUnderlyingVaultFromAdapterV1 only works with compoundV3 adapters"
      );
    }
    return await CompoundV3AdaptersFunctions.getUnderlying(
      this.adapterContract
    );
  }

  // ========================================
  // = Morpho Market V1 ADAPTER OPERATIONS
  // ========================================
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

  async getMarketParamsListLength(): Promise<number> {
    if (this.adapterType !== "morphoMarketV1") {
      throw new Error(
        "getMarketParamsListLength only works with morphoMarketV1 adapters"
      );
    }
    return await MorphoMarketV1AdaptersFunctions.getMarketParamsListLength(
      this.adapterContract
    );
  }

  async getMarketParamsList(
    index: number
  ): Promise<MorphoMarketV1AdaptersFunctions.MarketParams> {
    if (this.adapterType !== "morphoMarketV1") {
      throw new Error(
        "getMarketParamsList only works with morphoMarketV1 adapters"
      );
    }
    return await MorphoMarketV1AdaptersFunctions.getMarketParamsList(
      this.adapterContract,
      index
    );
  }

  // ========================================
  // Global Adapters
  // ========================================

  async getAdapterFactoryAddress(): Promise<string> {
    return await GlobalAdaptersFunctions.getAdapterFactoryAddress(
      this.contractProvider,
      this.adapterAddress
    );
  }

  async getAdapterType(): Promise<AdapterType | undefined> {
    return await GlobalAdaptersFunctions.getAdapterType(
      this.contractProvider,
      this.adapterAddress
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
