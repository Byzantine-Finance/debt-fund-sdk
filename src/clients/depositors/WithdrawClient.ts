// import { ethers } from "ethers";
// import { ContractProvider, executeContractMethod } from "../../utils";

// /**
//  * Client for MetaVault withdrawal operations
//  */
// export class WithdrawClient {
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
//    * Withdraw assets from the vault
//    * @param assets Amount of assets to withdraw
//    * @param receiver Address to receive the assets
//    * @param owner Address of the shares owner
//    * @returns Transaction response
//    */
//   async withdraw(
//     assets: bigint,
//     receiver: string,
//     owner: string
//   ): Promise<ethers.TransactionResponse> {
//     const vaultContract = this.getVaultContract();
//     return await executeContractMethod(
//       vaultContract,
//       "withdraw",
//       assets,
//       receiver,
//       owner
//     );
//   }

//   /**
//    * Redeem shares for assets
//    * @param shares Amount of shares to redeem
//    * @param receiver Address to receive the assets
//    * @param owner Address of the shares owner
//    * @returns Transaction response
//    */
//   async redeem(
//     shares: bigint,
//     receiver: string,
//     owner: string
//   ): Promise<ethers.TransactionResponse> {
//     const vaultContract = this.getVaultContract();
//     return await executeContractMethod(
//       vaultContract,
//       "redeem",
//       shares,
//       receiver,
//       owner
//     );
//   }

//   /**
//    * Preview how many shares are needed to withdraw a specific amount of assets
//    * @param assets Amount of assets to withdraw
//    * @returns Number of shares needed
//    */
//   async previewWithdraw(assets: bigint): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.previewWithdraw(assets);
//   }

//   /**
//    * Preview how many assets will be received for redeeming shares
//    * @param shares Amount of shares to redeem
//    * @returns Amount of assets that will be received
//    */
//   async previewRedeem(shares: bigint): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.previewRedeem(shares);
//   }

//   /**
//    * Get the maximum amount of assets that can be withdrawn by an owner
//    * @param owner Address of the owner
//    * @returns Maximum withdrawable assets
//    */
//   async maxWithdraw(owner: string): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.maxWithdraw(owner);
//   }

//   /**
//    * Get the maximum amount of shares that can be redeemed by an owner
//    * @param owner Address of the owner
//    * @returns Maximum redeemable shares
//    */
//   async maxRedeem(owner: string): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.maxRedeem(owner);
//   }

//   /**
//    * Get the balance of shares for an owner
//    * @param owner Address of the owner
//    * @returns Share balance
//    */
//   async balanceOf(owner: string): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.balanceOf(owner);
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

//   /**
//    * Convert assets to shares
//    * @param assets Amount of assets
//    * @returns Equivalent amount of shares
//    */
//   async convertToShares(assets: bigint): Promise<bigint> {
//     const vaultContract = this.getVaultContract();
//     return await vaultContract.convertToShares(assets);
//   }
// }
