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
// Factory functions — V2 ABI: morpho + adaptiveCurveIrm are baked into the
// factory at deploy time, so per-call only `parentVault` is passed.
// ============================================================================

export async function deployMorphoMarketV1Adapter(
	cp: ContractProvider,
	vaultAddress: string,
): Promise<DeployAdapterResult> {
	const factory = await getAdapterFactoryContract(cp, "morphoMarketV1");
	try {
		const adapterAddress: string =
			await factory.createMorphoMarketV1AdapterV2.staticCall(vaultAddress);
		const tx = await executeContractMethod(
			factory,
			"createMorphoMarketV1AdapterV2",
			vaultAddress,
		);
		(tx as DeployAdapterResult).adapterAddress = adapterAddress;
		return tx as DeployAdapterResult;
	} catch (error) {
		throw formatContractError("createMorphoMarketV1AdapterV2", error);
	}
}

export async function isMorphoMarketV1Adapter(
	cp: ContractProvider,
	account: string,
): Promise<boolean> {
	const factory = await getAdapterFactoryContract(cp, "morphoMarketV1");
	return callContractMethod(factory, "isMorphoMarketV1AdapterV2", account);
}

export async function findMorphoMarketV1Adapter(
	cp: ContractProvider,
	vaultAddress: string,
): Promise<string> {
	const factory = await getAdapterFactoryContract(cp, "morphoMarketV1");
	return callContractMethod(factory, "morphoMarketV1AdapterV2", vaultAddress);
}

/** Read the morpho address baked into the factory. */
export async function getFactoryMorpho(cp: ContractProvider): Promise<string> {
	const factory = await getAdapterFactoryContract(cp, "morphoMarketV1");
	return callContractMethod(factory, "morpho");
}

/** Read the adaptive-curve IRM address baked into the factory. */
export async function getFactoryAdaptiveCurveIrm(
	cp: ContractProvider,
): Promise<string> {
	const factory = await getAdapterFactoryContract(cp, "morphoMarketV1");
	return callContractMethod(factory, "adaptiveCurveIrm");
}

// ============================================================================
// Adapter reads
// ============================================================================

export async function getIds(
	contract: ethers.Contract,
	marketParams: MarketParams,
): Promise<string[]> {
	return callContractMethod(contract, "ids", marketParams);
}

export async function getUnderlying(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "morpho");
}

export async function getMarketIdsLength(
	contract: ethers.Contract,
): Promise<number> {
	return callContractMethod(contract, "marketIdsLength");
}

export async function getMarketId(
	contract: ethers.Contract,
	index: number,
): Promise<string> {
	return callContractMethod(contract, "marketIds", index);
}
