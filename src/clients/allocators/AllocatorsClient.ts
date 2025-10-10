import { Contract, ethers } from "ethers";
import { ContractProvider } from "../../utils/ContractProvider";
import * as AllocateFunctions from "./Allocate";
import * as LiquidityAdapterFunctions from "./LiquidityAdapter";
import * as MaxRateFunctions from "./MaxRate";

/**
 * Client for interacting with vault allocation functions
 * Handles liquidity adapter configuration and asset allocation/deallocation
 */
export class AllocatorsClient {
  private contractProvider: ContractProvider;
  private vaultAddress: string;
  private vaultContract: ethers.Contract;
  private provider: ethers.Provider;

  constructor(
    contractProvider: ContractProvider,
    vaultAddress: string,
    provider: ethers.Provider
  ) {
    this.provider = provider;
    this.contractProvider = contractProvider;
    this.vaultAddress = vaultAddress;
    this.vaultContract = contractProvider.getVaultContract(vaultAddress);
  }

  /**
   * Set the liquidity adapter and associated data for the vault
   * @param newLiquidityAdapter - Address of the new liquidity adapter
   * @param newLiquidityData - Associated data for the liquidity adapter
   * @returns Contract transaction
   */
  async setLiquidityAdapterAndData(
    newLiquidityAdapter: string,
    newLiquidityData: string
  ): Promise<ethers.TransactionResponse> {
    return await LiquidityAdapterFunctions.setLiquidityAdapterAndData(
      this.vaultContract,
      newLiquidityAdapter,
      newLiquidityData
    );
  }

  /**
   * Allocate assets to a specific adapter
   * @param adapter - Address of the adapter to allocate assets to
   * @param data - Additional data for the allocation
   * @param assets - Amount of assets to allocate
   * @returns Contract transaction
   */
  async allocate(
    adapter: string,
    data: string,
    assets: bigint
  ): Promise<ethers.TransactionResponse> {
    return await AllocateFunctions.allocate(
      this.vaultContract,
      adapter,
      data,
      assets
    );
  }

  /**
   * Deallocate assets from a specific adapter
   * @param adapter - Address of the adapter to deallocate assets from
   * @param data - Additional data for the deallocation
   * @param assets - Amount of assets to deallocate
   * @returns Contract transaction
   */
  async deallocate(
    adapter: string,
    data: string,
    assets: bigint
  ): Promise<ethers.TransactionResponse> {
    return await AllocateFunctions.deallocate(
      this.vaultContract,
      adapter,
      data,
      assets
    );
  }

  // ========================================
  // READ FUNCTIONS
  // ========================================

  /**
   * Get the current liquidity adapter address
   * @returns Address of the current liquidity adapter
   */
  async getLiquidityAdapter(): Promise<string> {
    return await LiquidityAdapterFunctions.getLiquidityAdapter(
      this.vaultContract
    );
  }

  /**
   * Get the current liquidity data
   * @returns Current liquidity data as bytes
   */
  async getLiquidityData(): Promise<string> {
    return await LiquidityAdapterFunctions.getLiquidityData(this.vaultContract);
  }

  /**
   * Get the allocation for a specific ID
   * @param id - Allocation ID
   * @returns Allocation amount as BigNumber
   */
  async getAllocation(id: string): Promise<bigint> {
    return await AllocateFunctions.getAllocation(this.vaultContract, id);
  }

  /**
   * Get the idle balance of the vault
   * @returns Idle balance as BigNumber
   */
  async getIdleBalance(): Promise<bigint> {
    return await AllocateFunctions.getIdleBalance(
      this.provider,
      this.vaultContract
    );
  }

  // ========================================
  // MAX RATE MANAGEMENT
  // ========================================

  /**
   * Set the max rate for the vault
   * @param newMaxRate - The new max rate value
   * @returns Contract transaction
   */
  async setMaxRate(newMaxRate: bigint): Promise<ethers.TransactionResponse> {
    return await MaxRateFunctions.setMaxRate(this.vaultContract, newMaxRate);
  }

  /**
   * Get the current max rate of the vault
   * @returns Max rate as BigNumber
   */
  async getMaxRate(): Promise<bigint> {
    return await MaxRateFunctions.getMaxRate(this.vaultContract);
  }
}
