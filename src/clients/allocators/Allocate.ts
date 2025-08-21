// allocate
// deallocate

// getAllocation

import { ethers } from "ethers";
import { callContractMethod, executeContractMethod } from "../../utils";
import { erc20Abi } from "viem";

export async function allocate(
  vaultContract: ethers.Contract,
  adapter: string,
  data: string,
  assets: bigint
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "allocate",
    adapter,
    data,
    assets
  );
}

export async function deallocate(
  vaultContract: ethers.Contract,
  adapter: string,
  data: string,
  assets: bigint
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "deallocate",
    adapter,
    data,
    assets
  );
}

// Read functions

export async function getAllocation(
  vaultContract: ethers.Contract,
  id: string
): Promise<bigint> {
  return await callContractMethod(vaultContract, "allocation", id);
}

export async function getIdleBalance(
  provider: ethers.Provider,
  vaultContract: ethers.Contract
): Promise<bigint> {
  const assetAddress = await callContractMethod(vaultContract, "asset");
  const tokenContract = new ethers.Contract(assetAddress, erc20Abi, provider);
  return await callContractMethod(
    tokenContract,
    "balanceOf",
    vaultContract.target
  );
}
