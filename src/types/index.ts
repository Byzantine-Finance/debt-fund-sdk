// @ts-check

export type ChainsOptions =
  // | 1 // Mainnet
  | 8453 // Base
  // | 17000 // Holesky
  | 11155111; // Sepolia
// | 560048; // Hoodi

export interface NetworkConfig {
  name: string;
  byzantineFactoryAddress: string;
  scanLink: string;
  USDCaddress: string;
  adapters: {
    morphoVaultV1AdapterFactory: string;
    morphoMarketV1AdapterFactory: string;
    aaveStataVaultAdapterFactory: string;
  };
}

/**
 * Client initialization options
 */
export interface ByzantineClientOptions {
  chainId: ChainsOptions;
  provider?: any; // For ethers provider
  signer?: any; // For ethers signer
}

export type RestakingProtocol =
  | "EigenLayer"
  | "Symbiotic"
  | "SuperVault"
  | "Babylon";

export type RestakingType = "Native" | "ERC20";

export interface Metadata {
  name: string;
  description: string;
  image_url?: string;
  social_twitter?: string;
  social_discord?: string;
  social_telegram?: string;
  social_website?: string;
  social_github?: string;
}

// For the new version of the vaults
export interface BaseParams {
  metadata: Metadata | string; // If string, it's the URI of the metadata

  token_address: string; // Address of the token that people can deposit in the vault, if native 0xEeeeeEeEeEeEeEeEeeEEEeeeeEeeeeeeeEEeE

  is_deposit_limit: boolean;
  deposit_limit: bigint;

  is_private: boolean;

  is_tokenized: boolean;
  token_name: string;
  token_symbol: string;

  curator_fee: number; // Note: This is a uint16 in the ABI (basis points, e.g. 100 = 1%)

  role_manager: string;
  role_version_manager: string;
  role_deposit_limit_manager: string;
  role_deposit_whitelist_manager: string;
  role_curator_fee_claimer: string;
  role_curator_fee_claimer_admin: string;
}

export interface NativeParams {
  byzVaultParams: BaseParams;

  operator_id: string;

  // Added to match the ABI
  solo_staking_fee?: number; // This is a uint16 in the ABI (basis points, e.g. 100 = 1%)

  roles_validator_manager: string[]; // List of addresses who can manage the validator manager, only when solo staker vault
}

// ----------------------------------
// Symbiotic
// ----------------------------------

export enum DelegatorType {
  NETWORK_RESTAKE, // 0
  FULL_RESTAKE, // 1
  OPERATOR_SPECIFIC, // 2
  OPERATOR_NETWORK_SPECIFIC, // 3
}

export enum SlasherType {
  INSTANT, // 0
  VETO, // 1
}

// [role_?][param]_[name]
export interface SymbioticParams {
  vault_version: number; //                           VAULT: Version of the vault, always 1 for now
  vault_epoch_duration: number; //                    VAULT: Duration of the epoch, in seconds, usually 7 days
  slasher_type: SlasherType; //                       SLASHER: Type of the slasher
  slasher_veto_duration: number; //                   SLASHER: Duration of the veto, in seconds, usually 24 hours, can't be equal or greater than epoch duration
  slasher_number_epoch_to_set_delay: number; //       SLASHER: Number of epoch to set the delay, usually 3
  burner_delay_settings_applied: number; //           BURNER: If true, the delay settings are applied, in seconds, usually 21 days, so 1814400 seconds
  burner_global_receiver: string; //                  BURNER: Default receiver of the burner, best practice is to use the ones proposed by Symbiotic for the relevant token
  burner_network_receiver?: { network: string; receiver: string }[]; //               BURNER: Network receivers array
  burner_operator_network_receiver?: {
    network: string;
    operator: string;
    receiver: string;
  }[]; //      BURNER: Operator network receivers array
  delegator_type: DelegatorType; //                   DELEGATOR: Type of the delegator
  delegator_hook: string; //                          DELEGATOR: Address of the hook of the delegator
  delegator_operator: string; //                      DELEGATOR: Address of the operator of the delegator, only for type 2 and 3, set to 0x0 if type 0 or 1
  delegator_network: string; //                       DELEGATOR: Address of the network of the delegator, only for type 2 and 3, set to 0x0 if type 0 or 1

  // role_vault_set_epoch_duration: string; //        VAULT:  Address who can set the duration of the epoch of the vault
  role_delegator_set_hook: string; //                 DELEGATOR: Address who can set the hook of the delegator
  role_delegator_set_network_limit: string[]; //      DELEGATOR: Addresses who can set the network limits of the delegator
  role_delegator_set_operator_network_limit: string[]; // DELEGATOR: Addresses who can set the operator network limits of the delegator
  role_burner_owner_burner: string; //                BURNER: Address of the owner who can change the receivers and the delay settings
}

// export interface NativeSymbioticVault {
//   base: NativeParams;
//   symbiotic: SymbioticParams;
// }

export interface SymbioticVault {
  base: BaseParams;
  symbiotic: SymbioticParams;
}

// ----------------------------------
// Eigenlayer
// ----------------------------------
export interface EigenlayerParams {
  delegation_set_role_holder: string; // Address of the role holder that can set the delegation
  operator: string; // Address of the operator that has the AVS

  approver_signature_and_expiry: {
    signature: string; // "0x" for null
    expiry: number; // 0 for null
  };
  approver_salt: string; // "0x0000000000000000000000000000000000000000000000000000000000000000" for null
}

export interface EigenpodParams {
  eigen_pod_manager: string; // Address of the owner of the eigen pod
}

export interface EigenlayerVault {
  base: BaseParams;
  eigenlayer: EigenlayerParams;
}

export interface NativeEigenlayerVault {
  base: NativeParams;
  eigenlayer: EigenlayerParams;
  eigenpod: EigenpodParams;
}

// ----------------------------------
// SuperVault
// ----------------------------------

export interface SuperVault {
  base: BaseParams;
  symbiotic: SymbioticParams;
  eigenlayer: EigenlayerParams;
  ratio: number; // Proportion of assets to allocate to Symbiotic as a percentage (0-100)
  curator: string; // Address of the curator of the vault
}

// ----------------------------------
