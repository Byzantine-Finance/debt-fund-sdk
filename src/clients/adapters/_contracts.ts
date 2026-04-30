/**
 * Internal helpers — build `ethers.Contract` instances for adapter-related
 * contracts. Centralises the (chain, type) → (address, ABI) routing that
 * was previously duplicated across nine getter methods on `ContractProvider`.
 *
 * Not exported from the package.
 */

import { Contract, type ethers } from "ethers";
import {
	CompoundV3AdapterABI,
	CompoundV3AdapterFactoryABI,
	ERC4626MerklAdapterABI,
	ERC4626MerklAdapterFactoryABI,
	MorphoMarketV1AdapterABI,
	MorphoMarketV1AdapterFactoryABI,
	MorphoVaultV1AdapterABI,
	MorphoVaultV1AdapterFactoryABI,
} from "../../constants/abis";
import type { NetworkConfig } from "../../types";
import type { ContractProvider } from "../../utils";
import type { AdapterType } from "./AdaptersClient";

/** ABI used by the deployed adapter (per-type). */
const ADAPTER_ABIS = {
	erc4626: MorphoVaultV1AdapterABI,
	erc4626Merkl: ERC4626MerklAdapterABI,
	compoundV3: CompoundV3AdapterABI,
	morphoMarketV1: MorphoMarketV1AdapterABI,
} as const;

/** ABI used by the factory that deploys adapters of each type. */
const FACTORY_ABIS = {
	erc4626: MorphoVaultV1AdapterFactoryABI,
	erc4626Merkl: ERC4626MerklAdapterFactoryABI,
	compoundV3: CompoundV3AdapterFactoryABI,
	morphoMarketV1: MorphoMarketV1AdapterFactoryABI,
} as const;

/** Pull the on-chain factory address for a given adapter type. */
function factoryAddressFor(cfg: NetworkConfig, type: AdapterType): string {
	switch (type) {
		case "erc4626":
			return cfg.adapters.erc4626AdapterFactory;
		case "erc4626Merkl":
			return cfg.adapters.erc4626MerklAdapterFactory;
		case "compoundV3":
			return cfg.adapters.compoundV3AdapterFactory;
		case "morphoMarketV1":
			return cfg.adapters.morphoMarketV1AdapterFactory;
	}
}

/** Build the adapter-factory contract for `type` on the current chain. */
export async function getAdapterFactoryContract(
	cp: ContractProvider,
	type: AdapterType,
): Promise<ethers.Contract> {
	const cfg = await cp.getNetworkConfig();
	return new Contract(
		factoryAddressFor(cfg, type),
		FACTORY_ABIS[type],
		cp.runner,
	);
}

/** Build a deployed-adapter contract for `address` of the given `type`. */
export function getAdapterContract(
	cp: ContractProvider,
	address: string,
	type: AdapterType,
): ethers.Contract {
	return new Contract(address, ADAPTER_ABIS[type], cp.runner);
}
