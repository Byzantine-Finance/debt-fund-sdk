import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";

/**
 * Withdraw assets from the vault
 * @param vaultContract The vault contract instance
 * @param amountAssets The amount of assets to withdraw
 * @param receiver The address to receive the assets
 * @param onBehalf The address of the shares owner
 * @returns Transaction response
 */
export async function withdraw(
  vaultContract: ethers.Contract,
  amountAssets: bigint,
  receiver: string,
  onBehalf: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "withdraw",
    amountAssets,
    receiver,
    onBehalf
  );
}

/**
 * Redeem shares for assets
 * @param vaultContract The vault contract instance
 * @param amountShares The amount of shares to redeem
 * @param receiver The address to receive the assets
 * @param onBehalf The address of the shares owner
 * @returns Transaction response
 */
export async function redeem(
  vaultContract: ethers.Contract,
  amountShares: bigint,
  receiver: string,
  onBehalf: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "redeem",
    amountShares,
    receiver,
    onBehalf
  );
}

// Preview functions for calculating amounts

/**
 * Preview how many assets will be received for a given amount of shares
 * @param vaultContract The vault contract instance
 * @param shares The amount of shares to redeem
 * @returns The amount of assets that would be received
 */
export async function previewRedeem(
  vaultContract: ethers.Contract,
  shares: bigint
): Promise<bigint> {
  return await callContractMethod(vaultContract, "previewRedeem", shares);
}

/**
 * Preview how many shares are needed to withdraw a given amount of assets
 * @param vaultContract The vault contract instance
 * @param assets The amount of assets to withdraw
 * @returns The amount of shares needed
 */
export async function previewWithdraw(
  vaultContract: ethers.Contract,
  assets: bigint
): Promise<bigint> {
  return await callContractMethod(vaultContract, "previewWithdraw", assets);
}
