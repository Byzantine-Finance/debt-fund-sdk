// @ts-check

/**
 * Export all curator related clients and functions
 */

// Export specialized clients
export { CuratorsClient } from "./CuratorsClient";

// Export function modules
export * as AdaptersFunctions from "./Adapters";
export * as TimelockFunctions from "./Timelock";
export * as ManageRoleFunctions from "./ManageRole";
export * as MorphoVaultV1AdaptersFunctions from "../adapters/ERC4626Adapters";
export * as MorphoMarketV1AdaptersFunctions from "../adapters/MorphoMarketV1Adapters";
export * as FeesFunctions from "./Fees";

// Export cap functions
export * as CapFunctions from "./Cap";

// Export gate functions
export * as GateFunctions from "./Gate";

// Export adapter registry functions
export * as AdapterRegistryFunctions from "./AdapterRegistry";

// Export types
export type { TimelockFunction } from "./Timelock";
