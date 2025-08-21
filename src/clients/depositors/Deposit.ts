import { ethers } from "ethers";
import { callContractMethod, executeContractMethod } from "../../utils";
import { erc20Abi } from "viem";

/**
 * Deposit assets into the vault
 * @param vaultContract The vault contract instance
 * @param amountAssets The amount of assets to deposit
 * @param receiver The address to receive the shares
 * @returns Transaction response
 */
export async function deposit(
  vaultContract: ethers.Contract,
  amountAssets: bigint,
  receiver: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "deposit",
    amountAssets,
    receiver
  );
}

/**
 * Mint shares by depositing assets
 * @param vaultContract The vault contract instance
 * @param amountShares The amount of shares to mint
 * @param receiver The address to receive the shares
 * @returns Transaction response
 */
export async function mint(
  vaultContract: ethers.Contract,
  amountShares: bigint,
  receiver: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "mint",
    amountShares,
    receiver
  );
}

// Read functions

export async function getSharesBalance(
  vaultContract: ethers.Contract,
  account: string
): Promise<bigint> {
  return await callContractMethod(vaultContract, "balanceOf", account);
}

export async function getAllowance(
  provider: ethers.Provider,
  vaultContract: ethers.Contract,
  userAddress: string
): Promise<bigint> {
  const assetAddress = await callContractMethod(vaultContract, "asset");

  const tokenContract = new ethers.Contract(assetAddress, erc20Abi, provider);

  return await callContractMethod(
    tokenContract,
    "allowance",
    userAddress,
    vaultContract.target
  );
}

// Preview functions for calculating amounts

/**
 * Preview how many shares will be received for a given amount of assets
 * @param vaultContract The vault contract instance
 * @param assets The amount of assets to deposit
 * @returns The amount of shares that would be received
 */
export async function previewDeposit(
  vaultContract: ethers.Contract,
  assets: bigint
): Promise<bigint> {
  return await callContractMethod(vaultContract, "previewDeposit", assets);
}

/**
 * Preview how many assets are needed to mint a given amount of shares
 * @param vaultContract The vault contract instance
 * @param shares The amount of shares to mint
 * @returns The amount of assets needed
 */
export async function previewMint(
  vaultContract: ethers.Contract,
  shares: bigint
): Promise<bigint> {
  return await callContractMethod(vaultContract, "previewMint", shares);
}
