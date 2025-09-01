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
export * as MorphoVaultV1Adapters from "./ERC4626Adapters";
export * as MorphoMarketV1Adapters from "./MorphoMarketV1Adapters";
export { DeployAdapterResult } from "./GlobalAdapters";

// Export specific functions for convenience
export {
  deployERC4626Adapter,
  isERC4626Adapter,
  findERC4626Adapter,
  getIds as getIdsERC4626,
} from "./ERC4626Adapters";

export {
  deployERC4626MerklAdapter,
  isERC4626MerklAdapter,
  findERC4626MerklAdapter,
  getIds as getIdsVaultV1,
} from "./ERC4626MerklAdapters";

export {
  deployCompoundV3Adapter,
  isCompoundV3Adapter,
  findCompoundV3Adapter,
  getIds as getIdsCompoundV3,
} from "./CompoundV3Adapters";

export {
  deployMorphoMarketV1Adapter,
  isMorphoMarketV1Adapter,
  findMorphoMarketV1Adapter,
  getIds as getIdsMarketV1,
} from "./MorphoMarketV1Adapters";

export {
  deployAdapter,
  getIsAdapter,
  getAdapterType,
  getAdapterFactoryAddress,
} from "./GlobalAdapters";
