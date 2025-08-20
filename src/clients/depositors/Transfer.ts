import { ethers } from "ethers";
import { callContractMethod, executeContractMethod } from "../../utils";

/**
 * Transfer shares to another address
 * @param vaultContract The vault contract instance
 * @param to The recipient address
 * @param shares The amount of shares to transfer
 * @returns Transaction response
 */
export async function transfer(
  vaultContract: ethers.Contract,
  to: string,
  shares: bigint
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(vaultContract, "transfer", to, shares);
}

/**
 * Transfer shares from one address to another (requires approval)
 * @param vaultContract The vault contract instance
 * @param from The sender address
 * @param to The recipient address
 * @param shares The amount of shares to transfer
 * @returns Transaction response
 */
export async function transferFrom(
  vaultContract: ethers.Contract,
  from: string,
  to: string,
  shares: bigint
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "transferFrom",
    from,
    to,
    shares
  );
}

/**
 * Get the allowance for a spender
 * @param vaultContract The vault contract instance
 * @param owner The owner address
 * @param spender The spender address
 * @returns The allowance amount
 */
export async function allowance(
  vaultContract: ethers.Contract,
  owner: string,
  spender: string
): Promise<bigint> {
  return await callContractMethod(vaultContract, "allowance", owner, spender);
}

/**
 * Approve a spender to transfer shares on behalf of the owner
 * @param vaultContract The vault contract instance
 * @param spender The spender address
 * @param shares The amount of shares to approve
 * @returns Transaction response
 */
export async function approve(
  vaultContract: ethers.Contract,
  spender: string,
  shares: bigint
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(vaultContract, "approve", spender, shares);
}
