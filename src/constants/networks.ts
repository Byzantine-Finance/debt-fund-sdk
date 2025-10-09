/**
 * Network configurations for Byzantine Factory SDK
 */

import { NetworkConfig, ChainsOptions } from "../types";

export const NETWORKS: Record<ChainsOptions, NetworkConfig> = {
  // Ethereum Mainnet
  1: {
    name: "Ethereum",
    vaultV2Factory: "",
    scanLink: "https://etherscan.io",
    USDCaddress: "0xA1D94F746dEfa1928926b84fB2596c06926C0405",
    adapters: {
      compoundV3AdapterFactory: "0x60a91D7F17046FB1B1C9360E1C5D68b7E94E5959",
      erc4626AdapterFactory: "0xD1B8E2dee25c2b89DCD2f98448a7ce87d6F63394",
      erc4626MerklAdapterFactory: "0x576136011496367C7FEF780445349060646C7cC1",
      morphoMarketV1AdapterFactory: "",
    },
  },
  // Base mainnet
  8453: {
    name: "Base Mainnet",
    vaultV2Factory: "0x4501125508079A99ebBebCE205DeC9593C2b5857",
    scanLink: "https://basescan.org",
    USDCaddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    adapters: {
      compoundV3AdapterFactory: "0xA4dF9668EE53A896BdF40A7AeAC1364129F3c168",
      erc4626AdapterFactory: "0x0f52A6D95d1C29806696FfaC4EB9F563e90faB9B",
      erc4626MerklAdapterFactory: "0xdF311B93f922867A686abA9b233Fd7C65d66f83d",
      morphoMarketV1AdapterFactory:
        "0x96E2F9E6077C9B8FcA5Bb0F31F7A977ffC047F6E",
    },
  },
  // 42161: {
  //   name: "Arbitrum One",
  //   vaultV2Factory: "0xaD48d29015E1554b9dcbdF804a025f915DC9D1b1",
  //   scanLink: "https://arbiscan.io",
  //   USDCaddress: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  //   adapters: {
  //     compoundV3AdapterFactory: "0x54273EFafB9A7eF82682CC046c78780d43d28F9b",
  //     erc4626AdapterFactory: "0x4f10e7A1511ba07B077E3a87698a5bE37fD76983",
  //     erc4626MerklAdapterFactory: "0xD793545A38b303ca5FfA423Cf8e24671527a18Cb",
  //     morphoMarketV1AdapterFactory:
  //       "0x645c7cFA5400e179163DBbb083a246BF344B3c72",
  //   },
  // },
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
