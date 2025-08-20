import { ethers } from "ethers";
import { callContractMethod, ContractProvider } from "../../utils";

// Import all the specialized functions
import * as DepositFunctions from "./Deposit";
import * as WithdrawFunctions from "./Withdraw";
import * as TransferFunctions from "./Transfer";
import * as BalancesFunctions from "./Balances";

/**
 * DepositorsClient class for convenient operations on a specific vault
 * This eliminates the need to pass vaultAddress repeatedly
 */
export class DepositorsClient {
  private contractProvider: ContractProvider;
  private provider: ethers.Provider;
  private vaultAddress: string;
  private vaultContract: ethers.Contract;

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

  // ========================================
  // DEPOSIT METHODS
  // ========================================

  /**
   * Deposit assets into the vault
   * @param amountAssets The amount of assets to deposit
   * @param receiver The address to receive the shares
   * @returns Transaction response
   */
  async deposit(
    amountAssets: bigint,
    receiver: string
  ): Promise<ethers.TransactionResponse> {
    return await DepositFunctions.deposit(
      this.vaultContract,
      amountAssets,
      receiver
    );
  }

  /**
   * Mint shares by depositing assets
   * @param amountShares The amount of shares to mint
   * @param receiver The address to receive the shares
   * @returns Transaction response
   */
  async mint(
    amountShares: bigint,
    receiver: string
  ): Promise<ethers.TransactionResponse> {
    return await DepositFunctions.mint(
      this.vaultContract,
      amountShares,
      receiver
    );
  }

  /**
   * Approve and deposit assets using multicall for gas optimization
   * @param amountAssets The amount of assets to deposit
   * @param receiver The address to receive the shares
   * @returns Transaction response
   */

  // ========================================
  // WITHDRAW METHODS
  // ========================================

  /**
   * Withdraw assets from the vault
   * @param amountAssets The amount of assets to withdraw
   * @param receiver The address to receive the assets
   * @param onBehalf The address of the shares owner
   * @returns Transaction response
   */
  async withdraw(
    amountAssets: bigint,
    receiver: string,
    onBehalf: string
  ): Promise<ethers.TransactionResponse> {
    return await WithdrawFunctions.withdraw(
      this.vaultContract,
      amountAssets,
      receiver,
      onBehalf
    );
  }

  /**
   * Redeem shares for assets
   * @param amountShares The amount of shares to redeem
   * @param receiver The address to receive the assets
   * @param onBehalf The address of the shares owner
   * @returns Transaction response
   */
  async redeem(
    amountShares: bigint,
    receiver: string,
    onBehalf: string
  ): Promise<ethers.TransactionResponse> {
    return await WithdrawFunctions.redeem(
      this.vaultContract,
      amountShares,
      receiver,
      onBehalf
    );
  }

  // ========================================
  // TRANSFER METHODS
  // ========================================

  /**
   * Transfer shares to another address
   * @param to The recipient address
   * @param shares The amount of shares to transfer
   * @returns Transaction response
   */
  async transfer(
    to: string,
    shares: bigint
  ): Promise<ethers.TransactionResponse> {
    return await TransferFunctions.transfer(this.vaultContract, to, shares);
  }

  /**
   * Transfer shares from one address to another (requires approval)
   * @param from The sender address
   * @param to The recipient address
   * @param shares The amount of shares to transfer
   * @returns Transaction response
   */
  async transferFrom(
    from: string,
    to: string,
    shares: bigint
  ): Promise<ethers.TransactionResponse> {
    return await TransferFunctions.transferFrom(
      this.vaultContract,
      from,
      to,
      shares
    );
  }

  /**
   * Approve a spender to transfer shares on behalf of the owner
   * @param spender The spender address
   * @param shares The amount of shares to approve
   * @returns Transaction response
   */
  async approve(
    spender: string,
    shares: bigint
  ): Promise<ethers.TransactionResponse> {
    return await TransferFunctions.approve(this.vaultContract, spender, shares);
  }

  // ========================================
  // READ METHODS
  // ========================================

  /**
   * Get the shares balance for a specific account
   * @param account The account address
   * @returns The shares balance
   */
  async getSharesBalance(account: string): Promise<bigint> {
    return await DepositFunctions.getSharesBalance(this.vaultContract, account);
  }

  /**
   * Get the allowance for a spender
   * @param owner The owner address
   * @param spender The spender address
   * @returns The allowance amount
   */
  async getAllowance(userAddress: string): Promise<bigint> {
    return await DepositFunctions.getAllowance(
      this.provider,
      this.vaultContract,
      userAddress
    );
  }

  // ========================================
  // PREVIEW METHODS
  // ========================================

  /**
   * Preview how many shares will be received for a given amount of assets
   * @param assets The amount of assets to deposit
   * @returns The amount of shares that would be received
   *
   * @example
   * const shares = await client.previewDeposit(ethers.parseUnits("1.0", 6));
   * console.log(`You will receive ${shares} shares`);
   * // 1000000 USDC -> 1000000000000000000 byzUSDC
   */
  async previewDeposit(assets: bigint): Promise<bigint> {
    return await DepositFunctions.previewDeposit(this.vaultContract, assets);
  }

  /**
   * Preview how many assets are needed to mint a given amount of shares
   * @param shares The amount of shares to mint
   * @returns The amount of assets needed
   *
   * @example
   * const assets = await client.previewMint(ethers.parseUnits("1.0", 18));
   * console.log(`You will need ${assets} assets`);
   * // 1000000000000000000 byzUSDC -> 1000000 USDC
   */

  async previewMint(shares: bigint): Promise<bigint> {
    return await DepositFunctions.previewMint(this.vaultContract, shares);
  }

  /**
   * Preview how many assets will be received for a given amount of shares
   * @param shares The amount of shares to redeem
   * @returns The amount of assets that would be received
   */
  async previewRedeem(shares: bigint): Promise<bigint> {
    return await WithdrawFunctions.previewRedeem(this.vaultContract, shares);
  }

  /**
   * Preview how many shares are needed to withdraw a given amount of assets
   * @param assets The amount of assets to withdraw
   * @returns The amount of shares needed
   */
  async previewWithdraw(assets: bigint): Promise<bigint> {
    return await WithdrawFunctions.previewWithdraw(this.vaultContract, assets);
  }

  // ========================================
  // BALANCES METHODS
  // ========================================

  /**
   * Get the total assets in the vault
   * @returns The total assets
   */
  async getTotalAssets(): Promise<bigint> {
    return await BalancesFunctions.getTotalAssets(this.vaultContract);
  }

  /**
   * Get the total supply of shares in the vault
   * @returns The total supply
   */
  async getTotalSupply(): Promise<bigint> {
    return await BalancesFunctions.getTotalSupply(this.vaultContract);
  }

  /**
   * Get the virtual shares in the vault
   * @returns The virtual shares
   */
  async getVirtualShares(): Promise<bigint> {
    return await BalancesFunctions.getVirtualShares(this.vaultContract);
  }

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
   * Get the vault asset address
   * @returns The vault asset address
   */
  async getAsset(): Promise<string> {
    return await callContractMethod(this.vaultContract, "asset");
  }

  /**
   * Get the vault contract instance
   * @returns Vault contract instance
   */
  getContract(): ethers.Contract {
    return this.vaultContract;
  }
}
