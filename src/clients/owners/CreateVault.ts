import { ethers } from "ethers";
import { ContractProvider, executeContractMethod } from "../../utils";

/**
 * Vault creation functions for owners
 */

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
): Promise<ethers.TransactionResponse> {
  const factoryContract = await contractProvider.getVaultFactoryContract();
  return await executeContractMethod(
    factoryContract,
    "createVaultV2",
    owner,
    asset,
    salt
  );
}
