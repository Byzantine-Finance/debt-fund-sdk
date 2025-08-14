// import { ethers } from "ethers";
// import { ContractProvider, executeContractMethod } from "../../utils";

// /**
//  * Client for MetaVault deposit operations
//  */
// export class DepositClient {
//   private contractProvider: ContractProvider;
//   private vaultAddress: string;

//   constructor(
//     provider: ethers.Provider,
//     vaultAddress: string,
//     signer?: ethers.Signer
//   ) {
//     this.contractProvider = new ContractProvider(provider, signer);
//     this.vaultAddress = vaultAddress;
//   }

//   /**
//    * Get the MetaVault contract instance
//    * @returns The MetaVault contract instance
//    */
//   private getVaultContract(): ethers.Contract {
//     return this.contractProvider.getMetaVaultContract(this.vaultAddress);
//   }

//   /**
//    * Deposit assets into the vault
//    * @param assets Amount of assets to deposit
//    * @param receiver Address to receive the shares
//    * @returns Transaction response
//    */
//   async deposit(
//     assets: bigint,
//     receiver: string
//   ): Promise<ethers.TransactionResponse> {
//     const vaultContract = this.getVaultContract();
//     return await executeContractMethod(
//       vaultContract,
//       "deposit",
//       assets,
//       receiver
//     );
//   }

//   /**
//    * Mint shares by depositing assets
//    * @param shares Amount of shares to mint
//    * @param receiver Address to receive the shares
//    * @returns Transaction response
//    */
//   async mint(
//     shares: bigint,
//     receiver: string
//   ): Promise<ethers.TransactionResponse> {
//     const vaultContract = this.getVaultContract();
//     return await executeContractMethod(vaultContract, "mint", shares, receiver);
//   }

//   /**
//    * Preview how many shares will be received for depositing assets
//    * @param assets Amount of assets to deposit
//    * @returns Number of shares that will be received
//    */
//   async previewDeposit(assets: bigint): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.previewDeposit(assets);
//   }

//   /**
//    * Preview how many assets are needed to mint shares
//    * @param shares Amount of shares to mint
//    * @returns Amount of assets needed
//    */
//   async previewMint(shares: bigint): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.previewMint(shares);
//   }

//   /**
//    * Get the maximum amount of assets that can be deposited
//    * @param receiver Address of the receiver
//    * @returns Maximum depositable assets
//    */
//   async maxDeposit(receiver: string): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.maxDeposit(receiver);
//   }

//   /**
//    * Get the maximum amount of shares that can be minted
//    * @param receiver Address of the receiver
//    * @returns Maximum mintable shares
//    */
//   async maxMint(receiver: string): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.maxMint(receiver);
//   }

//   /**
//    * Get the underlying asset address of the vault
//    * @returns Asset address
//    */
//   async asset(): Promise<string> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.asset();
//   }

//   /**
//    * Get the total assets managed by the vault
//    * @returns Total assets
//    */
//   async totalAssets(): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.totalAssets();
//   }

//   /**
//    * Get the total supply of shares
//    * @returns Total supply
//    */
//   async totalSupply(): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.totalSupply();
//   }

//   /**
//    * Convert assets to shares
//    * @param assets Amount of assets
//    * @returns Equivalent amount of shares
//    */
//   async convertToShares(assets: bigint): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.convertToShares(assets);
//   }

//   /**
//    * Convert shares to assets
//    * @param shares Amount of shares
//    * @returns Equivalent amount of assets
//    */
//   async convertToAssets(shares: bigint): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.convertToAssets(shares);
//   }
// }
