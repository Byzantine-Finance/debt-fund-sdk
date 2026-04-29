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

export async function deployCompoundV3Adapter(
	cp: ContractProvider,
	vaultAddress: string,
	comet: string,
	cometRewards: string,
): Promise<DeployAdapterResult> {
	const factory = await getAdapterFactoryContract(cp, "compoundV3");
	try {
		const adapterAddress: string = await factory.createCompoundV3Adapter.staticCall(
			vaultAddress,
			comet,
			cometRewards,
		);
		const tx = await executeContractMethod(
			factory,
			"createCompoundV3Adapter",
			vaultAddress,
			comet,
			cometRewards,
		);
		(tx as DeployAdapterResult).adapterAddress = adapterAddress;
		return tx as DeployAdapterResult;
	} catch (error) {
		throw formatContractError("createCompoundV3Adapter", error);
	}
}

export async function isCompoundV3Adapter(
	cp: ContractProvider,
	account: string,
): Promise<boolean> {
	const factory = await getAdapterFactoryContract(cp, "compoundV3");
	return callContractMethod(factory, "isCompoundV3Adapter", [account]);
}

export async function findCompoundV3Adapter(
	cp: ContractProvider,
	vaultAddress: string,
	comet: string,
	cometRewards: string,
): Promise<string> {
	const factory = await getAdapterFactoryContract(cp, "compoundV3");
	return callContractMethod(factory, "compoundV3Adapter", [
		vaultAddress,
		comet,
		cometRewards,
	]);
}

// ============================================================================
// Adapter reads
// ============================================================================

export async function getIds(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "ids", []);
}

export async function getUnderlying(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "comet", []);
}
