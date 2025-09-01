// @ts-check

import { ethers } from "ethers";
import { ContractProvider } from "../utils";

// Import specialized clients
import { OwnersClient } from "./owners";
import { CuratorsClient, TimelockFunction } from "./curators";
import { AdaptersClient, AdaptersFactoryClient, AdapterType } from "./adapters";
import { DepositorsClient } from "./depositors";
import { AllocatorsClient } from "./allocators";
import * as MorphoMarketV1AdaptersFunctions from "./adapters/MorphoMarketV1Adapters";
import { DeployAdapterResult } from "./adapters";

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
  private adaptersFactoryClient: AdaptersFactoryClient;
  private adaptersClient: AdaptersClient;

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
    this.adaptersFactoryClient = new AdaptersFactoryClient(provider, signer);
    this.adaptersClient = new AdaptersClient(provider, signer);
  }

  //*******************************************
  //* DEPOSITORS CLIENT - Vault Depositor Operations
  //*******************************************

  /**
   * Get a depositors client for a specific vault
   * @param vaultAddress The vault address
   * @returns DepositorsClient instance for the vault
   */
  getDepositorsClient(vaultAddress: string): DepositorsClient {
    return new DepositorsClient(
      this.contractProvider,
      vaultAddress,
      this.provider
    );
  }

  //*******************************************
  //* ALLOCATORS CLIENT - Vault Allocator Operations
  //*******************************************
  getAllocatorsClient(vaultAddress: string): AllocatorsClient {
    return new AllocatorsClient(
      this.contractProvider,
      vaultAddress,
      this.provider
    );
  }

  // ========================================
  // DEPOSIT OPERATIONS
  // ========================================

  /**
   * Deposit assets into the vault
   * @param vaultAddress The vault contract address
   * @param amountAssets The amount of assets to deposit
   * @param receiver The address to receive the shares
   * @returns Transaction response
   */
  async deposit(
    vaultAddress: string,
    amountAssets: bigint,
    receiver: string
  ): Promise<ethers.TransactionResponse> {
    return await this.depositors(vaultAddress).deposit(amountAssets, receiver);
  }

  /**
   * Mint shares by depositing assets
   * @param vaultAddress The vault contract address
   * @param amountShares The amount of shares to mint
   * @param receiver The address to receive the shares
   * @returns Transaction response
   */
  async mint(
    vaultAddress: string,
    amountShares: bigint,
    receiver: string
  ): Promise<ethers.TransactionResponse> {
    return await this.depositors(vaultAddress).mint(amountShares, receiver);
  }

  // ========================================
  // WITHDRAW OPERATIONS
  // ========================================

  /**
   * Withdraw assets from the vault
   * @param vaultAddress The vault contract address
   * @param amountAssets The amount of assets to withdraw
   * @param receiver The address to receive the assets
   * @param onBehalf The address of the shares owner
   * @returns Transaction response
   */
  async withdraw(
    vaultAddress: string,
    amountAssets: bigint,
    receiver: string,
    onBehalf: string
  ): Promise<ethers.TransactionResponse> {
    return await this.depositors(vaultAddress).withdraw(
      amountAssets,
      receiver,
      onBehalf
    );
  }

  /**
   * Redeem shares for assets
   * @param vaultAddress The vault contract address
   * @param amountShares The amount of shares to redeem
   * @param receiver The address to receive the assets
   * @param onBehalf The address of the shares owner
   * @returns Transaction response
   */
  async redeem(
    vaultAddress: string,
    amountShares: bigint,
    receiver: string,
    onBehalf: string
  ): Promise<ethers.TransactionResponse> {
    return await this.depositors(vaultAddress).redeem(
      amountShares,
      receiver,
      onBehalf
    );
  }

  // ========================================
  // TRANSFER OPERATIONS
  // ========================================

  /**
   * Transfer shares to another address
   * @param vaultAddress The vault contract address
   * @param to The recipient address
   * @param shares The amount of shares to transfer
   * @returns Transaction response
   */
  async transfer(
    vaultAddress: string,
    to: string,
    shares: bigint
  ): Promise<ethers.TransactionResponse> {
    return await this.depositors(vaultAddress).transfer(to, shares);
  }

  /**
   * Transfer shares from one address to another (requires approval)
   * @param vaultAddress The vault contract address
   * @param from The sender address
   * @param to The recipient address
   * @param shares The amount of shares to transfer
   * @returns Transaction response
   */
  async transferFrom(
    vaultAddress: string,
    from: string,
    to: string,
    shares: bigint
  ): Promise<ethers.TransactionResponse> {
    return await this.depositors(vaultAddress).transferFrom(from, to, shares);
  }

  /**
   * Approve a spender to transfer shares on behalf of the owner
   * @param vaultAddress The vault contract address
   * @param spender The spender address
   * @param shares The amount of shares to approve
   * @returns Transaction response
   */
  async approve(
    vaultAddress: string,
    spender: string,
    shares: bigint
  ): Promise<ethers.TransactionResponse> {
    return await this.depositors(vaultAddress).approve(spender, shares);
  }

  // ========================================
  // DEPOSITORS READ OPERATIONS
  // ========================================

  /**
   * Get the shares balance for a specific account
   * @param vaultAddress The vault contract address
   * @param account The account address
   * @returns The shares balance
   */
  async getSharesBalance(
    vaultAddress: string,
    account: string
  ): Promise<bigint> {
    return await this.depositors(vaultAddress).getSharesBalance(account);
  }

  /**
   * Get the allowance for a spender
   * @param vaultAddress The vault contract address
   * @param owner The owner address
   * @param spender The spender address
   * @returns The allowance amount
   */
  async getAllowance(
    vaultAddress: string,
    userAddress: string
  ): Promise<bigint> {
    return await this.depositors(vaultAddress).getAllowance(userAddress);
  }

  //*******************************************
  //* BALANCES READ OPERATIONS
  //*******************************************

  /**
   * Get the total assets in the vault
   * @param vaultAddress The vault contract address
   * @returns The total assets
   */
  async getTotalAssets(vaultAddress: string): Promise<bigint> {
    return await this.depositors(vaultAddress).getTotalAssets();
  }

  /**
   * Get the total supply of shares in the vault
   * @param vaultAddress The vault contract address
   * @returns The total supply
   */
  async getTotalSupply(vaultAddress: string): Promise<bigint> {
    return await this.depositors(vaultAddress).getTotalSupply();
  }

  /**
   * Get the virtual shares in the vault
   * @param vaultAddress The vault contract address
   * @returns The virtual shares
   */
  async getVirtualShares(vaultAddress: string): Promise<bigint> {
    return await this.depositors(vaultAddress).getVirtualShares();
  }

  //*******************************************
  //* OWNERS CLIENT - Vault Owner Operations
  //*******************************************

  /**
   * Create a new vault using the factory
   * @param owner The address of the vault owner
   * @param asset The address of the underlying asset
   * @param salt Unique salt for deterministic vault address
   * @returns Transaction response with vault address
   */
  async createVault(
    owner: string,
    asset: string,
    salt: string
  ): Promise<import("./owners/CreateVault").CreateVaultResult> {
    return await this.ownersClient.createVault(owner, asset, salt);
  }

  //*******************************************
  //* General data retrieval
  //*******************************************

  async getAsset(vaultAddress: string): Promise<string> {
    const contract = this.contractProvider.getVaultContract(vaultAddress);
    return await contract.asset();
  }

  /**
   * Get the balance of the underlying asset (e.g., USDC) for a specific account
   * @param vaultAddress The vault contract address
   * @param account The account address
   * @returns The asset balance
   */
  async getAssetBalance(
    vaultAddress: string,
    account: string
  ): Promise<bigint> {
    const assetAddress = await this.getAsset(vaultAddress);
    const assetContract = new ethers.Contract(
      assetAddress,
      ["function balanceOf(address owner) view returns (uint256)"],
      this.provider
    );
    return await assetContract.balanceOf(account);
  }

  /**
   * Get the allowance of the underlying asset (e.g., USDC) that the vault can spend
   * @param vaultAddress The vault contract address
   * @param owner The owner address
   * @returns The asset allowance
   */
  async getAssetAllowance(
    vaultAddress: string,
    owner: string
  ): Promise<bigint> {
    const assetAddress = await this.getAsset(vaultAddress);
    const assetContract = new ethers.Contract(
      assetAddress,
      [
        "function allowance(address owner, address spender) view returns (uint256)",
      ],
      this.provider
    );
    return await assetContract.allowance(owner, vaultAddress);
  }

  // ========================================
  // PREVIEW METHODS
  // ========================================

  /**
   * Preview how many shares will be received for a given amount of assets
   * @param vaultAddress The vault contract address
   * @param assets The amount of assets to deposit
   * @returns The amount of shares that would be received
   *
   * @example
   * const shares = await client.previewDeposit(vaultAddress, ethers.parseUnits("1.0", 6));
   * console.log(`You will receive ${shares} shares`);
   * // 1000000 USDC -> 1000000000000000000 byzUSDC
   */
  async previewDeposit(vaultAddress: string, assets: bigint): Promise<bigint> {
    return await this.depositors(vaultAddress).previewDeposit(assets);
  }

  /**
   * Preview how many assets are needed to mint a given amount of shares
   * @param vaultAddress The vault contract address
   * @param shares The amount of shares to mint
   * @returns The amount of assets needed
   *
   * @example
   * const assets = await client.previewMint(vaultAddress, ethers.parseUnits("1.0", 18));
   * console.log(`You will need ${assets} assets`);
   * // 1000000000000000000 byzUSDC -> 1000000 USDC
   */
  async previewMint(vaultAddress: string, shares: bigint): Promise<bigint> {
    return await this.depositors(vaultAddress).previewMint(shares);
  }

  /**
   * Preview how many assets will be received for a given amount of shares
   * @param vaultAddress The vault contract address
   * @param shares The amount of shares to redeem
   * @returns The amount of assets that would be received
   *
   * @example
   * const assets = await client.previewRedeem(vaultAddress, ethers.parseUnits("1.0", 18));
   * console.log(`You will receive ${assets} assets`);
   * // 1000000000000000000 byzUSDC -> 1000000 USDC
   */
  async previewRedeem(vaultAddress: string, shares: bigint): Promise<bigint> {
    return await this.depositors(vaultAddress).previewRedeem(shares);
  }

  /**
   * Preview how many shares are needed to withdraw a given amount of assets
   * @param vaultAddress The vault contract address
   * @param assets The amount of assets to withdraw
   * @returns The amount of shares needed
   *
   * @example
   * const shares = await client.previewWithdraw(vaultAddress, ethers.parseUnits("1.0", 6));
   * console.log(`You will need ${shares} shares`);
   * // 1000000 USDC -> 1000000000000000000 byzUSDC
   */
  async previewWithdraw(vaultAddress: string, assets: bigint): Promise<bigint> {
    return await this.depositors(vaultAddress).previewWithdraw(assets);
  }

  /**
   * Approve the vault to spend the underlying asset (e.g., USDC)
   * @param vaultAddress The vault contract address
   * @param amount The amount to approve
   * @returns Transaction response
   */
  async approveAsset(
    vaultAddress: string,
    amount: bigint
  ): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new Error("Signer is required for approveAsset operation");
    }

    const assetAddress = await this.getAsset(vaultAddress);
    const assetContract = new ethers.Contract(
      assetAddress,
      [
        "function approve(address spender, uint256 amount) external returns (bool)",
      ],
      this.signer
    );
    return await assetContract.approve(vaultAddress, amount);
  }

  // ========================================
  // SMART APPROVAL AND OPERATION METHODS
  // ========================================

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

  async getAdapterByIndex(vaultAddress: string, index: number) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .getAdapterByIndex(index);
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
  // CAP MANAGEMENT
  // ========================================

  // Increase Absolute Cap
  async submitIncreaseAbsoluteCap(
    vaultAddress: string,
    idData: string,
    newAbsoluteCap: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitIncreaseAbsoluteCap(idData, newAbsoluteCap);
  }

  async setIncreaseAbsoluteCapAfterTimelock(
    vaultAddress: string,
    idData: string,
    newAbsoluteCap: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setIncreaseAbsoluteCapAfterTimelock(idData, newAbsoluteCap);
  }

  async instantIncreaseAbsoluteCap(
    vaultAddress: string,
    idData: string,
    newAbsoluteCap: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantIncreaseAbsoluteCap(idData, newAbsoluteCap);
  }

  // Increase Relative Cap
  async submitIncreaseRelativeCap(
    vaultAddress: string,
    idData: string,
    newRelativeCap: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .submitIncreaseRelativeCap(idData, newRelativeCap);
  }

  async setIncreaseRelativeCapAfterTimelock(
    vaultAddress: string,
    idData: string,
    newRelativeCap: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .setIncreaseRelativeCapAfterTimelock(idData, newRelativeCap);
  }

  async instantIncreaseRelativeCap(
    vaultAddress: string,
    idData: string,
    newRelativeCap: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .instantIncreaseRelativeCap(idData, newRelativeCap);
  }

  // Decrease Absolute Cap
  async decreaseAbsoluteCap(
    vaultAddress: string,
    idData: string,
    newAbsoluteCap: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .decreaseAbsoluteCap(idData, newAbsoluteCap);
  }

  // Decrease Relative Cap
  async decreaseRelativeCap(
    vaultAddress: string,
    idData: string,
    newRelativeCap: bigint
  ) {
    return await this.curatorsClient
      .vault(vaultAddress)
      .decreaseRelativeCap(idData, newRelativeCap);
  }

  // Read Cap Functions
  async getAbsoluteCap(vaultAddress: string, id: string) {
    return await this.curatorsClient.vault(vaultAddress).getAbsoluteCap(id);
  }

  async getRelativeCap(vaultAddress: string, id: string) {
    return await this.curatorsClient.vault(vaultAddress).getRelativeCap(id);
  }

  // ========================================
  // ADAPTERS CLIENT - Adapter Operations
  // ========================================

  /**
   * Get an adapters client for a specific vault
   * @param vaultAddress The vault address
   * @returns AdaptersClient instance for the vault
   */
  // adapters(vaultAddress: string): AdaptersClient {
  //   return new AdaptersClient(this.contractProvider, vaultAddress);
  // }

  // ========================================
  // MORPHO VAULT V1 ADAPTERS
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
    return this.adaptersFactoryClient.deployAdapter(
      type,
      parentAddress,
      underlyingAddress,
      cometRewards
    );
  }

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
    return this.adaptersFactoryClient.findAdapter(
      type,
      parentAddress,
      underlyingAddress
    );
  }

  async isAdapter(type: AdapterType, account: string): Promise<boolean> {
    return this.adaptersFactoryClient.isAdapter(type, account);
  }

  async getIdsAdapterERC4626(adapterAddress: string): Promise<string> {
    return this.adaptersClient
      .adapter(adapterAddress, "erc4626")
      .getIdsERC4626();
  }

  async getIdsAdapterERC4626Merkl(adapterAddress: string): Promise<string> {
    return this.adaptersClient
      .adapter(adapterAddress, "erc4626Merkl")
      .getIdsERC4626Merkl();
  }

  async getIdsAdapterCompoundV3(adapterAddress: string): Promise<string> {
    return this.adaptersClient
      .adapter(adapterAddress, "compoundV3")
      .getIdsCompoundV3();
  }

  async getIdsAdapterMarketV1(
    adapterAddress: string,
    marketParams: MorphoMarketV1AdaptersFunctions.MarketParams
  ): Promise<string[]> {
    return this.adaptersClient
      .adapter(adapterAddress, "morphoMarketV1")
      .getIdsMarketV1(marketParams);
  }

  async getUnderlyingAdapterERC4626(adapterAddress: string): Promise<string> {
    return this.adaptersClient
      .adapter(adapterAddress, "erc4626")
      .getUnderlyingERC4626();
  }

  async getUnderlyingAdapterERC4626Merkl(
    adapterAddress: string
  ): Promise<string> {
    return this.adaptersClient
      .adapter(adapterAddress, "erc4626Merkl")
      .getUnderlyingERC4626Merkl();
  }

  async getUnderlyingAdapterCompoundV3(
    adapterAddress: string
  ): Promise<string> {
    return this.adaptersClient
      .adapter(adapterAddress, "compoundV3")
      .getUnderlyingCompoundV3();
  }

  async getUnderlyingAdapterMarketV1(adapterAddress: string): Promise<string> {
    return this.adaptersClient
      .adapter(adapterAddress, "morphoMarketV1")
      .getUnderlyingMarketFromAdapterV1();
  }

  /**
   * Get the length of the market params list for a Morpho Market V1 Adapter
   * @param adapterAddress The address of the Morpho Market V1 Adapter
   * @returns The length of the market params list
   */
  async getAdapterMarketParamsListLength(
    adapterAddress: string
  ): Promise<number> {
    return this.adaptersClient
      .adapter(adapterAddress, "morphoMarketV1")
      .getMarketParamsListLength();
  }

  /**
   * Get the market params list for a Morpho Market V1 Adapter
   * @param adapterAddress The address of the Morpho Market V1 Adapter
   * @param index The index of the market params
   * @returns The market params
   */
  async getAdapterMarketParamsList(
    adapterAddress: string,
    index: number
  ): Promise<MorphoMarketV1AdaptersFunctions.MarketParams> {
    return this.adaptersClient
      .adapter(adapterAddress, "morphoMarketV1")
      .getMarketParamsList(index);
  }

  // ========================================
  // GLOBAL ADAPTERS
  // ========================================

  /**
   * Get the factory address of an adapter
   * @param adapterAddress The address of the adapter
   * @returns The lowercase factory address of the adapter
   */
  async getAdapterFactoryAddress(adapterAddress: string): Promise<string> {
    return this.adaptersClient
      .globalAdapter(adapterAddress)
      .getAdapterFactoryAddress();
  }

  /**
   * Get the type of an adapter
   * @param adapterAddress The address of the adapter
   * @returns The type of the adapter -> morphoVaultV1, morphoMarketV1
   */
  async getAdapterType(
    adapterAddress: string
  ): Promise<AdapterType | undefined> {
    return this.adaptersClient.globalAdapter(adapterAddress).getAdapterType();
  }

  // ========================================
  // ALLOCATORS METHODS
  // ========================================

  async setLiquidityAdapterAndData(
    vaultAddress: string,
    newLiquidityAdapter: string,
    newLiquidityData: string
  ) {
    return await this.getAllocatorsClient(
      vaultAddress
    ).setLiquidityAdapterAndData(newLiquidityAdapter, newLiquidityData);
  }

  async allocate(
    vaultAddress: string,
    adapter: string,
    data: string,
    assets: bigint
  ) {
    return await this.getAllocatorsClient(vaultAddress).allocate(
      adapter,
      data,
      assets
    );
  }

  async deallocate(
    vaultAddress: string,
    adapter: string,
    data: string,
    assets: bigint
  ) {
    return await this.getAllocatorsClient(vaultAddress).deallocate(
      adapter,
      data,
      assets
    );
  }

  // Read functions

  async getLiquidityAdapter(vaultAddress: string) {
    return await this.getAllocatorsClient(vaultAddress).getLiquidityAdapter();
  }

  async getLiquidityData(vaultAddress: string) {
    return await this.getAllocatorsClient(vaultAddress).getLiquidityData();
  }

  async getAllocation(vaultAddress: string, id: string) {
    return await this.getAllocatorsClient(vaultAddress).getAllocation(id);
  }

  async getIdleBalance(vaultAddress: string) {
    return await this.getAllocatorsClient(vaultAddress).getIdleBalance();
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
    this.adaptersFactoryClient = new AdaptersFactoryClient(
      this.provider,
      signer
    );
    this.adaptersClient = new AdaptersClient(this.provider, signer);
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

  /**
   * Get access to the depositors client for advanced operations
   */
  get depositors() {
    return this.getDepositorsClient;
  }

  /**
   * Get access to the allocators client for advanced operations
   */
  get allocators() {
    return this.getAllocatorsClient;
  }
}
