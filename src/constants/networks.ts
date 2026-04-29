/**
 * Network configurations for the Byzantine Debt Fund SDK.
 *
 * Vault V2 protocol addresses (VaultV2Factory, MorphoVaultV1AdapterFactory,
 * MorphoMarketV1AdapterV2Factory, MorphoRegistry) are taken from the official
 * Morpho documentation:
 *   https://docs.morpho.org/get-started/resources/addresses/
 *
 * The ERC4626Merkl and CompoundV3 adapter factories are Byzantine-specific
 * deployments and are not listed in the Morpho docs.
 */

import type { ChainsOptions, NetworkConfig } from "../types";

export const NETWORKS: Record<ChainsOptions, NetworkConfig> = {
	// Ethereum Mainnet
	1: {
		name: "Ethereum",
		// Source: https://docs.morpho.org/get-started/resources/addresses/
		vaultV2Factory: "0xA1D94F746dEfa1928926b84fB2596c06926C0405",
		morphoRegistry: "0x3696c5eAe4a7Ffd04Ea163564571E9CD8Ed9364e",
		scanLink: "https://etherscan.io",
		USDCaddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		adapters: {
			// Source: https://docs.morpho.org/get-started/resources/addresses/
			erc4626AdapterFactory: "0xD1B8E2dee25c2b89DCD2f98448a7ce87d6F63394",
			morphoMarketV1AdapterFactory:
				"0x32BB1c0D48D8b1B3363e86eeB9A0300BAd61ccc1",
			// Byzantine-specific deployments (not in Morpho docs)
			erc4626MerklAdapterFactory: "0x576136011496367C7FEF780445349060646C7cC1",
			compoundV3AdapterFactory: "0x60a91D7F17046FB1B1C9360E1C5D68b7E94E5959",
		},
	},
	// Base Mainnet
	8453: {
		name: "Base Mainnet",
		// Source: https://docs.morpho.org/get-started/resources/addresses/
		vaultV2Factory: "0x4501125508079A99ebBebCE205DeC9593C2b5857",
		morphoRegistry: "0x5C2531Cbd2cf112Cf687da3Cd536708aDd7DB10a",
		scanLink: "https://basescan.org",
		USDCaddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
		adapters: {
			// Source: https://docs.morpho.org/get-started/resources/addresses/
			erc4626AdapterFactory: "0xF42D9c36b34c9c2CF3Bc30eD2a52a90eEB604642",
			morphoMarketV1AdapterFactory:
				"0x9a1B378C43BA535cDB89934230F0D3890c51C0EB",
			// Byzantine-specific deployments (not in Morpho docs)
			erc4626MerklAdapterFactory: "0xdF311B93f922867A686abA9b233Fd7C65d66f83d",
			compoundV3AdapterFactory: "0xA4dF9668EE53A896BdF40A7AeAC1364129F3c168",
		},
	},
};

/** Get network configuration for a chain ID. Throws if unsupported. */
export function getNetworkConfig(chainId: ChainsOptions): NetworkConfig {
	const config = NETWORKS[chainId];
	if (!config) {
		throw new Error(`Unsupported chain ID: ${chainId}`);
	}
	return config;
}

/** All supported chain IDs. */
export function getSupportedChainIds(): ChainsOptions[] {
	return Object.keys(NETWORKS).map((id) => Number.parseInt(id, 10)) as ChainsOptions[];
}

/** Type guard for supported chain IDs. */
export function isChainSupported(chainId: number): chainId is ChainsOptions {
	return chainId in NETWORKS;
}

/** Convert a chain ID to its 0x-prefixed hex form. */
export function toHexChainId(chainId: ChainsOptions): string {
	return `0x${chainId.toString(16)}`;
}

/** Block-explorer base URL for a chain. */
export function getExplorerUrl(chainId: ChainsOptions): string {
	return getNetworkConfig(chainId).scanLink;
}

/** Block-explorer URL for an address on the given chain. */
export function getExplorerAddressUrl(
	chainId: ChainsOptions,
	address: string,
): string {
	return `${getExplorerUrl(chainId)}/address/${address}`;
}

/** Block-explorer URL for a transaction on the given chain. */
export function getExplorerTransactionUrl(
	chainId: ChainsOptions,
	tx: string,
): string {
	return `${getExplorerUrl(chainId)}/tx/${tx}`;
}
