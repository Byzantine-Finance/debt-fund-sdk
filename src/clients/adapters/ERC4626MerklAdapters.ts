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
	return callContractMethod(factory, "isERC4626MerklAdapter", [account]);
}

export async function findERC4626MerklAdapter(
	cp: ContractProvider,
	vaultAddress: string,
	erc4626Vault: string,
): Promise<string> {
	const factory = await getAdapterFactoryContract(cp, "erc4626Merkl");
	return callContractMethod(factory, "erc4626MerklAdapter", [
		vaultAddress,
		erc4626Vault,
	]);
}

// ============================================================================
// Adapter reads
// ============================================================================

export async function getIds(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "ids", []);
}

export async function getUnderlying(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "erc4626Vault", []);
}
