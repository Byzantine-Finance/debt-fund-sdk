import { ethers } from "ethers";
import {
  ContractProvider,
  executeContractMethod,
  formatContractError,
} from "../../utils";
import { BYTECODE } from "./bytecode";

/**
 * Vault creation functions for owners
 */

export interface CreateVaultResult extends ethers.ContractTransactionResponse {
  vaultAddress: string;
}

/**
 * Create a new vault using the factory
 * @param contractProvider The contract provider instance
 * @param owner The address of the vault owner
 * @param asset The address of the underlying asset
 * @param salt Unique salt for deterministic vault address
 * @returns Transaction response
 */
export async function createVault(
  contractProvider: ContractProvider,
  owner: string,
  asset: string,
  salt: string
): Promise<CreateVaultResult> {
  try {
    const factoryContract = await contractProvider.getVaultFactoryContract();

    const vaultAddress = await factoryContract.createVaultV2.staticCall(
      owner,
      asset,
      salt
    );

    const tx = await executeContractMethod(
      factoryContract,
      "createVaultV2",
      owner,
      asset,
      salt
    );

    (tx as CreateVaultResult).vaultAddress = vaultAddress;

    return tx as CreateVaultResult;
  } catch (error) {
    throw formatContractError("deployMorphoVaultV1Adapter", error);
  }
}
