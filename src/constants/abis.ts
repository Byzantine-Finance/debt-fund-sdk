// Import ABIs using require to avoid TypeScript import issues
const VAULT_FACTORY_ABI = require("./VaultFactory.json");
const VAULT_ABI = require("./Vault.json");
const MorphoV1AdapterFactoryABI = require("./MorphoVaultV1AdapterFactory.json");
const MorphoVaultV1AdapterABI = require("./MorphoVaultV1Adapter.json");
const MorphoMarketV1AdapterFactoryABI = require("./MorphoMarketV1AdapterFactory.json");
const MorphoMarketV1AdapterABI = require("./MorphoMarketV1Adapter.json");

export {
  VAULT_FACTORY_ABI,
  VAULT_ABI,
  MorphoV1AdapterFactoryABI,
  MorphoVaultV1AdapterABI,
  MorphoMarketV1AdapterFactoryABI,
  MorphoMarketV1AdapterABI,
};
