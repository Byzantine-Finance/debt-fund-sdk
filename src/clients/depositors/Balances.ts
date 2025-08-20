import { ethers } from "ethers";
import { callContractMethod } from "../../utils/contractErrorHandler";

export async function getTotalAssets(
  vaultContract: ethers.Contract
): Promise<bigint> {
  return await callContractMethod(vaultContract, "totalAssets");
}

export async function getTotalSupply(
  vaultContract: ethers.Contract
): Promise<bigint> {
  return await callContractMethod(vaultContract, "totalSupply");
}

export async function getVirtualShares(
  vaultContract: ethers.Contract
): Promise<bigint> {
  return await callContractMethod(vaultContract, "virtualShares");
}
