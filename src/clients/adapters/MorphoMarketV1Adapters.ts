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

export async function getSkimRecipient(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "skimRecipient");
}

/** Timelock duration (seconds) for a given selector on this adapter. */
export async function getTimelock(
	contract: ethers.Contract,
	selector: string,
): Promise<bigint> {
	return callContractMethod(contract, "timelock", selector);
}

/** Whether `selector` has been permanently abdicated (i.e. timelock-locked-forever). */
export async function getAbdicated(
	contract: ethers.Contract,
	selector: string,
): Promise<boolean> {
	return callContractMethod(contract, "abdicated", selector);
}

/** When the previously-submitted call payload `data` becomes executable (unix sec). */
export async function getExecutableAt(
	contract: ethers.Contract,
	data: string,
): Promise<bigint> {
	return callContractMethod(contract, "executableAt", data);
}

// ============================================================================
// Adapter writes — administrative surface (target: the adapter, NOT the vault)
// These cannot be bundled into the parent vault's multicall.
// ============================================================================

/** Schedule a timelocked call. `data` = the encoded function call to execute later. */
export async function submit(
	contract: ethers.Contract,
	data: string,
): Promise<ethers.TransactionResponse> {
	return executeContractMethod(contract, "submit", data);
}

/** Cancel a previously submitted call before it executes. */
export async function revoke(
	contract: ethers.Contract,
	data: string,
): Promise<ethers.TransactionResponse> {
	return executeContractMethod(contract, "revoke", data);
}

/** Permanently disable `selector` on this adapter. Irreversible. */
export async function abdicate(
	contract: ethers.Contract,
	selector: string,
): Promise<ethers.TransactionResponse> {
	return executeContractMethod(contract, "abdicate", selector);
}

/** Increase the timelock for `selector`. Not itself timelocked. */
export async function increaseTimelock(
	contract: ethers.Contract,
	selector: string,
	newDuration: bigint,
): Promise<ethers.TransactionResponse> {
	return executeContractMethod(contract, "increaseTimelock", selector, newDuration);
}

/** Decrease the timelock for `selector`. Itself timelocked — must be `submit`'d first. */
export async function decreaseTimelock(
	contract: ethers.Contract,
	selector: string,
	newDuration: bigint,
): Promise<ethers.TransactionResponse> {
	return executeContractMethod(contract, "decreaseTimelock", selector, newDuration);
}

/** Timelocked — must be `submit`'d first. */
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
