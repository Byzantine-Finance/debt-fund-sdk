import { ethers } from "ethers";
import { executeContractMethod, callContractMethod } from "../../utils";

// ========================================
// MAX RATE FUNCTIONS
// ========================================

export async function setMaxRate(
  vaultContract: ethers.Contract,
  newMaxRate: bigint
) {
  return executeContractMethod(vaultContract, "setMaxRate", newMaxRate);
}

export async function getMaxRate(vaultContract: ethers.Contract) {
  return callContractMethod(vaultContract, "maxRate");
}
