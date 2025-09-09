import { ethers } from "ethers";
import { ContractProvider } from "../../utils";

// Import all the specialized functions
import * as CreateVaultFunctions from "./CreateVault";
import * as ManageRoleFunctions from "./ManageRole";
import * as NameAndSymbolFunctions from "./NameAndSymbol";

/**
 * Main client for vault owners operations
 * Provides:
 * - Vault creation through the factory
 * - VaultOwner instances for vault-specific operations
 * - Utility methods for network configuration
 *
 * For vault-specific operations (roles, name/symbol), use the vault() method
 * to get a VaultOwner instance which provides all those operations.
 */
export class OwnersClient {
  private contractProvider: ContractProvider;

  /**
   * Creates a new OwnersClient instance
   * @param provider Ethereum provider
   * @param signer Optional signer for transactions
   */
  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.contractProvider = new ContractProvider(provider, signer);
  }

  // ========================================
  // VAULT CREATION
  // ========================================

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
  ): Promise<CreateVaultFunctions.CreateVaultResult> {
    return CreateVaultFunctions.createVault(
      this.contractProvider,
      owner,
      asset,
      salt
    );
  }

  // ========================================
  // VAULT INSTANCE FACTORY
  // ========================================

  /**
   * Get a VaultOwner instance for a specific vault
   * This provides a convenient way to work with a single vault
   * All vault operations should be done through the returned VaultOwner instance
   * @param vaultAddress The vault address
   * @returns VaultOwner instance
   */
  vault(vaultAddress: string): VaultOwner {
    return new VaultOwner(this.contractProvider, vaultAddress);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the current network configuration
   * @returns Network configuration
   */
  async getNetworkConfig() {
    return this.contractProvider.getNetworkConfig();
  }

  /**
   * Get the current chain ID
   * @returns Chain ID
   */
  async getChainId() {
    return this.contractProvider.getCurrentChainId();
  }

  /**
   * Get the vault factory contract instance
   * @returns Factory contract instance
   */
  async getFactoryContract(): Promise<ethers.Contract> {
    return this.contractProvider.getVaultFactoryContract();
  }
}

/**
 * VaultOwner class for convenient operations on a specific vault
 * This eliminates the need to pass vaultAddress repeatedly
 */
export class VaultOwner {
  private contractProvider: ContractProvider;
  private vaultAddress: string;
  private vaultContract: ethers.Contract;

  constructor(contractProvider: ContractProvider, vaultAddress: string) {
    this.contractProvider = contractProvider;
    this.vaultAddress = vaultAddress;
    this.vaultContract = contractProvider.getVaultContract(vaultAddress);
  }

  // ========================================
  // ROLE MANAGEMENT
  // ========================================

  /**
   * Set a new owner for the vault
   * @param newOwner The address of the new owner
   * @returns Transaction response
   */
  async setOwner(newOwner: string): Promise<ethers.TransactionResponse> {
    return ManageRoleFunctions.setOwner(this.vaultContract, newOwner);
  }

  /**
   * Set a new curator for the vault
   * @param newCurator The address of the new curator
   * @returns Transaction response
   */
  async setCurator(newCurator: string): Promise<ethers.TransactionResponse> {
    return ManageRoleFunctions.setCurator(this.vaultContract, newCurator);
  }

  /**
   * Add an account as a sentinel
   * @param account The account address to add as sentinel
   * @param isSentinel Whether the account is a sentinel
   * @returns Transaction response
   */
  async setIsSentinel(
    account: string,
    isSentinel: boolean
  ): Promise<ethers.TransactionResponse> {
    return ManageRoleFunctions.setIsSentinel(
      this.vaultContract,
      account,
      isSentinel
    );
  }

  /**
   * Get the current owner of the vault
   * @returns The owner address
   */
  async getOwner(): Promise<string> {
    return ManageRoleFunctions.getOwner(this.vaultContract);
  }

  /**
   * Get the current curator of the vault
   * @returns The curator address
   */
  async getCurator(): Promise<string> {
    return ManageRoleFunctions.getCurator(this.vaultContract);
  }

  /**
   * Check if an account is a sentinel
   * @param account The account address to check
   * @returns True if the account is a sentinel
   */
  async isSentinel(account: string): Promise<boolean> {
    return ManageRoleFunctions.isSentinel(this.vaultContract, account);
  }

  // ========================================
  // NAME AND SYMBOL MANAGEMENT
  // ========================================

  /**
   * Set a new name for the vault
   * @param newName The new name for the vault
   * @returns Transaction response
   */
  async setName(newName: string): Promise<ethers.TransactionResponse> {
    return NameAndSymbolFunctions.setName(this.vaultContract, newName);
  }

  /**
   * Set a new symbol for the vault
   * @param newSymbol The new symbol for the vault
   * @returns Transaction response
   */
  async setSymbol(newSymbol: string): Promise<ethers.TransactionResponse> {
    return NameAndSymbolFunctions.setSymbol(this.vaultContract, newSymbol);
  }

  /**
   * Set both name and symbol for the vault in a single transaction using multicall
   * @param newName The new name for the vault
   * @param newSymbol The new symbol for the vault
   * @returns Transaction response
   */
  async setNameAndSymbol(
    newName: string,
    newSymbol: string
  ): Promise<ethers.TransactionResponse> {
    return NameAndSymbolFunctions.setNameAndSymbol(
      this.vaultContract,
      newName,
      newSymbol
    );
  }

  /**
   * Get the vault name
   * @returns The vault name
   */
  async getName(): Promise<string> {
    return NameAndSymbolFunctions.getSharesName(this.vaultContract);
  }

  /**
   * Get the vault symbol
   * @returns The vault symbol
   */
  async getSymbol(): Promise<string> {
    return NameAndSymbolFunctions.getSharesSymbol(this.vaultContract);
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
   * Get the vault contract instance
   * @returns Vault contract instance
   */
  getContract(): ethers.Contract {
    return this.vaultContract;
  }
}
