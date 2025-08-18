/**
 * Network configurations for Byzantine Factory SDK
 */

import { NetworkConfig, ChainsOptions } from "../types";

export const NETWORKS: Record<ChainsOptions, NetworkConfig> = {
  // Ethereum Mainnet
  // 1: {
  //   name: "Ethereum",
  //   byzantineFactoryAddress: "",
  //   scanLink: "https://etherscan.io",
  // USDCaddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  // },
  // Base mainnet
  8453: {
    name: "Base Mainnet",
    byzantineFactoryAddress: "0x9615550EA8Fa52bdAC83de3FC9A280dBa3D981eE",
    scanLink: "https://basescan.org",
    USDCaddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    adapters: {
      morphoVaultV1AdapterFactory: "0xbA98A4d436e79639A1598aFc988eFB7A828d7F08",
      aaveStataVaultAdapterFactory:
        "0xbA98A4d436e79639A1598aFc988eFB7A828d7F08",
      morphoMarketV1AdapterFactory:
        "0xf21189365131551Ba4c3613252B1bcCdA60BD1e6",
    },
  },
  // Holesky Testnet
  // 17000: {
  //   name: "Holesky",
  //   byzantineFactoryAddress: "",
  //   scanLink: "https://holesky.etherscan.io",
  //   USDCaddress: "",
  // },
  // Ethereum Sepolia
  11155111: {
    name: "Ethereum Sepolia",
    byzantineFactoryAddress: "0xf9332a83747b169f99dc4b247f3f1f7f22863703",
    scanLink: "https://sepolia.etherscan.io",
    USDCaddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    adapters: {
      morphoVaultV1AdapterFactory: "0x650CDA0043f61E49383dD201b318Ad94f4C3A7A1",
      aaveStataVaultAdapterFactory:
        "0xbA98A4d436e79639A1598aFc988eFB7A828d7F08",
      morphoMarketV1AdapterFactory:
        "0xE5B709A14859EdF820347D78E587b1634B0ec771",
    },
  },
};

/**
 * Gets network configuration for the specified chain ID
 * @param chainId - The chain ID to get configuration for
 * @returns Network configuration
 * @throws Error if chain ID is not supported
 */
export function getNetworkConfig(chainId: ChainsOptions): NetworkConfig {
  const config = NETWORKS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return config;
}

/**
 * Gets supported chain IDs
 * @returns Array of supported chain IDs
 */
export function getSupportedChainIds(): ChainsOptions[] {
  return Object.keys(NETWORKS).map((id) => parseInt(id)) as ChainsOptions[];
}

/**
 * Check if a chain ID is supported
 * @param chainId The chain ID to check
 * @returns True if the chain ID is supported, false otherwise
 */
export function isChainSupported(chainId: number): chainId is ChainsOptions {
  return chainId in NETWORKS;
}

/**
 * Convert chain ID to hex format
 * @param chainId The chain ID to convert
 * @returns Hex formatted chain ID
 */
export function toHexChainId(chainId: ChainsOptions): string {
  return `0x${chainId.toString(16)}`;
}

/**
 * Get the explorer URL for a chain
 * @param chainId The chain ID
 * @returns Explorer base URL
 */
export function getExplorerUrl(chainId: ChainsOptions): string {
  return getNetworkConfig(chainId).scanLink;
}

/**
 * Get the explorer URL for an address
 * @param chainId The chain ID
 * @param address The address
 * @returns Full explorer URL for the address
 */
export function getExplorerAddressUrl(
  chainId: ChainsOptions,
  address: string
): string {
  return `${getExplorerUrl(chainId)}/address/${address}`;
}

/**
 * Get the explorer URL for a transaction
 * @param chainId The chain ID
 * @param tx The transaction hash
 * @returns Full explorer URL for the transaction
 */
export function getExplorerTransactionUrl(
  chainId: ChainsOptions,
  tx: string
): string {
  return `${getExplorerUrl(chainId)}/tx/${tx}`;
}
