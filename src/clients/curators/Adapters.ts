import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";

export async function submitAddAdapter(
  vaultContract: ethers.Contract,
  adapter: string
) {
  const calldata = vaultContract.interface.encodeFunctionData("addAdapter", [
    adapter,
  ]);
  return await executeContractMethod(vaultContract, "submit", calldata);
}

export async function addAdapterAfterTimelock(
  vaultContract: ethers.Contract,
  adapter: string
) {
  return await executeContractMethod(vaultContract, "addAdapter", adapter);
}

export async function instantAddAdapter(
  vaultContract: ethers.Contract,
  adapter: string
) {
  const calldataSet = vaultContract.interface.encodeFunctionData("addAdapter", [
    adapter,
  ]);
  const calldataSubmit = vaultContract.interface.encodeFunctionData("submit", [
    calldataSet,
  ]);
  return await executeContractMethod(vaultContract, "multicall", [
    calldataSubmit,
    calldataSet,
  ]);
}

export async function submitRemoveAdapter(
  vaultContract: ethers.Contract,
  adapter: string
) {
  const calldata = vaultContract.interface.encodeFunctionData("removeAdapter", [
    adapter,
  ]);
  return await executeContractMethod(vaultContract, "submit", calldata);
}

export async function removeAdapterAfterTimelock(
  vaultContract: ethers.Contract,
  adapter: string
) {
  return await executeContractMethod(vaultContract, "removeAdapter", adapter);
}

export async function instantRemoveAdapter(
  vaultContract: ethers.Contract,
  adapter: string
) {
  const calldataSet = vaultContract.interface.encodeFunctionData(
    "removeAdapter",
    [adapter]
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
