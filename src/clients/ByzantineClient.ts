// @ts-check

import { ethers } from "ethers";
import { ContractProvider } from "../utils";

// Import specialized clients
import { OwnersClient } from "./owners";
import { CuratorsClient, TimelockFunction } from "./curators";

/**
 * Main SDK client for interacting with Vault ecosystem
 * Currently focused on Owner operations
 */
export class ByzantineClient {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private contractProvider: ContractProvider;

  // Specialized clients
  private ownersClient: OwnersClient;
  private curatorsClient: CuratorsClient;
  /**
   * Initialize a new ByzantineClient
   * @param provider Ethereum provider
   * @param signer Optional signer for transactions
   */
  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.contractProvider = new ContractProvider(provider, signer);

    // Initialize specialized clients
    this.ownersClient = new OwnersClient(provider, signer);
    this.curatorsClient = new CuratorsClient(provider, signer);
  }

  //*******************************************
  //* OWNERS CLIENT - Vault Owner Operations
  //*******************************************

  /**
   * Create a new vault using the factory
   * @param owner The address of the vault owner
   * @param asset The address of the underlying asset
   * @param salt Unique salt for deterministic vault address
   * @returns Transaction response
   */
  async createVault(
    owner: string,
    asset: string,
    salt: string
  ): Promise<ethers.TransactionResponse> {
    return await this.ownersClient.createVault(owner, asset, salt);
  }

  //*******************************************
  //* General data retrieval
  //*******************************************

  async getAsset(vaultAddress: string): Promise<string> {
    const contract = this.contractProvider.getVaultContract(vaultAddress);
    return await contract.asset();
  }

  //*******************************************
  //* OWNERS CLIENT - Vault Owner Operations
  //*******************************************

  /**
   * Set a new owner for the vault
   * @param vaultAddress The vault contract address
   * @param newOwner The address of the new owner
   * @returns Transaction response
   */
  async setOwner(
    vaultAddress: string,
    newOwner: string
  ): Promise<ethers.TransactionResponse> {
    return await this.ownersClient.vault(vaultAddress).setOwner(newOwner);
  }

  /**
   * Set a new curator for the vault
   * @param vaultAddress The vault contract address
   * @param newCurator The address of the new curator
   * @returns Transaction response
   */
  async setCurator(
    vaultAddress: string,
    newCurator: string
  ): Promise<ethers.TransactionResponse> {
    return await this.ownersClient.vault(vaultAddress).setCurator(newCurator);
  }

  /**
   * Add an account as a sentinel
   * @param vaultAddress The vault contract address
   * @param account The account address to add as sentinel
   * @param isSentinel Whether the account is a sentinel
   * @returns Transaction response
   */
  async setIsSentinel(
    vaultAddress: string,
    account: string,
    isSentinel: boolean
  ): Promise<ethers.TransactionResponse> {
    return await this.ownersClient
      .vault(vaultAddress)
      .setIsSentinel(account, isSentinel);
  }

  /**
   * Submit a new allocator for the vault
   * This function is used to submit a new allocator for the vault
   * Then the curator will have to call the setIsAllocatorAfterTimelock function to set the allocator
   * @param vaultAddress The vault contract address
   * @param account The account address to add as allocator
   * @param isAllocator Whether the account is a allocator
   * @returns Transaction response
   */
  async submitIsAllocator(
    vaultAddress: string,
    account: string,
    isAllocator: boolean
  ): Promise<ethers.TransactionResponse> {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitIsAllocator(account, isAllocator);
  }

  /**
   * Set a new allocator for the vault after timelock
   * This function is used to set a new allocator for the vault after the timelock has passed
   * @param vaultAddress The vault contract address
   * @param account The account address to add as allocator
   * @param isAllocator Whether the account is a allocator
   * @returns Transaction response
   */
  async setIsAllocatorAfterTimelock(
    vaultAddress: string,
    account: string,
    isAllocator: boolean
  ): Promise<ethers.TransactionResponse> {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setIsAllocatorAfterTimelock(account, isAllocator);
  }

  /**
   * Instant set a new allocator for the vault
   * This function is used to set a new allocator for the vault without timelock
   * @param vaultContract The vault contract instance
   * @param newAllocator The address of the new allocator
   * @param isAllocator Whether the account is a allocator
   * @returns Transaction response
   */
  async instantSetIsAllocator(
    vaultAddress: string,
    account: string,
    isAllocator: boolean
  ): Promise<ethers.TransactionResponse> {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantSetIsAllocator(account, isAllocator);
  }

  /**
   * Get if an account is a allocator of the vault
   * @param vaultAddress The vault contract address
   * @param account The account address to check
   * @returns True if the account is a allocator
   */
  async getIsAllocator(
    vaultAddress: string,
    account: string
  ): Promise<boolean> {
    return await this.curatorsClient
      .vault(vaultAddress)
      .getIsAllocator(account);
  }

  // ========================================
  // ROLE INFORMATION (READ FUNCTIONS)
  // ========================================

  /**
   * Get the current owner of the vault
   * @param vaultAddress The vault contract address
   * @returns The owner address
   */
  async getOwner(vaultAddress: string): Promise<string> {
    return await this.ownersClient.vault(vaultAddress).getOwner();
  }

  /**
   * Get the current curator of the vault
   * @param vaultAddress The vault contract address
   * @returns The curator address
   */
  async getCurator(vaultAddress: string): Promise<string> {
    return await this.ownersClient.vault(vaultAddress).getCurator();
  }

  /**
   * Check if an account is a sentinel
   * @param vaultAddress The vault contract address
   * @param account The account address to check
   * @returns True if the account is a sentinel
   */
  async isSentinel(vaultAddress: string, account: string): Promise<boolean> {
    return await this.ownersClient.vault(vaultAddress).isSentinel(account);
  }

  async isAllocator(vaultAddress: string, account: string): Promise<boolean> {
    return await this.curatorsClient
      .vault(vaultAddress)
      .getIsAllocator(account);
  }

  // ========================================
  // VAULT METADATA MANAGEMENT
  // ========================================

  /**
   * Set a new name for the vault
   * @param vaultAddress The vault contract address
   * @param newName The new name for the vault
   * @returns Transaction response
   */
  async setSharesName(
    vaultAddress: string,
    newName: string
  ): Promise<ethers.TransactionResponse> {
    return await this.ownersClient.vault(vaultAddress).setName(newName);
  }

  /**
   * Set a new symbol for the vault
   * @param vaultAddress The vault contract address
   * @param newSymbol The new symbol for the vault
   * @returns Transaction response
   */
  async setSharesSymbol(
    vaultAddress: string,
    newSymbol: string
  ): Promise<ethers.TransactionResponse> {
    return await this.ownersClient.vault(vaultAddress).setSymbol(newSymbol);
  }

  /**
   * Set both name and symbol for the vault in a single transaction using multicall
   * @param vaultAddress The vault contract address
   * @param newName The new name for the vault
   * @param newSymbol The new symbol for the vault
   * @returns Transaction response
   */
  async setSharesNameAndSymbol(
    vaultAddress: string,
    newName: string,
    newSymbol: string
  ): Promise<ethers.TransactionResponse> {
    return await this.ownersClient
      .vault(vaultAddress)
      .setNameAndSymbol(newName, newSymbol);
  }

  async getVaultName(vaultAddress: string): Promise<string> {
    return await this.ownersClient.vault(vaultAddress).getName();
  }

  async getVaultSymbol(vaultAddress: string): Promise<string> {
    return await this.ownersClient.vault(vaultAddress).getSymbol();
  }

  //*******************************************
  //* UTILITY METHODS - General Helpers
  //*******************************************

  /**
   * Get the current network configuration
   * @returns Network configuration
   */
  async getNetworkConfig() {
    return this.ownersClient.getNetworkConfig();
  }

  /**
   * Get the current chain ID
   * @returns Chain ID
   */
  async getChainId() {
    return this.ownersClient.getChainId();
  }

  /**
   * Get the Vault contract instance
   * @param vaultAddress Address of the Vault
   * @returns Vault contract instance
   */
  getVaultContract(vaultAddress: string): ethers.Contract {
    return this.contractProvider.getVaultContract(vaultAddress);
  }

  /**
   * Get the VaultFactory contract instance
   * @returns VaultFactory contract instance
   */
  async getVaultFactoryContract(): Promise<ethers.Contract> {
    return this.contractProvider.getVaultFactoryContract();
  }

  //*******************************************
  //* CURATORS CLIENT - Vault Curator Operations
  //*******************************************

  async submitIsAdapter(
    vaultAddress: string,
    adapter: string,
    isAdapter: boolean
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitIsAdapter(adapter, isAdapter);
  }

  async setIsAdapterAfterTimelock(
    vaultAddress: string,
    adapter: string,
    isAdapter: boolean
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setIsAdapterAfterTimelock(adapter, isAdapter);
  }

  async instantSetIsAdapter(
    vaultAddress: string,
    adapter: string,
    isAdapter: boolean
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantSetIsAdapter(adapter, isAdapter);
  }

  async getIsAdapter(vaultAddress: string, adapter: string) {
    return await this.curatorsClient.vault(vaultAddress).getIsAdapter(adapter);
  }

  async getAdaptersLength(vaultAddress: string) {
    return await this.curatorsClient.vault(vaultAddress).getAdaptersLength();
  }

  // ========================================
  // TIMELOCK MANAGEMENT
  // ========================================

  async getTimelock(vaultAddress: string, functionName: TimelockFunction) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .getTimelock(functionName);
  }

  async getExecutableAt(vaultAddress: string, data: string) {
    return await this.curatorsClient.vault(vaultAddress).getExecutableAt(data);
  }

  getTimelockFunctionSelector(functionName: string) {
    return this.curatorsClient.getTimelockFunctionSelector(functionName as any);
  }

  async increaseTimelock(
    vaultAddress: string,
    functionName: string,
    newDuration: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .increaseTimelock(functionName as any, newDuration);
  }

  async submitDecreaseTimelock(
    vaultAddress: string,
    functionName: string,
    newDuration: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitDecreaseTimelock(functionName as any, newDuration);
  }

  async setDecreaseTimelockAfterTimelock(
    vaultAddress: string,
    functionName: string,
    newDuration: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setDecreaseTimelockAfterTimelock(functionName as any, newDuration);
  }

  async instantDecreaseTimelock(
    vaultAddress: string,
    functionName: string,
    newDuration: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantDecreaseTimelock(functionName as any, newDuration);
  }

  async submit(vaultAddress: string, data: string) {
    return await this.curatorsClient.vault(vaultAddress).submit(data);
  }

  async revoke(vaultAddress: string, functionName: string, params: any[]) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .revoke(functionName as any, params);
  }

  async abdicateSubmit(vaultAddress: string, functionName: string) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .abdicateSubmit(functionName as any);
  }

  // ========================================
  // FEES MANAGEMENT
  // ========================================

  // Performance Fee
  async submitPerformanceFee(vaultAddress: string, performanceFee: bigint) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitPerformanceFee(performanceFee);
  }

  async setPerformanceFeeAfterTimelock(
    vaultAddress: string,
    performanceFee: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setPerformanceFeeAfterTimelock(performanceFee);
  }

  async instantSetPerformanceFee(vaultAddress: string, performanceFee: bigint) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantSetPerformanceFee(performanceFee);
  }

  async getPerformanceFee(vaultAddress: string) {
    return await this.curatorsClient.vault(vaultAddress).getPerformanceFee();
  }

  // Management Fee
  async submitManagementFee(vaultAddress: string, managementFee: bigint) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitManagementFee(managementFee);
  }

  async setManagementFeeAfterTimelock(
    vaultAddress: string,
    managementFee: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setManagementFeeAfterTimelock(managementFee);
  }

  async instantSetManagementFee(vaultAddress: string, managementFee: bigint) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantSetManagementFee(managementFee);
  }

  async getManagementFee(vaultAddress: string) {
    return await this.curatorsClient.vault(vaultAddress).getManagementFee();
  }

  // Performance Fee Recipient
  async submitPerformanceFeeRecipient(
    vaultAddress: string,
    newFeeRecipient: string
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitPerformanceFeeRecipient(newFeeRecipient);
  }

  async setPerformanceFeeRecipientAfterTimelock(
    vaultAddress: string,
    newFeeRecipient: string
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setPerformanceFeeRecipientAfterTimelock(newFeeRecipient);
  }

  async instantSetPerformanceFeeRecipient(
    vaultAddress: string,
    newFeeRecipient: string
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantSetPerformanceFeeRecipient(newFeeRecipient);
  }

  async getPerformanceFeeRecipient(vaultAddress: string) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .getPerformanceFeeRecipient();
  }

  // Management Fee Recipient
  async submitManagementFeeRecipient(
    vaultAddress: string,
    newFeeRecipient: string
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitManagementFeeRecipient(newFeeRecipient);
  }

  async setManagementFeeRecipientAfterTimelock(
    vaultAddress: string,
    newFeeRecipient: string
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setManagementFeeRecipientAfterTimelock(newFeeRecipient);
  }

  async instantSetManagementFeeRecipient(
    vaultAddress: string,
    newFeeRecipient: string
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantSetManagementFeeRecipient(newFeeRecipient);
  }

  async getManagementFeeRecipient(vaultAddress: string) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .getManagementFeeRecipient();
  }

  // Force Deallocate Penalty
  async submitForceDeallocatePenalty(
    vaultAddress: string,
    adapter: string,
    newForceDeallocatePenalty: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitForceDeallocatePenalty(adapter, newForceDeallocatePenalty);
  }

  async setForceDeallocatePenaltyAfterTimelock(
    vaultAddress: string,
    adapter: string,
    newForceDeallocatePenalty: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setForceDeallocatePenaltyAfterTimelock(
        adapter,
        newForceDeallocatePenalty
      );
  }

  async instantSetForceDeallocatePenalty(
    vaultAddress: string,
    adapter: string,
    newForceDeallocatePenalty: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantSetForceDeallocatePenalty(adapter, newForceDeallocatePenalty);
  }

  async getForceDeallocatePenalty(vaultAddress: string, adapter: string) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .getForceDeallocatePenalty(adapter);
  }

  // ========================================
  // MAX RATE MANAGEMENT
  // ========================================

  // Max Rate
  async submitMaxRate(vaultAddress: string, newMaxRate: bigint) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitMaxRate(newMaxRate);
  }

  async setMaxRateAfterTimelock(vaultAddress: string, newMaxRate: bigint) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setMaxRateAfterTimelock(newMaxRate);
  }

  async instantSetMaxRate(vaultAddress: string, newMaxRate: bigint) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantSetMaxRate(newMaxRate);
  }

  async getMaxRate(vaultAddress: string) {
    return await this.curatorsClient.vault(vaultAddress).getMaxRate();
  }

  // ========================================
  // CREATE  ADAPTERS
  // ========================================

  async deployMorphoVaultV1Adapter(
    vaultAddress: string,
    underlyingVault: string
  ): Promise<import("./curators/MorphoAdapters").DeployAdapterResult> {
    return await this.curatorsClient
      .vault(vaultAddress)
      .deployMorphoVaultV1Adapter(underlyingVault);
  }

  async isMorphoVaultV1Adapter(vaultAddress: string, account: string) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .isMorphoVaultV1Adapter(account);
  }

  async findMorphoVaultV1Adapter(
    vaultAddress: string,
    underlyingVault: string
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .findMorphoVaultV1Adapter(vaultAddress, underlyingVault);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Use a different signer for transactions
   * @param signer The new signer to use
   */
  useSigner(signer: ethers.Signer) {
    this.signer = signer;
    this.contractProvider = new ContractProvider(this.provider, signer);
    this.ownersClient = new OwnersClient(this.provider, signer);
    this.curatorsClient = new CuratorsClient(this.provider, signer);
  }

  /**
   * Get access to the contract provider for advanced operations
   */
  getContractProvider() {
    return this.contractProvider;
  }

  /**
   * Get access to the curators client for advanced operations
   */
  get curators() {
    return this.curatorsClient;
  }

  /**
   * Get access to the owners client for advanced operations
   */
  get owners() {
    return this.ownersClient;
  }
}
