import type { ethers } from "ethers";
import {
	type ContractProvider,
	callContractMethod,
	executeContractMethod,
	formatContractError,
} from "../../utils";
import { getAdapterFactoryContract } from "./_contracts";
import type { DeployAdapterResult } from "./GlobalAdapters";

export interface MarketParams {
	loanToken: string;
	collateralToken: string;
	oracle: string;
	irm: string;
	lltv: string;
}

// ============================================================================
// Factory functions
// ============================================================================

export async function deployMorphoMarketV1Adapter(
	cp: ContractProvider,
	vaultAddress: string,
	morphoMarketV1: string,
): Promise<DeployAdapterResult> {
	const factory = await getAdapterFactoryContract(cp, "morphoMarketV1");
	try {
		const adapterAddress: string = await factory.createMorphoMarketV1Adapter.staticCall(
			vaultAddress,
			morphoMarketV1,
		);
		const tx = await executeContractMethod(
			factory,
			"createMorphoMarketV1Adapter",
			vaultAddress,
			morphoMarketV1,
		);
		(tx as DeployAdapterResult).adapterAddress = adapterAddress;
		return tx as DeployAdapterResult;
	} catch (error) {
		throw formatContractError("createMorphoMarketV1Adapter", error);
	}
}

export async function isMorphoMarketV1Adapter(
	cp: ContractProvider,
	account: string,
): Promise<boolean> {
	const factory = await getAdapterFactoryContract(cp, "morphoMarketV1");
	return callContractMethod(factory, "isMorphoMarketV1Adapter", [account]);
}

export async function findMorphoMarketV1Adapter(
	cp: ContractProvider,
	vaultAddress: string,
	morphoMarketV1: string,
): Promise<string> {
	const factory = await getAdapterFactoryContract(cp, "morphoMarketV1");
	return callContractMethod(factory, "morphoMarketV1Adapter", [
		vaultAddress,
		morphoMarketV1,
	]);
}

// ============================================================================
// Adapter reads
// ============================================================================

export async function getIds(
	contract: ethers.Contract,
	marketParams: MarketParams,
): Promise<string[]> {
	return callContractMethod(contract, "ids", [marketParams]);
}

export async function getUnderlying(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "morpho", []);
}

export async function getMarketParamsListLength(
	contract: ethers.Contract,
): Promise<number> {
	return callContractMethod(contract, "marketParamsListLength", []);
}

export async function getMarketParamsList(
	contract: ethers.Contract,
	index: number,
): Promise<MarketParams> {
	return callContractMethod(contract, "marketParamsList", [index]);
}
