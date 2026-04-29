import type { ethers } from "ethers";
import {
	type ContractProvider,
	callContractMethod,
	formatContractError,
} from "../../utils";
import * as CompoundV3 from "./CompoundV3Adapters";
import * as ERC4626 from "./ERC4626Adapters";
import * as ERC4626Merkl from "./ERC4626MerklAdapters";
import * as MorphoMarketV1 from "./MorphoMarketV1Adapters";
import { getAdapterContract } from "./_contracts";
import type { AdapterType } from "./AdaptersClient";

export interface DeployAdapterResult extends ethers.ContractTransactionResponse {
	adapterAddress: string;
}

/** Dispatch deployment to the per-type module. */
export async function deployAdapter(
	cp: ContractProvider,
	type: AdapterType,
	parentAddress: string,
	underlyingAddress: string,
	cometRewards?: string,
): Promise<DeployAdapterResult> {
	switch (type) {
		case "erc4626":
			return ERC4626.deployERC4626Adapter(cp, parentAddress, underlyingAddress);
		case "erc4626Merkl":
			return ERC4626Merkl.deployERC4626MerklAdapter(cp, parentAddress, underlyingAddress);
		case "compoundV3":
			if (!cometRewards) {
				throw new Error("cometRewards is required to deploy a compoundV3 adapter");
			}
			return CompoundV3.deployCompoundV3Adapter(
				cp,
				parentAddress,
				underlyingAddress,
				cometRewards,
			);
		case "morphoMarketV1":
			return MorphoMarketV1.deployMorphoMarketV1Adapter(
				cp,
				parentAddress,
				underlyingAddress,
			);
	}
}

/**
 * Read the factory address that deployed an adapter.
 * Every adapter exposes `factory()`; the ABI of any concrete adapter type
 * works because the selector is identical, so we use the MarketV1 ABI here
 * as a generic placeholder.
 */
export async function getAdapterFactoryAddress(
	cp: ContractProvider,
	adapterAddress: string,
): Promise<string> {
	try {
		const adapter = getAdapterContract(cp, adapterAddress, "morphoMarketV1");
		const addr: string = await callContractMethod(adapter, "factory");
		return addr.toLowerCase();
	} catch (error) {
		throw formatContractError("getAdapterFactoryAddress", error);
	}
}

/** Detect an adapter's type by matching its `factory()` against known factories. */
export async function getAdapterType(
	cp: ContractProvider,
	adapterAddress: string,
): Promise<AdapterType | undefined> {
	try {
		const factoryAddress = await getAdapterFactoryAddress(cp, adapterAddress);
		const cfg = await cp.getNetworkConfig();
		switch (factoryAddress) {
			case cfg.adapters.erc4626AdapterFactory.toLowerCase():
				return "erc4626";
			case cfg.adapters.erc4626MerklAdapterFactory.toLowerCase():
				return "erc4626Merkl";
			case cfg.adapters.compoundV3AdapterFactory.toLowerCase():
				return "compoundV3";
			case cfg.adapters.morphoMarketV1AdapterFactory.toLowerCase():
				return "morphoMarketV1";
			default:
				throw new Error(`Unknown adapter factory: ${factoryAddress}`);
		}
	} catch (error) {
		throw formatContractError("getAdapterType", error);
	}
}

/** Dispatch the `is<Type>Adapter` check to the per-type module. */
export async function getIsAdapter(
	cp: ContractProvider,
	type: AdapterType,
	adapterAddress: string,
): Promise<boolean> {
	switch (type) {
		case "erc4626":
			return ERC4626.isERC4626Adapter(cp, adapterAddress);
		case "erc4626Merkl":
			return ERC4626Merkl.isERC4626MerklAdapter(cp, adapterAddress);
		case "compoundV3":
			return CompoundV3.isCompoundV3Adapter(cp, adapterAddress);
		case "morphoMarketV1":
			return MorphoMarketV1.isMorphoMarketV1Adapter(cp, adapterAddress);
	}
}
