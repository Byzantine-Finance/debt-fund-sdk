import { Contract, type ethers } from "ethers";
import { CometV3ABI } from "../../constants/abis";
import {
	type ContractProvider,
	callContractMethod,
	executeContractMethod,
	formatContractError,
} from "../../utils";
import { getAdapterFactoryContract } from "./_contracts";
import type { DeployAdapterResult } from "./GlobalAdapters";

/** Snapshot of a Compound V3 (Comet) base market. Assets in baseToken units. */
export interface CometState {
	cometAddress: string;
	totalSupply: bigint;
	totalBorrow: bigint;
	/** totalSupply - totalBorrow. */
	liquidity: bigint;
	/** Per-Comet 1e18 utilization (totalBorrow / totalSupply). */
	utilization: bigint;
	/** Adapter's withdrawable balance in base token (Comet rebases `balanceOf`). */
	adapterBalance: bigint;
	/** Per-second supply rate in WAD. */
	supplyRatePerSec: bigint;
}

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
		const adapterAddress: string =
			await factory.createCompoundV3Adapter.staticCall(
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
	return callContractMethod(factory, "isCompoundV3Adapter", account);
}

export async function findCompoundV3Adapter(
	cp: ContractProvider,
	vaultAddress: string,
	comet: string,
	cometRewards: string,
): Promise<string> {
	const factory = await getAdapterFactoryContract(cp, "compoundV3");
	return callContractMethod(
		factory,
		"compoundV3Adapter",
		vaultAddress,
		comet,
		cometRewards,
	);
}

// ============================================================================
// Adapter reads
// ============================================================================

export async function getIds(contract: ethers.Contract): Promise<string[]> {
	return callContractMethod(contract, "ids");
}

/** Read the on-chain `adapterId` (bytes32) baked into the deployed adapter. */
export async function getAdapterId(
	contract: ethers.Contract,
): Promise<string> {
	return callContractMethod(contract, "adapterId");
}

export async function getUnderlying(
	contract: ethers.Contract,
): Promise<string> {
	return callContractMethod(contract, "comet");
}

/**
 * Read the live state of the underlying Comet for this adapter.
 * Returns liquidity, utilization, supply rate, and the adapter's own balance.
 */
export async function getCometState(
	contract: ethers.Contract,
): Promise<CometState> {
	const cometAddress = await getUnderlying(contract);
	const comet = new Contract(cometAddress, CometV3ABI, contract.runner);

	const [totalSupply, totalBorrow, utilization, adapterBalance] =
		await Promise.all([
			comet.totalSupply() as Promise<bigint>,
			comet.totalBorrow() as Promise<bigint>,
			comet.getUtilization() as Promise<bigint>,
			comet.balanceOf(contract.target) as Promise<bigint>,
		]);

	let supplyRatePerSec = 0n;
	try {
		supplyRatePerSec = (await comet.getSupplyRate(utilization)) as bigint;
	} catch {
		supplyRatePerSec = 0n;
	}

	return {
		cometAddress,
		totalSupply,
		totalBorrow,
		liquidity: totalSupply - totalBorrow,
		utilization,
		adapterBalance,
		supplyRatePerSec,
	};
}

export async function getCometRewards(
	contract: ethers.Contract,
): Promise<string> {
	return callContractMethod(contract, "cometRewards");
}

export async function getClaimer(contract: ethers.Contract): Promise<string> {
	return callContractMethod(contract, "claimer");
}

export async function getSkimRecipient(
	contract: ethers.Contract,
): Promise<string> {
	return callContractMethod(contract, "skimRecipient");
}

// ============================================================================
// Adapter writes — administrative surface (target: the adapter, NOT the vault)
// ============================================================================

/** Pull rewards from `cometRewards`; `data` is the abi-encoded swap parameters. */
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
