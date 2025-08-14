import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";

// ici, tu vas faire

// function submitIsAdapter(vaultContract: ethers.Contract, adapter: string, isAdapter: boolean)
// function setIsAdapterAfterTimelock(vaultContract: ethers.Contract, adapter: string, isAdapter: boolean)
// function instantSetIsAdapter(vaultContract: ethers.Contract, adapter: string, isAdapter: boolean) // qui va faire submitIsAdapter et setIsAdapterAfterTimelock dans un multicall, mais uniquement si le timelock est à 0, tu vas check avant

// function getIsAdapter(vaultContract: ethers.Contract, adapter: string) // return isAdapter
// function getNumberOfAdapters(vaultContract: ethers.Contract)

export async function submitIsAdapter(
  vaultContract: ethers.Contract,
  adapter: string,
  isAdapter: boolean
) {
  const calldata = vaultContract.interface.encodeFunctionData("setIsAdapter", [
    adapter,
    isAdapter,
  ]);
  return await executeContractMethod(vaultContract, "submit", [calldata]);
}

export async function setIsAdapterAfterTimelock(
  vaultContract: ethers.Contract,
  adapter: string,
  isAdapter: boolean
) {
  return await executeContractMethod(vaultContract, "setIsAdapter", [
    adapter,
    isAdapter,
  ]);
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

export async function getIsAdapter(
  vaultContract: ethers.Contract,
  adapter: string
) {
  return await callContractMethod(vaultContract, "isAdapter", [adapter]);
}

export async function getNumberOfAdapters(vaultContract: ethers.Contract) {
  return await callContractMethod(vaultContract, "adaptersLength", []);
}
