export type ChainsOptions = 1 | 8453;

export interface NetworkConfig {
	name: string;
	vaultV2Factory: string;
	morphoRegistry: string;
	scanLink: string;
	USDCaddress: string;
	adapters: {
		erc4626AdapterFactory: string;
		erc4626MerklAdapterFactory: string;
		compoundV3AdapterFactory: string;
		morphoMarketV1AdapterFactory: string;
	};
}

export interface ByzantineClientOptions {
	chainId: ChainsOptions;
	provider?: unknown;
	signer?: unknown;
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
