import { ethers } from "ethers";
import { callContractMethod, executeContractMethod } from "../../utils";

export async function setLiquidityAdapterAndData(
  vaultContract: ethers.Contract,
  newLiquidityAdapter: string,
  newLiquidityData: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "setLiquidityAdapterAndData",
    newLiquidityAdapter,
    newLiquidityData
  );
}

// Read functions

export async function getLiquidityAdapter(
  vaultContract: ethers.Contract
): Promise<string> {
  return await callContractMethod(vaultContract, "liquidityAdapter");
}

export async function getLiquidityData(
  vaultContract: ethers.Contract
): Promise<string> {
  return await callContractMethod(vaultContract, "liquidityData");
}
