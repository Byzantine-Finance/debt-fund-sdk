// This file is deprecated. Please use src/constants/networks.ts instead.
// File kept temporarily for backward compatibility.

/**
 * Network utilities for the Byzantine Factory SDK
 */

import { NetworkConfig, ChainsOptions } from "../types";
import {
  getNetworkConfig as getNetworkConfigFromConstants,
  NETWORKS,
} from "../constants/networks";

// Re-export the network configurations from constants/networks.ts
export const NETWORK_CONFIGS = NETWORKS;

/**
 * Get network configuration for a specific chain ID
 * @param chainId The chain ID to get configuration for
 * @returns The network configuration or undefined if not supported
 */
export function getNetworkConfig(chainId: ChainsOptions): NetworkConfig {
  return getNetworkConfigFromConstants(chainId);
}

/**
 * Check if a chain ID is supported
 * @param chainId The chain ID to check
 * @returns True if the chain ID is supported, false otherwise
 */
export function isChainSupported(chainId: ChainsOptions): boolean {
  return !!NETWORK_CONFIGS[chainId];
}
