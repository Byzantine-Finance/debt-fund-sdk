import { ethers } from "ethers";
import { callContractMethod, executeContractMethod } from "../../utils";

/**
 * Force deallocate assets from an adapter (emergency function)
 * @param adapter - Address of the adapter to force deallocate from
 * @param data - Additional data for the deallocation
 * @param assets - Amount of assets to deallocate
 * @param onBehalf - Address to deallocate on behalf of
 * @returns Contract transaction
 */
export async function forceDeallocate(
  vaultContract: ethers.Contract,
  adapter: string,
  data: string,
  assets: bigint,
  onBehalf: string
): Promise<ethers.TransactionResponse> {
  return await executeContractMethod(
    vaultContract,
    "forceDeallocate",
    adapter,
    data,
    assets,
    onBehalf
  );
}
