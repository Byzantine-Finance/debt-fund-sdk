/**
 * Byzantine SDK - Main export file
 */

// Export main clients
export { ByzantineClient } from "./clients/ByzantineClient";

// Export specialized clients
export { OwnersClient, VaultOwner, createVault } from "./clients/owners";
export { AllocatorsClient } from "./clients/allocators";
export { CuratorsClient } from "./clients/curators";
export { DepositorsClient } from "./clients/depositors";

// Export adapters
export { AdaptersClient } from "./clients/adapters";

// Export types
export * from "./types";

// Export constants and utilities
export * from "./constants";
