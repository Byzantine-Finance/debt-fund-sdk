// @ts-check

export type ChainsOptions =
  // | 1 // Mainnet
  | 8453 // Base Mainnet
  | 42161; // Base Testnet
// | 17000 // Holesky
// | 11155111; // Sepolia
// | 560048; // Hoodi

export interface NetworkConfig {
  name: string;
  vaultV2Factory: string;
  scanLink: string;
  USDCaddress: string;
  adapters: {
    erc4626AdapterFactory: string;
    erc4626MerklAdapterFactory: string;
    compoundV3AdapterFactory: string;
    morphoMarketV1AdapterFactory: string;
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
