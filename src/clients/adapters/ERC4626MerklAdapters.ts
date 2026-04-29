import type { ethers } from "ethers";
import {
	type ContractProvider,
	callContractMethod,
	executeContractMethod,
	formatContractError,
} from "../../utils";
import { getAdapterFactoryContract } from "./_contracts";
import type { DeployAdapterResult } from "./GlobalAdapters";

// ============================================================================
// Factory functions
// ============================================================================

export async function deployERC4626MerklAdapter(
	cp: ContractProvider,
	vaultAddress: string,
	erc4626Vault: string,
): Promise<DeployAdapterResult> {
	const factory = await getAdapterFactoryContract(cp, "erc4626Merkl");
	try {
		const adapterAddress: string = await factory.createERC4626MerklAdapter.staticCall(
			vaultAddress,
			erc4626Vault,
		);
		const tx = await executeContractMethod(
			factory,
			"createERC4626MerklAdapter",
			vaultAddress,
			erc4626Vault,
		);
		(tx as DeployAdapterResult).adapterAddress = adapterAddress;
		return tx as DeployAdapterResult;
	} catch (error) {
		throw formatContractError("createERC4626MerklAdapter", error);
	}
}

export async function isERC4626MerklAdapter(
	cp: ContractProvider,
	account: string,
): Promise<boolean> {
	const factory = await getAdapterFactoryContract(cp, "erc4626Merkl");
	return callContractMethod(factory, "isERC4626MerklAdapter", account);
}

export async function findERC4626MerklAdapter(
	cp: ContractProvider,
	vaultAddress: string,
	erc4626Vault: string,
): Promise<string> {
	const factory = await getAdapterFactoryContract(cp, "erc4626Merkl");
	return callContractMethod(factory, "erc4626MerklAdapter", vaultAddress, erc4626Vault);
}

// ============================================================================
// Adapter reads
// ============================================================================

export async function getIds(contract: ethers.Contract): Promise<string[]> {
	return callContractMethod(contract, "ids");
}

export async function getUnderlying(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "erc4626Vault");
}

export async function getMerklDistributor(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "MERKL_DISTRIBUTOR");
}

export async function getClaimer(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "claimer");
}

export async function getSkimRecipient(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "skimRecipient");
}

// ============================================================================
// Adapter writes — administrative surface (target: the adapter, NOT the vault)
// ============================================================================

/** Pull rewards from the Merkl distributor; `data` is the abi-encoded claim parameters. */
export async function claim(
	contract: ethers.Contract,
	data: string,
): Promise<ethers.TransactionResponse> {
	return executeContractMethod(contract, "claim", data);
}

export async function setClaimer(
	contract: ethers.Contract,
	newClaimer: string,
): Promise<ethers.TransactionResponse> {
	return executeContractMethod(contract, "setClaimer", newClaimer);
}

export async function setSkimRecipient(
	contract: ethers.Contract,
	newSkimRecipient: string,
): Promise<ethers.TransactionResponse> {
	return executeContractMethod(contract, "setSkimRecipient", newSkimRecipient);
}

export async function skim(
	contract: ethers.Contract,
	token: string,
): Promise<ethers.TransactionResponse> {
	return executeContractMethod(contract, "skim", token);
}
