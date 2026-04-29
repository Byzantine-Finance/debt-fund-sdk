import type { ethers } from "ethers";
import { ContractProvider } from "../../utils";
import * as CompoundV3 from "./CompoundV3Adapters";
import * as ERC4626 from "./ERC4626Adapters";
import * as ERC4626Merkl from "./ERC4626MerklAdapters";
import * as MorphoMarketV1 from "./MorphoMarketV1Adapters";
import * as Global from "./GlobalAdapters";
import type { DeployAdapterResult } from "./GlobalAdapters";
import { getAdapterContract, getAdapterFactoryContract } from "./_contracts";

export type AdapterType =
	| "erc4626"
	| "erc4626Merkl"
	| "compoundV3"
	| "morphoMarketV1";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TYPES_IN_ORDER: AdapterType[] = [
	"erc4626",
	"erc4626Merkl",
	"compoundV3",
	"morphoMarketV1",
];

/**
 * Factory client — deploys adapters and looks them up by underlying.
 *
 * Owns nothing chain-specific: it delegates to per-type modules and the
 * shared `_contracts` helper.
 */
export class AdaptersFactoryClient {
	private cp: ContractProvider;

	constructor(provider: ethers.Provider, signer?: ethers.Signer) {
		this.cp = new ContractProvider(provider, signer);
	}

	/** Deploy an adapter of the specified type. */
	deployAdapter(
		type: AdapterType,
		parentVault: string,
		underlying: string,
		cometRewards?: string,
	): Promise<DeployAdapterResult> {
		return Global.deployAdapter(this.cp, type, parentVault, underlying, cometRewards);
	}

	/**
	 * Find an existing adapter for `(parentVault, underlying)`.
	 * If `type` is omitted, every supported type is tried in turn and the
	 * first match (non-zero address) is returned.
	 */
	async findAdapter(
		parentVault: string,
		underlying: string,
		options?: { type?: AdapterType; cometRewards?: string },
	): Promise<string> {
		const { type, cometRewards } = options ?? {};

		if (type === "compoundV3") {
			if (!cometRewards) {
				throw new Error("cometRewards is required for compoundV3 lookup");
			}
			return CompoundV3.findCompoundV3Adapter(
				this.cp,
				parentVault,
				underlying,
				cometRewards,
			);
		}
		if (type === "erc4626") {
			return ERC4626.findERC4626Adapter(this.cp, parentVault, underlying);
		}
		if (type === "erc4626Merkl") {
			return ERC4626Merkl.findERC4626MerklAdapter(this.cp, parentVault, underlying);
		}
		if (type === "morphoMarketV1") {
			return MorphoMarketV1.findMorphoMarketV1Adapter(this.cp, parentVault, underlying);
		}

		// Type unspecified — try them all.
		for (const t of TYPES_IN_ORDER) {
			try {
				let found: string;
				if (t === "compoundV3") {
					if (!cometRewards) continue;
					found = await CompoundV3.findCompoundV3Adapter(
						this.cp,
						parentVault,
						underlying,
						cometRewards,
					);
				} else if (t === "erc4626") {
					found = await ERC4626.findERC4626Adapter(this.cp, parentVault, underlying);
				} else if (t === "erc4626Merkl") {
					found = await ERC4626Merkl.findERC4626MerklAdapter(
						this.cp,
						parentVault,
						underlying,
					);
				} else {
					found = await MorphoMarketV1.findMorphoMarketV1Adapter(
						this.cp,
						parentVault,
						underlying,
					);
				}
				if (found && found !== ZERO_ADDRESS) return found;
			} catch {
				/* try next type */
			}
		}
		return ZERO_ADDRESS;
	}

	/** Check whether an account is a registered adapter of the given type. */
	isAdapter(type: AdapterType, account: string): Promise<boolean> {
		return Global.getIsAdapter(this.cp, type, account);
	}

	// ----- factory contract escape hatches (rarely needed) -----
	getERC4626Factory(): Promise<ethers.Contract> {
		return getAdapterFactoryContract(this.cp, "erc4626");
	}
	getERC4626MerklFactory(): Promise<ethers.Contract> {
		return getAdapterFactoryContract(this.cp, "erc4626Merkl");
	}
	getCompoundV3Factory(): Promise<ethers.Contract> {
		return getAdapterFactoryContract(this.cp, "compoundV3");
	}
	getMorphoMarketV1Factory(): Promise<ethers.Contract> {
		return getAdapterFactoryContract(this.cp, "morphoMarketV1");
	}
}

/**
 * Per-adapter introspection client — wraps a single adapter address +
 * type and exposes the relevant reads.
 */
export class AdaptersClient {
	private cp: ContractProvider;

	constructor(provider: ethers.Provider, signer?: ethers.Signer) {
		this.cp = new ContractProvider(provider, signer);
	}

	adapter(adapterAddress: string, type: AdapterType): AdapterInstance {
		return new AdapterInstance(this.cp, adapterAddress, type);
	}

	/**
	 * Generic instance when the type is unknown — used for cross-type reads
	 * like `getAdapterType()` and `getAdapterFactoryAddress()` which only
	 * need a `factory()` getter (selector identical across types).
	 */
	globalAdapter(adapterAddress: string): AdapterInstance {
		return new AdapterInstance(this.cp, adapterAddress, "erc4626");
	}
}

export class AdapterInstance {
	readonly address: string;
	readonly type: AdapterType;
	readonly contract: ethers.Contract;
	private readonly cp: ContractProvider;

	constructor(cp: ContractProvider, address: string, type: AdapterType) {
		this.cp = cp;
		this.address = address;
		this.type = type;
		this.contract = getAdapterContract(cp, address, type);
	}

	// ----- per-type reads -----
	getIdsERC4626(): Promise<string> {
		this.requireType("erc4626");
		return ERC4626.getIds(this.contract);
	}
	getUnderlyingERC4626(): Promise<string> {
		this.requireType("erc4626");
		return ERC4626.getUnderlying(this.contract);
	}

	getIdsERC4626Merkl(): Promise<string> {
		this.requireType("erc4626Merkl");
		return ERC4626Merkl.getIds(this.contract);
	}
	getUnderlyingERC4626Merkl(): Promise<string> {
		this.requireType("erc4626Merkl");
		return ERC4626Merkl.getUnderlying(this.contract);
	}

	getIdsCompoundV3(): Promise<string> {
		this.requireType("compoundV3");
		return CompoundV3.getIds(this.contract);
	}
	getUnderlyingCompoundV3(): Promise<string> {
		this.requireType("compoundV3");
		return CompoundV3.getUnderlying(this.contract);
	}

	getIdsMarketV1(marketParams: MorphoMarketV1.MarketParams): Promise<string[]> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.getIds(this.contract, marketParams);
	}
	getUnderlyingMarketFromAdapterV1(): Promise<string> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.getUnderlying(this.contract);
	}
	getMarketParamsListLength(): Promise<number> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.getMarketParamsListLength(this.contract);
	}
	getMarketParamsList(index: number): Promise<MorphoMarketV1.MarketParams> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.getMarketParamsList(this.contract, index);
	}

	// ----- generic reads (work for any type) -----
	getAdapterFactoryAddress(): Promise<string> {
		return Global.getAdapterFactoryAddress(this.cp, this.address);
	}
	getAdapterType(): Promise<AdapterType | undefined> {
		return Global.getAdapterType(this.cp, this.address);
	}

	private requireType(expected: AdapterType): void {
		if (this.type !== expected) {
			throw new Error(`This call requires a ${expected} adapter, got ${this.type}`);
		}
	}
}
