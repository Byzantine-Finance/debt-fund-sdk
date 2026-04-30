import { Contract, type ethers } from "ethers";
import {
	type ContractProvider,
	callContractMethod,
	executeContractMethod,
	formatContractError,
} from "../../utils";
import { getAdapterFactoryContract } from "./_contracts";
import type { DeployAdapterResult } from "./GlobalAdapters";

/** Standard ERC-4626 view surface — used to query any underlying vault. */
const ERC4626_VIEW_ABI = [
	"function totalAssets() view returns (uint256)",
	"function totalSupply() view returns (uint256)",
	"function maxWithdraw(address owner) view returns (uint256)",
];

/** Snapshot of an underlying ERC-4626 vault held by this adapter. */
export interface ERC4626VaultState {
	underlyingAddress: string;
	/** TVL of the underlying vault, in asset units. */
	totalAssets: bigint;
	/** Underlying vault's share supply. */
	totalSupply: bigint;
	/** Assets the adapter can withdraw right now. */
	maxWithdraw: bigint;
}

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
		const adapterAddress: string =
			await factory.createMorphoVaultV1Adapter.staticCall(
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
	return callContractMethod(
		factory,
		"morphoVaultV1Adapter",
		vaultAddress,
		morphoVaultV1,
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
	return callContractMethod(contract, "morphoVaultV1");
}

export async function getSkimRecipient(
	contract: ethers.Contract,
): Promise<string> {
	return callContractMethod(contract, "skimRecipient");
}

/**
 * Read the live state of the underlying ERC-4626 vault.
 * No on-chain APY (would require historical share-price drift).
 */
export async function getVaultState(
	contract: ethers.Contract,
): Promise<ERC4626VaultState> {
	const underlyingAddress = await getUnderlying(contract);
	const underlying = new Contract(
		underlyingAddress,
		ERC4626_VIEW_ABI,
		contract.runner,
	);
	const [totalAssets, totalSupply, maxWithdraw] = await Promise.all([
		underlying.totalAssets() as Promise<bigint>,
		underlying.totalSupply() as Promise<bigint>,
		underlying.maxWithdraw(contract.target) as Promise<bigint>,
	]);
	return { underlyingAddress, totalAssets, totalSupply, maxWithdraw };
}

// ============================================================================
// Adapter writes — administrative surface (target: the adapter, NOT the vault)
// ============================================================================

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
