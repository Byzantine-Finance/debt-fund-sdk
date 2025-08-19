/**
 * Export all adapter related clients
 */

// Export specialized clients
export {
  AdaptersClient,
  AdaptersFactoryClient,
  AdapterType,
} from "./AdaptersClient";

// Export adapter functions
export * as MorphoVaultV1Adapters from "./MorphoVaultV1Adapters";
export * as MorphoMarketV1Adapters from "./MorphoMarketV1Adapters";

// Export specific functions for convenience
export {
  deployMorphoVaultV1Adapter,
  isMorphoVaultV1Adapter,
  findMorphoVaultV1Adapter,
  getIds as getIdsVaultV1,
} from "./MorphoVaultV1Adapters";

export {
  deployMorphoMarketV1Adapter,
  isMorphoMarketV1Adapter,
  findMorphoMarketV1Adapter,
  getIds as getIdsMarketV1,
} from "./MorphoMarketV1Adapters";
