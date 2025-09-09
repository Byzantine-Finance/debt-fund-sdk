/**
 * Network configurations for Byzantine Factory SDK
 */

import { NetworkConfig, ChainsOptions } from "../types";

export const NETWORKS: Record<ChainsOptions, NetworkConfig> = {
  // Ethereum Mainnet
  // 1: {
  //   name: "Ethereum",
  //   vaultV2Factory: "",
  //   scanLink: "https://etherscan.io",
  // USDCaddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  // },
  // Base mainnet
  8453: {
    name: "Base Mainnet",
    vaultV2Factory: "0x7661DEA044427A2610FFF11C3212e879F5aa54d4",
    scanLink: "https://basescan.org",
    USDCaddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    adapters: {
      compoundV3AdapterFactory: "0x318934C80f2B84073798239A2f1E5143BC2446BF",
      erc4626AdapterFactory: "0x175F0e9FCB2E4a1cE82c636F884A07B2941D3d56",
      erc4626MerklAdapterFactory: "0x8Ff5B5f692215E6d6aED0Ec45d5720cCa137a16B",
      morphoMarketV1AdapterFactory:
        "0x91CA535e5d8de79C9d1379158ef599D4Df2805E3",
    },
  },
  42161: {
    name: "Arbitrum One",
    vaultV2Factory: "0xaD48d29015E1554b9dcbdF804a025f915DC9D1b1",
    scanLink: "https://arbiscan.io",
    USDCaddress: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    adapters: {
      compoundV3AdapterFactory: "0x54273EFafB9A7eF82682CC046c78780d43d28F9b",
      erc4626AdapterFactory: "0x4f10e7A1511ba07B077E3a87698a5bE37fD76983",
      erc4626MerklAdapterFactory: "0xD793545A38b303ca5FfA423Cf8e24671527a18Cb",
      morphoMarketV1AdapterFactory:
        "0x645c7cFA5400e179163DBbb083a246BF344B3c72",
    },
  },
  // Holesky Testnet
  // 17000: {
  //   name: "Holesky",
  //   vaultV2Factory: "",
  //   scanLink: "https://holesky.etherscan.io",
  //   USDCaddress: "",
  // },
  // Ethereum Sepolia
  // 11155111: {
  //   name: "Ethereum Sepolia",
  //   vaultV2Factory: "0xf9332a83747b169f99dc4b247f3f1f7f22863703",
  //   scanLink: "https://sepolia.etherscan.io",
  //   USDCaddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  //   adapters: {
  //     erc4626AdapterFactory: "0x650CDA0043f61E49383dD201b318Ad94f4C3A7A1",
  //     erc4626MerklAdapterFactory: "0x650CDA0043f61E49383dD201b318Ad94f4C3A7A1",
  //     compoundV3AdapterFactory: "0x650CDA0043f61E49383dD201b318Ad94f4C3A7A1",
  //     morphoMarketV1AdapterFactory:
  //       "0xE5B709A14859EdF820347D78E587b1634B0ec771",
  //   },
  // },
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
