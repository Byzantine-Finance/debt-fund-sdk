/**
 * ByzantineClient — top-level entry point for the SDK.
 *
 * Responsibilities:
 *  - Vault factory: create a vault and obtain a `Vault` instance
 *  - Adapter factory & lookup (delegates to AdaptersFactoryClient)
 *  - Adapter introspection (delegates to AdaptersClient)
 *  - Network / chain helpers
 *
 * For per-vault operations, call `client.vault(address)` to get a `Vault`
 * instance; everything else lives there.
 */

import { Contract, type ethers } from "ethers";
import { VAULT_FACTORY_ABI } from "../constants/abis";
import type { ChainsOptions, NetworkConfig } from "../types";
import { Vault } from "../Vault";
import { ContractProvider, executeContractMethod, formatContractError } from "../utils";
import { AdaptersClient, AdaptersFactoryClient } from "./adapters";
import type {
	AdapterInstance,
	AdapterType,
	DeployAdapterResult,
	MarketParams,
} from "./adapters";

export interface CreateVaultResult extends ethers.ContractTransactionResponse {
	vaultAddress: string;
	/** Vault instance ready to use once the tx is mined. */
	vault: Vault;
}

export class ByzantineClient {
	private provider: ethers.Provider;
	private signer?: ethers.Signer;
	private contractProvider: ContractProvider;
	private adaptersFactoryClient: AdaptersFactoryClient;
	private adaptersClient: AdaptersClient;

	constructor(provider: ethers.Provider, signer?: ethers.Signer) {
		this.provider = provider;
		this.signer = signer;
		this.contractProvider = new ContractProvider(provider, signer);
		this.adaptersFactoryClient = new AdaptersFactoryClient(provider, signer);
		this.adaptersClient = new AdaptersClient(provider, signer);
	}

	// ====================================================================
	// VAULT — factory + instance access
	// ====================================================================

	/**
	 * Get a `Vault` instance for an existing vault address. All vault-specific
	 * operations (reads, writes, multicall) live on this object.
	 */
	vault(vaultAddress: string): Vault {
		return new Vault(vaultAddress, this.signer ?? this.provider);
	}

	/**
	 * Deploy a new vault via the factory. Returns the tx response augmented
	 * with `vaultAddress` and a ready-to-use `vault` instance.
	 *
	 * @example
	 * const { vault, wait } = await client.createVault(owner, asset, salt);
	 * await wait();
	 * await vault.multicall([...]);  // configure in one tx
	 */
	async createVault(
		owner: string,
		asset: string,
		salt: string,
	): Promise<CreateVaultResult> {
		try {
			const factory = await this.getVaultFactoryContract();

			const vaultAddress: string = await factory.createVaultV2.staticCall(
				owner,
				asset,
				salt,
			);

			const tx = await executeContractMethod(
				factory,
				"createVaultV2",
				owner,
				asset,
				salt,
			);

			const result = tx as CreateVaultResult;
			result.vaultAddress = vaultAddress;
			result.vault = this.vault(vaultAddress);
			return result;
		} catch (error) {
			throw formatContractError("createVault", error);
		}
	}

	// ====================================================================
	// ADAPTERS — factory + lookup + introspection
	// ====================================================================

	/**
	 * Deploy an adapter of the specified type.
	 * @param cometRewards required only for `compoundV3` adapters.
	 */
	deployAdapter(
		type: AdapterType,
		parentVault: string,
		underlying: string,
		cometRewards?: string,
	): Promise<DeployAdapterResult> {
		return this.adaptersFactoryClient.deployAdapter(
			type,
			parentVault,
			underlying,
			cometRewards,
		);
	}

	/** Find an existing adapter for (parent, underlying), trying all types if `type` omitted. */
	findAdapter(
		parentVault: string,
		underlying: string,
		options?: { type?: AdapterType; cometRewards?: string },
	): Promise<string> {
		return this.adaptersFactoryClient.findAdapter(parentVault, underlying, options);
	}

	/** Check whether an address is a registered adapter of the given type. */
	isAdapter(type: AdapterType, account: string): Promise<boolean> {
		return this.adaptersFactoryClient.isAdapter(type, account);
	}

	/** Detect an adapter's type by looking up its factory address. */
	getAdapterType(adapterAddress: string): Promise<AdapterType | undefined> {
		return this.adaptersClient.globalAdapter(adapterAddress).getAdapterType();
	}

	/** Get the factory address that deployed a given adapter. */
	getAdapterFactoryAddress(adapterAddress: string): Promise<string> {
		return this.adaptersClient
			.globalAdapter(adapterAddress)
			.getAdapterFactoryAddress();
	}

	// ----- per-type adapter reads -----
	getIdsERC4626(adapterAddress: string): Promise<string[]> {
		return this.adaptersClient.adapter(adapterAddress, "erc4626").getIdsERC4626();
	}
	getIdsERC4626Merkl(adapterAddress: string): Promise<string[]> {
		return this.adaptersClient
			.adapter(adapterAddress, "erc4626Merkl")
			.getIdsERC4626Merkl();
	}
	getIdsCompoundV3(adapterAddress: string): Promise<string[]> {
		return this.adaptersClient
			.adapter(adapterAddress, "compoundV3")
			.getIdsCompoundV3();
	}
	getIdsMarketV1(adapterAddress: string, marketParams: MarketParams): Promise<string[]> {
		return this.adaptersClient
			.adapter(adapterAddress, "morphoMarketV1")
			.getIdsMarketV1(marketParams);
	}

	getUnderlyingERC4626(adapterAddress: string): Promise<string> {
		return this.adaptersClient
			.adapter(adapterAddress, "erc4626")
			.getUnderlyingERC4626();
	}
	getUnderlyingERC4626Merkl(adapterAddress: string): Promise<string> {
		return this.adaptersClient
			.adapter(adapterAddress, "erc4626Merkl")
			.getUnderlyingERC4626Merkl();
	}
	getUnderlyingCompoundV3(adapterAddress: string): Promise<string> {
		return this.adaptersClient
			.adapter(adapterAddress, "compoundV3")
			.getUnderlyingCompoundV3();
	}
	getUnderlyingMarketV1(adapterAddress: string): Promise<string> {
		return this.adaptersClient
			.adapter(adapterAddress, "morphoMarketV1")
			.getUnderlyingMarketFromAdapterV1();
	}

	getMarketIdsLength(adapterAddress: string): Promise<number> {
		return this.adaptersClient
			.adapter(adapterAddress, "morphoMarketV1")
			.getMarketIdsLength();
	}
	getMarketId(adapterAddress: string, index: number): Promise<string> {
		return this.adaptersClient
			.adapter(adapterAddress, "morphoMarketV1")
			.getMarketId(index);
	}

	/**
	 * Get an `AdapterInstance` for an existing adapter. Use this for
	 * adapter-level admin writes (`setSkimRecipient`, `skim`, `claim`,
	 * `submit`/`accept`/`abdicate`, …) that target the adapter contract
	 * directly and therefore cannot be bundled into the parent vault's
	 * multicall.
	 *
	 * @example
	 * const adapter = client.adapter(addr, "compoundV3");
	 * await adapter.claim(swapData);
	 * await adapter.setClaimer(newClaimer);
	 */
	adapter(adapterAddress: string, type: AdapterType): AdapterInstance {
		return this.adaptersClient.adapter(adapterAddress, type);
	}

	// ====================================================================
	// NETWORK
	// ====================================================================

	getNetworkConfig(): Promise<NetworkConfig> {
		return this.contractProvider.getNetworkConfig();
	}
	getChainId(): Promise<ChainsOptions> {
		return this.contractProvider.getChainId();
	}
	async getVaultFactoryContract(): Promise<ethers.Contract> {
		const cfg = await this.contractProvider.getNetworkConfig();
		return new Contract(cfg.vaultV2Factory, VAULT_FACTORY_ABI, this.contractProvider.runner);
	}

	// ====================================================================
	// MISC
	// ====================================================================

	/** Swap signer at runtime. */
	useSigner(signer: ethers.Signer): void {
		this.signer = signer;
		this.contractProvider = new ContractProvider(this.provider, signer);
		this.adaptersFactoryClient = new AdaptersFactoryClient(this.provider, signer);
		this.adaptersClient = new AdaptersClient(this.provider, signer);
	}

	/** Escape hatch for advanced usage. */
	getContractProvider(): ContractProvider {
		return this.contractProvider;
	}
}
