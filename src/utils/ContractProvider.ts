/**
 * ContractProvider — small helper that wraps a provider/signer pair and
 * caches the chain ID it's connected to.
 *
 * Used by ByzantineClient and the adapter clients to look up
 * chain-specific addresses without re-querying `eth_chainId` on every call.
 *
 * It does NOT build `ethers.Contract` instances anymore — callers create
 * them directly with `new Contract(addr, abi, provider.runner)`. The
 * thin wrapper is more honest about what it actually does.
 */

import type { ethers } from "ethers";
import { getNetworkConfig } from "../constants/networks";
import type { ChainsOptions, NetworkConfig } from "../types";

export class ContractProvider {
	readonly provider: ethers.Provider;
	signer?: ethers.Signer;
	private chainIdCache?: ChainsOptions;

	constructor(provider: ethers.Provider, signer?: ethers.Signer) {
		this.provider = provider;
		this.signer = signer;
	}

	/** Signer if set, else the read-only provider. */
	get runner(): ethers.ContractRunner {
		return this.signer ?? this.provider;
	}

	/** Detect the chain ID, validate it's supported, and cache the result. */
	async getChainId(): Promise<ChainsOptions> {
		if (this.chainIdCache !== undefined) return this.chainIdCache;
		const network = await this.provider.getNetwork();
		const chainId = Number(network.chainId) as ChainsOptions;
		// Throws if not in NETWORKS.
		getNetworkConfig(chainId);
		this.chainIdCache = chainId;
		return chainId;
	}

	/** Get the full network configuration for the current chain. */
	async getNetworkConfig(): Promise<NetworkConfig> {
		return getNetworkConfig(await this.getChainId());
	}
}
