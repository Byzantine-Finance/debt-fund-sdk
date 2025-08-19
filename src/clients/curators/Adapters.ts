import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";

export async function submitIsAdapter(
  vaultContract: ethers.Contract,
  adapter: string,
  isAdapter: boolean
) {
  const calldata = vaultContract.interface.encodeFunctionData("setIsAdapter", [
    adapter,
    isAdapter,
  ]);
  return await executeContractMethod(vaultContract, "submit", calldata);
}

export async function setIsAdapterAfterTimelock(
  vaultContract: ethers.Contract,
  adapter: string,
  isAdapter: boolean
) {
  return await executeContractMethod(
    vaultContract,
    "setIsAdapter",
    adapter,
    isAdapter
  );
}

export async function instantSetIsAdapter(
  vaultContract: ethers.Contract,
  adapter: string,
  isAdapter: boolean
) {
  const calldataSet = vaultContract.interface.encodeFunctionData(
    "setIsAdapter",
    [adapter, isAdapter]
  );
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataSet,
  ]);
  return await executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataSet,
  ]);
}

// Getters

export async function getIsAdapter(
  vaultContract: ethers.Contract,
  adapter: string
) {
  return await callContractMethod(vaultContract, "isAdapter", [adapter]);
}

export async function getAdaptersLength(vaultContract: ethers.Contract) {
  return await callContractMethod(vaultContract, "adaptersLength", []);
}

export async function getAdapterByIndex(
  vaultContract: ethers.Contract,
  index: number
) {
  return await callContractMethod(vaultContract, "adapters", [index]);
}
