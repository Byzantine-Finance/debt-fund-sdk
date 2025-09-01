// Import ABIs using require to avoid TypeScript import issues
const VAULT_FACTORY_ABI = require("./VaultFactory.json");
const VAULT_ABI = require("./Vault.json");
const MorphoVaultV1AdapterFactoryABI = require("./MorphoVaultV1AdapterFactory.json");
const MorphoVaultV1AdapterABI = require("./MorphoVaultV1Adapter.json");
const MorphoMarketV1AdapterFactoryABI = require("./MorphoMarketV1AdapterFactory.json");
const MorphoMarketV1AdapterABI = require("./MorphoMarketV1Adapter.json");
const ERC4626MerklAdapterFactoryABI = require("./ERC4626MerklAdapterFactory.json");
const ERC4626MerklAdapterABI = require("./ERC4626MerklAdapter.json");
const CompoundV3AdapterFactoryABI = require("./CompoundV3AdapterFactory.json");
const CompoundV3AdapterABI = require("./CompoundV3Adapter.json");

export {
  VAULT_FACTORY_ABI,
  VAULT_ABI,
  MorphoVaultV1AdapterFactoryABI,
  MorphoVaultV1AdapterABI,
  MorphoMarketV1AdapterFactoryABI,
  MorphoMarketV1AdapterABI,
  ERC4626MerklAdapterFactoryABI,
  ERC4626MerklAdapterABI,
  CompoundV3AdapterFactoryABI,
  CompoundV3AdapterABI,
};
