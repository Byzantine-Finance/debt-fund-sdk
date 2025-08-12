// @ts-check

import { ethers } from "ethers";
import { ContractProvider } from "../utils";
import { getNetworkConfig } from "../constants/networks";

// Import specialized clients
import { CreateClient } from "./curators";
import { AdminClient } from "./byzantine";
import { DepositClient, WithdrawClient } from "./depositors";

/**
 * Main SDK client for interacting with MetaVault ecosystem
 */
export class ByzantineClient {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private contractProvider: ContractProvider;

  // Specialized clients
  private createClient: CreateClient;
  private adminClient?: AdminClient;
  private depositClient?: DepositClient;
  private withdrawClient?: WithdrawClient;

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
    this.createClient = new CreateClient(provider, signer);
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
   * Initialize admin client (lazy initialization)
   */
  private async initializeAdminClient(): Promise<void> {
    if (!this.adminClient) {
      this.adminClient = new AdminClient(this.provider, this.signer);
    }
  }

  /**
   * Initialize vault-specific clients
   * @param vaultAddress Address of the MetaVault
   */
  public initializeVaultClients(vaultAddress: string): void {
    this.depositClient = new DepositClient(
      this.provider,
      vaultAddress,
      this.signer
    );
    this.withdrawClient = new WithdrawClient(
      this.provider,
      vaultAddress,
      this.signer
    );
  }

  //*******************************************
  //* CREATE CLIENT - MetaVault Creation
  //*******************************************

  /**
   * Create a new MetaVault
   * @param params Parameters for creating the MetaVault
   * @returns Transaction response
   */
  async createMetaVault(params: {
    asset: string;
    vaultName: string;
    vaultSymbol: string;
    subVaults: Array<{ vault: string; percentage: bigint }>;
    curatorFeePercentage: bigint;
  }): Promise<ethers.TransactionResponse> {
    return await this.createClient.createMetaVault(params);
  }

  //*******************************************
  //* ADMIN CLIENT - Byzantine Administration
  //*******************************************

  /**
   * Get the Byzantine fee settings from the factory
   * @returns Byzantine fee recipient and percentage
   */
  async getByzantineFeeSettings(): Promise<{
    recipient: string;
    percentage: bigint;
  }> {
    await this.initializeAdminClient();
    return await this.adminClient!.getByzantineFeeSettings();
  }

  /**
   * Get the Byzantine fee percentage from the factory
   * @returns Byzantine fee percentage
   */
  async getByzantineFeePercentage(): Promise<bigint> {
    await this.initializeAdminClient();
    return await this.adminClient!.getByzantineFeePercentage();
  }

  /**
   * Get the Byzantine fee recipient from the factory
   * @returns Byzantine fee recipient address
   */
  async getByzantineFeeRecipient(): Promise<string> {
    await this.initializeAdminClient();
    return await this.adminClient!.getByzantineFeeRecipient();
  }

  /**
   * Set the Byzantine fee percentage (admin only)
   * @param feePercentage The new fee percentage (in basis points)
   * @returns Transaction response
   */
  async setByzantineFeePercentage(
    feePercentage: bigint
  ): Promise<ethers.TransactionResponse> {
    await this.initializeAdminClient();
    return await this.adminClient!.setByzantineFeePercentage(feePercentage);
  }

  /**
   * Set the Byzantine fee recipient (admin only)
   * @param recipient The new fee recipient address
   * @returns Transaction response
   */
  async setByzantineFeeRecipient(
    recipient: string
  ): Promise<ethers.TransactionResponse> {
    await this.initializeAdminClient();
    return await this.adminClient!.setByzantineFeeRecipient(recipient);
  }

  //*******************************************
  //* DEPOSIT CLIENT - Vault Deposits
  //*******************************************

  /**
   * Deposit assets into the vault
   * @param assets Amount of assets to deposit
   * @param receiver Address to receive the shares
   * @returns Transaction response
   */
  async deposit(
    assets: bigint,
    receiver: string
  ): Promise<ethers.TransactionResponse> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.deposit(assets, receiver);
  }

  /**
   * Mint shares by depositing assets
   * @param shares Amount of shares to mint
   * @param receiver Address to receive the shares
   * @returns Transaction response
   */
  async mint(
    shares: bigint,
    receiver: string
  ): Promise<ethers.TransactionResponse> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.mint(shares, receiver);
  }

  /**
   * Preview how many shares will be received for depositing assets
   * @param assets Amount of assets to deposit
   * @returns Number of shares that will be received
   */
  async previewDeposit(assets: bigint): Promise<bigint> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.previewDeposit(assets);
  }

  /**
   * Preview how many assets are needed to mint shares
   * @param shares Amount of shares to mint
   * @returns Amount of assets needed
   */
  async previewMint(shares: bigint): Promise<bigint> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.previewMint(shares);
  }

  /**
   * Get the maximum amount of assets that can be deposited
   * @param receiver Address of the receiver
   * @returns Maximum depositable assets
   */
  async maxDeposit(receiver: string): Promise<bigint> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.maxDeposit(receiver);
  }

  /**
   * Get the maximum amount of shares that can be minted
   * @param receiver Address of the receiver
   * @returns Maximum mintable shares
   */
  async maxMint(receiver: string): Promise<bigint> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.maxMint(receiver);
  }

  /**
   * Get the underlying asset address of the vault
   * @returns Asset address
   */
  async asset(): Promise<string> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.asset();
  }

  /**
   * Get the total assets managed by the vault
   * @returns Total assets
   */
  async totalAssets(): Promise<bigint> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.totalAssets();
  }

  /**
   * Get the total supply of shares
   * @returns Total supply
   */
  async totalSupply(): Promise<bigint> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.totalSupply();
  }

  //*******************************************
  //* WITHDRAW CLIENT - Vault Withdrawals
  //*******************************************

  /**
   * Withdraw assets from the vault
   * @param assets Amount of assets to withdraw
   * @param receiver Address to receive the assets
   * @param owner Address of the shares owner
   * @returns Transaction response
   */
  async withdraw(
    assets: bigint,
    receiver: string,
    owner: string
  ): Promise<ethers.TransactionResponse> {
    if (!this.withdrawClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.withdrawClient.withdraw(assets, receiver, owner);
  }

  /**
   * Redeem shares for assets
   * @param shares Amount of shares to redeem
   * @param receiver Address to receive the assets
   * @param owner Address of the shares owner
   * @returns Transaction response
   */
  async redeem(
    shares: bigint,
    receiver: string,
    owner: string
  ): Promise<ethers.TransactionResponse> {
    if (!this.withdrawClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.withdrawClient.redeem(shares, receiver, owner);
  }

  /**
   * Preview how many shares are needed to withdraw a specific amount of assets
   * @param assets Amount of assets to withdraw
   * @returns Number of shares needed
   */
  async previewWithdraw(assets: bigint): Promise<bigint> {
    if (!this.withdrawClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.withdrawClient.previewWithdraw(assets);
  }

  /**
   * Preview how many assets will be received for redeeming shares
   * @param shares Amount of shares to redeem
   * @returns Amount of assets that will be received
   */
  async previewRedeem(shares: bigint): Promise<bigint> {
    if (!this.withdrawClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.withdrawClient.previewRedeem(shares);
  }

  /**
   * Get the maximum amount of assets that can be withdrawn by an owner
   * @param owner Address of the owner
   * @returns Maximum withdrawable assets
   */
  async maxWithdraw(owner: string): Promise<bigint> {
    if (!this.withdrawClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.withdrawClient.maxWithdraw(owner);
  }

  /**
   * Get the maximum amount of shares that can be redeemed by an owner
   * @param owner Address of the owner
   * @returns Maximum redeemable shares
   */
  async maxRedeem(owner: string): Promise<bigint> {
    if (!this.withdrawClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.withdrawClient.maxRedeem(owner);
  }

  /**
   * Get the balance of shares for an owner
   * @param owner Address of the owner
   * @returns Share balance
   */
  async balanceOf(owner: string): Promise<bigint> {
    if (!this.withdrawClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.withdrawClient.balanceOf(owner);
  }

  //*******************************************
  //* UTILITY FUNCTIONS - General Helpers
  //*******************************************

  /**
   * Convert shares to assets
   * @param shares Amount of shares
   * @returns Equivalent amount of assets
   */
  async convertToAssets(shares: bigint): Promise<bigint> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.convertToAssets(shares);
  }

  /**
   * Convert assets to shares
   * @param assets Amount of assets
   * @returns Equivalent amount of shares
   */
  async convertToShares(assets: bigint): Promise<bigint> {
    if (!this.depositClient) {
      throw new Error(
        "Vault clients not initialized. Call initializeVaultClients() first."
      );
    }
    return await this.depositClient.convertToShares(assets);
  }

  /**
   * Get the MetaVault contract instance
   * @param vaultAddress Address of the MetaVault
   * @returns MetaVault contract instance
   */
  getMetaVaultContract(vaultAddress: string): ethers.Contract {
    return this.contractProvider.getMetaVaultContract(vaultAddress);
  }

  /**
   * Get the MetaVaultFactory contract instance
   * @returns MetaVaultFactory contract instance
   */
  async getMetaVaultFactoryContract(): Promise<ethers.Contract> {
    const factoryAddress = await this.getFactoryAddress();
    return this.contractProvider.getMetaVaultFactoryContract(factoryAddress);
  }
}
