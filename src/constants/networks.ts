/**
 * Network configurations for Byzantine Deposit contract
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
    byzantineFactoryAddress: "0xAb80CD2CEB6614BBaf1720A9eC546F1BC1f16ecA",
    scanLink: "https://basescan.org",
    USDCaddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
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
  },
};

/**
 * Gets network configuration for the specified chain ID
 * @param chainId - The chain ID to get configuration for
 * @returns Network configuration or undefined if not supported
 */
export function getNetworkConfig(chainId: ChainsOptions): NetworkConfig {
  return NETWORKS[chainId];
}

/**
 * Gets supported chain IDs
 * @returns Array of supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(NETWORKS).map((id) => parseInt(id));
}

/**
 * Check if a chain ID is supported
 * @param chainId The chain ID to check
 * @returns True if the chain ID is supported, false otherwise
 */
export function isChainSupported(chainId: ChainsOptions): boolean {
  return !!NETWORKS[chainId];
}
