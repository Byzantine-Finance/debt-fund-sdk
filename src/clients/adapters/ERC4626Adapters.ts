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

export async function deployERC4626Adapter(
	cp: ContractProvider,
	vaultAddress: string,
	morphoVaultV1: string,
): Promise<DeployAdapterResult> {
	const factory = await getAdapterFactoryContract(cp, "erc4626");
	try {
		const adapterAddress: string = await factory.createMorphoVaultV1Adapter.staticCall(
			vaultAddress,
			morphoVaultV1,
		);
		const tx = await executeContractMethod(
			factory,
			"createMorphoVaultV1Adapter",
			vaultAddress,
			morphoVaultV1,
		);
		(tx as DeployAdapterResult).adapterAddress = adapterAddress;
		return tx as DeployAdapterResult;
	} catch (error) {
		throw formatContractError("deployMorphoVaultV1Adapter", error);
	}
}

export async function isERC4626Adapter(
	cp: ContractProvider,
	account: string,
): Promise<boolean> {
	const factory = await getAdapterFactoryContract(cp, "erc4626");
	return callContractMethod(factory, "isMorphoVaultV1Adapter", account);
}

export async function findERC4626Adapter(
	cp: ContractProvider,
	vaultAddress: string,
	morphoVaultV1: string,
): Promise<string> {
	const factory = await getAdapterFactoryContract(cp, "erc4626");
	return callContractMethod(factory, "morphoVaultV1Adapter", vaultAddress, morphoVaultV1);
}

// ============================================================================
// Adapter reads
// ============================================================================

export async function getIds(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "ids");
}

export async function getUnderlying(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "morphoVaultV1");
}
