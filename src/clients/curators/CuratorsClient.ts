import { ethers } from "ethers";
import { ContractProvider } from "../../utils";

// Import all the specialized functions
import * as AdaptersFunctions from "./Adapters";
import * as CapFunctions from "./Cap";
import * as FeesFunctions from "./Fees";
import * as TimelockFunctions from "./Timelock";
import * as MaxRateFunctions from "./MaxRate";
import * as ManageRoleFunctions from "./ManageRole";
/**
 * Main client for vault curators operations
 * Provides:
 * - VaultCurator instances for vault-specific operations
 * - Utility methods for timelock function selectors
 *
 * For vault-specific operations (adapters, timelock), use the vault() method
 * to get a VaultCurator instance which provides all those operations.
 */
export class CuratorsClient {
  private contractProvider: ContractProvider;

  /**
   * Creates a new CuratorsClient instance
   * @param provider Ethereum provider
   * @param signer Optional signer for transactions
   */
  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.contractProvider = new ContractProvider(provider, signer);
  }

  // ========================================
  // VAULT INSTANCE FACTORY
  // ========================================

  /**
   * Get a VaultCurator instance for a specific vault
   * This provides a convenient way to work with a single vault
   * All vault operations should be done through the returned VaultCurator instance
   * @param vaultAddress The vault address
   * @returns VaultCurator instance
   */
  vault(vaultAddress: string): VaultCurator {
    return new VaultCurator(this.contractProvider, vaultAddress);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the function selector for a timelock function
   * This is a utility method that doesn't require a vault instance
   * @param functionName The timelock function name
   * @returns Function selector
   */
  getTimelockFunctionSelector(
    functionName: TimelockFunctions.TimelockFunction
  ) {
    return TimelockFunctions.getTimelockFunctionSelector(functionName);
  }
}

/**
 * VaultCurator class for convenient operations on a specific vault
 * This eliminates the need to pass vaultAddress repeatedly
 */
export class VaultCurator {
  private contractProvider: ContractProvider;
  private vaultAddress: string;
  private vaultContract: ethers.Contract;

  constructor(contractProvider: ContractProvider, vaultAddress: string) {
    this.contractProvider = contractProvider;
    this.vaultAddress = vaultAddress;
    this.vaultContract = contractProvider.getVaultContract(vaultAddress);
  }

  // ========================================
  // ADAPTERS
  // ========================================

  async submitAddAdapter(adapter: string) {
    return AdaptersFunctions.submitAddAdapter(this.vaultContract, adapter);
  }

  async addAdapterAfterTimelock(adapter: string) {
    return AdaptersFunctions.addAdapterAfterTimelock(
      this.vaultContract,
      adapter
    );
  }

  async instantAddAdapter(adapter: string) {
    return AdaptersFunctions.instantAddAdapter(this.vaultContract, adapter);
  }

  async submitRemoveAdapter(adapter: string) {
    return AdaptersFunctions.submitRemoveAdapter(this.vaultContract, adapter);
  }

  async removeAdapterAfterTimelock(adapter: string) {
    return AdaptersFunctions.removeAdapterAfterTimelock(
      this.vaultContract,
      adapter
    );
  }

  async instantRemoveAdapter(adapter: string) {
    return AdaptersFunctions.instantRemoveAdapter(this.vaultContract, adapter);
  }

  async getIsAdapter(adapter: string) {
    return AdaptersFunctions.getIsAdapter(this.vaultContract, adapter);
  }

  async getAdaptersLength() {
    return AdaptersFunctions.getAdaptersLength(this.vaultContract);
  }

  async getAdapterByIndex(index: number) {
    return AdaptersFunctions.getAdapterByIndex(this.vaultContract, index);
  }

  // ========================================
  // TIMELOCK MANAGEMENT
  // ========================================

  async getTimelock(functionName: TimelockFunctions.TimelockFunction) {
    return TimelockFunctions.getTimelock(this.vaultContract, functionName);
  }

  async getExecutableAt(data: string) {
    return TimelockFunctions.getExecutableAt(this.vaultContract, data);
  }

  async submitIncreaseTimelock(
    functionName: TimelockFunctions.TimelockFunction,
    newDuration: bigint
  ) {
    return TimelockFunctions.submitIncreaseTimelock(
      this.vaultContract,
      functionName,
      newDuration
    );
  }

  async increaseTimelockAfterTimelock(
    functionName: TimelockFunctions.TimelockFunction,
    newDuration: bigint
  ) {
    return TimelockFunctions.increaseTimelockAfterTimelock(
      this.vaultContract,
      functionName,
      newDuration
    );
  }

  async instantIncreaseTimelock(
    functionName: TimelockFunctions.TimelockFunction,
    newDuration: bigint
  ) {
    return TimelockFunctions.instantIncreaseTimelock(
      this.vaultContract,
      functionName,
      newDuration
    );
  }

  async submitDecreaseTimelock(
    functionName: TimelockFunctions.TimelockFunction,
    newDuration: bigint
  ) {
    return TimelockFunctions.submitDecreaseTimelock(
      this.vaultContract,
      functionName,
      newDuration
    );
  }

  async setDecreaseTimelockAfterTimelock(
    functionName: TimelockFunctions.TimelockFunction,
    newDuration: bigint
  ) {
    return TimelockFunctions.setDecreaseTimelockAfterTimelock(
      this.vaultContract,
      functionName,
      newDuration
    );
  }

  async instantDecreaseTimelock(
    functionName: TimelockFunctions.TimelockFunction,
    newDuration: bigint
  ) {
    return TimelockFunctions.instantDecreaseTimelock(
      this.vaultContract,
      functionName,
      newDuration
    );
  }

  async submit(data: string) {
    return TimelockFunctions.submit(this.vaultContract, data);
  }

  async revoke(
    functionName: TimelockFunctions.TimelockFunction,
    params: any[]
  ) {
    return TimelockFunctions.revoke(this.vaultContract, functionName, params);
  }

  // ========================================
  // FEES MANAGEMENT
  // ========================================

  // Performance Fee
  async submitPerformanceFee(performanceFee: bigint) {
    return FeesFunctions.submitPerformanceFee(
      this.vaultContract,
      performanceFee
    );
  }

  async setPerformanceFeeAfterTimelock(performanceFee: bigint) {
    return FeesFunctions.setPerformanceFeeAfterTimelock(
      this.vaultContract,
      performanceFee
    );
  }

  async instantSetPerformanceFee(performanceFee: bigint) {
    return FeesFunctions.instantSetPerformanceFee(
      this.vaultContract,
      performanceFee
    );
  }

  // Management Fee
  async submitManagementFee(managementFee: bigint) {
    return FeesFunctions.submitManagementFee(this.vaultContract, managementFee);
  }

  async setManagementFeeAfterTimelock(managementFee: bigint) {
    return FeesFunctions.setManagementFeeAfterTimelock(
      this.vaultContract,
      managementFee
    );
  }

  async instantSetManagementFee(managementFee: bigint) {
    return FeesFunctions.instantSetManagementFee(
      this.vaultContract,
      managementFee
    );
  }

  // Performance Fee Recipient
  async submitPerformanceFeeRecipient(newFeeRecipient: string) {
    return FeesFunctions.submitPerformanceFeeRecipient(
      this.vaultContract,
      newFeeRecipient
    );
  }

  async setPerformanceFeeRecipientAfterTimelock(newFeeRecipient: string) {
    return FeesFunctions.setPerformanceFeeRecipientAfterTimelock(
      this.vaultContract,
      newFeeRecipient
    );
  }

  async instantSetPerformanceFeeRecipient(newFeeRecipient: string) {
    return FeesFunctions.instantSetPerformanceFeeRecipient(
      this.vaultContract,
      newFeeRecipient
    );
  }

  // Management Fee Recipient
  async submitManagementFeeRecipient(newFeeRecipient: string) {
    return FeesFunctions.submitManagementFeeRecipient(
      this.vaultContract,
      newFeeRecipient
    );
  }

  async setManagementFeeRecipientAfterTimelock(newFeeRecipient: string) {
    return FeesFunctions.setManagementFeeRecipientAfterTimelock(
      this.vaultContract,
      newFeeRecipient
    );
  }

  async instantSetManagementFeeRecipient(newFeeRecipient: string) {
    return FeesFunctions.instantSetManagementFeeRecipient(
      this.vaultContract,
      newFeeRecipient
    );
  }

  // Force Deallocate Penalty
  async submitForceDeallocatePenalty(
    adapter: string,
    newForceDeallocatePenalty: bigint
  ) {
    return FeesFunctions.submitForceDeallocatePenalty(
      this.vaultContract,
      adapter,
      newForceDeallocatePenalty
    );
  }

  async setForceDeallocatePenaltyAfterTimelock(
    adapter: string,
    newForceDeallocatePenalty: bigint
  ) {
    return FeesFunctions.setForceDeallocatePenaltyAfterTimelock(
      this.vaultContract,
      adapter,
      newForceDeallocatePenalty
    );
  }

  async instantSetForceDeallocatePenalty(
    adapter: string,
    newForceDeallocatePenalty: bigint
  ) {
    return FeesFunctions.instantSetForceDeallocatePenalty(
      this.vaultContract,
      adapter,
      newForceDeallocatePenalty
    );
  }

  // Read Functions
  async getPerformanceFee() {
    return FeesFunctions.getPerformanceFee(this.vaultContract);
  }

  async getPerformanceFeeRecipient() {
    return FeesFunctions.getPerformanceFeeRecipient(this.vaultContract);
  }

  async getManagementFee() {
    return FeesFunctions.getManagementFee(this.vaultContract);
  }

  async getManagementFeeRecipient() {
    return FeesFunctions.getManagementFeeRecipient(this.vaultContract);
  }

  async getForceDeallocatePenalty(adapter: string) {
    return FeesFunctions.getForceDeallocatePenalty(this.vaultContract, adapter);
  }

  // ========================================
  // CAP MANAGEMENT
  // ========================================

  // Increase Absolute Cap
  async submitIncreaseAbsoluteCap(idData: string, newAbsoluteCap: bigint) {
    return CapFunctions.submitIncreaseAbsoluteCap(
      this.vaultContract,
      idData,
      newAbsoluteCap
    );
  }

  async setIncreaseAbsoluteCapAfterTimelock(
    idData: string,
    newAbsoluteCap: bigint
  ) {
    return CapFunctions.setIncreaseAbsoluteCapAfterTimelock(
      this.vaultContract,
      idData,
      newAbsoluteCap
    );
  }

  async instantIncreaseAbsoluteCap(idData: string, newAbsoluteCap: bigint) {
    return CapFunctions.instantIncreaseAbsoluteCap(
      this.vaultContract,
      idData,
      newAbsoluteCap
    );
  }

  // Increase Relative Cap
  async submitIncreaseRelativeCap(idData: string, newRelativeCap: bigint) {
    return CapFunctions.submitIncreaseRelativeCap(
      this.vaultContract,
      idData,
      newRelativeCap
    );
  }

  async setIncreaseRelativeCapAfterTimelock(
    idData: string,
    newRelativeCap: bigint
  ) {
    return CapFunctions.setIncreaseRelativeCapAfterTimelock(
      this.vaultContract,
      idData,
      newRelativeCap
    );
  }

  async instantIncreaseRelativeCap(idData: string, newRelativeCap: bigint) {
    return CapFunctions.instantIncreaseRelativeCap(
      this.vaultContract,
      idData,
      newRelativeCap
    );
  }

  // Decrease Absolute Cap
  async decreaseAbsoluteCap(idData: string, newAbsoluteCap: bigint) {
    return CapFunctions.decreaseAbsoluteCap(
      this.vaultContract,
      idData,
      newAbsoluteCap
    );
  }

  // Decrease Relative Cap
  async decreaseRelativeCap(idData: string, newRelativeCap: bigint) {
    return CapFunctions.decreaseRelativeCap(
      this.vaultContract,
      idData,
      newRelativeCap
    );
  }

  // Read Cap Functions
  async getAbsoluteCap(id: string) {
    return CapFunctions.getAbsoluteCap(this.vaultContract, id);
  }

  async getRelativeCap(id: string) {
    return CapFunctions.getRelativeCap(this.vaultContract, id);
  }

  // ========================================
  // MAX RATE MANAGEMENT
  // ========================================

  async submitMaxRate(newMaxRate: bigint) {
    return MaxRateFunctions.submitMaxRate(this.vaultContract, newMaxRate);
  }

  async setMaxRateAfterTimelock(newMaxRate: bigint) {
    return MaxRateFunctions.setMaxRateAfterTimelock(
      this.vaultContract,
      newMaxRate
    );
  }

  async instantSetMaxRate(newMaxRate: bigint) {
    return MaxRateFunctions.instantSetMaxRate(this.vaultContract, newMaxRate);
  }

  async getMaxRate() {
    return MaxRateFunctions.getMaxRate(this.vaultContract);
  }

  // ========================================
  // Manage role
  // ========================================

  async submitIsAllocator(allocator: string, isAllocator: boolean) {
    return ManageRoleFunctions.submitIsAllocator(
      this.vaultContract,
      allocator,
      isAllocator
    );
  }

  async setIsAllocatorAfterTimelock(allocator: string, isAllocator: boolean) {
    return ManageRoleFunctions.setIsAllocatorAfterTimelock(
      this.vaultContract,
      allocator,
      isAllocator
    );
  }

  async instantSetIsAllocator(allocator: string, isAllocator: boolean) {
    return ManageRoleFunctions.instantSetIsAllocator(
      this.vaultContract,
      allocator,
      isAllocator
    );
  }

  async getIsAllocator(allocator: string) {
    return ManageRoleFunctions.getIsAllocator(this.vaultContract, allocator);
  }

  // ========================================
  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the vault address
   * @returns The vault address
   */
  getAddress(): string {
    return this.vaultAddress;
  }

  /**
   * Get the vault contract instance
   * @returns Vault contract instance
   */
  getContract(): ethers.Contract {
    return this.vaultContract;
  }
}
