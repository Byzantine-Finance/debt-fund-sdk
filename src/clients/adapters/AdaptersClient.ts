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
			// V2 factory: `underlying` is unused — there is exactly one
			// MorphoMarketV1 adapter per parentVault per chain.
			return MorphoMarketV1.findMorphoMarketV1Adapter(this.cp, parentVault);
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
	getIdsERC4626(): Promise<string[]> {
		this.requireType("erc4626");
		return ERC4626.getIds(this.contract);
	}
	getUnderlyingERC4626(): Promise<string> {
		this.requireType("erc4626");
		return ERC4626.getUnderlying(this.contract);
	}

	getIdsERC4626Merkl(): Promise<string[]> {
		this.requireType("erc4626Merkl");
		return ERC4626Merkl.getIds(this.contract);
	}
	getUnderlyingERC4626Merkl(): Promise<string> {
		this.requireType("erc4626Merkl");
		return ERC4626Merkl.getUnderlying(this.contract);
	}

	getIdsCompoundV3(): Promise<string[]> {
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
	getMarketIdsLength(): Promise<number> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.getMarketIdsLength(this.contract);
	}
	getMarketId(index: number): Promise<string> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.getMarketId(this.contract, index);
	}

	// ----- generic reads (work for any type) -----
	getAdapterFactoryAddress(): Promise<string> {
		return Global.getAdapterFactoryAddress(this.cp, this.address);
	}
	getAdapterType(): Promise<AdapterType | undefined> {
		return Global.getAdapterType(this.cp, this.address);
	}

	// ----- skim surface (every adapter type) -----
	getSkimRecipient(): Promise<string> {
		switch (this.type) {
			case "erc4626":
				return ERC4626.getSkimRecipient(this.contract);
			case "erc4626Merkl":
				return ERC4626Merkl.getSkimRecipient(this.contract);
			case "compoundV3":
				return CompoundV3.getSkimRecipient(this.contract);
			case "morphoMarketV1":
				return MorphoMarketV1.getSkimRecipient(this.contract);
		}
	}

	setSkimRecipient(newSkimRecipient: string): Promise<ethers.TransactionResponse> {
		switch (this.type) {
			case "erc4626":
				return ERC4626.setSkimRecipient(this.contract, newSkimRecipient);
			case "erc4626Merkl":
				return ERC4626Merkl.setSkimRecipient(this.contract, newSkimRecipient);
			case "compoundV3":
				return CompoundV3.setSkimRecipient(this.contract, newSkimRecipient);
			case "morphoMarketV1":
				return MorphoMarketV1.setSkimRecipient(this.contract, newSkimRecipient);
		}
	}

	skim(token: string): Promise<ethers.TransactionResponse> {
		switch (this.type) {
			case "erc4626":
				return ERC4626.skim(this.contract, token);
			case "erc4626Merkl":
				return ERC4626Merkl.skim(this.contract, token);
			case "compoundV3":
				return CompoundV3.skim(this.contract, token);
			case "morphoMarketV1":
				return MorphoMarketV1.skim(this.contract, token);
		}
	}

	// ----- compoundV3 / erc4626Merkl: rewards surface -----
	getClaimer(): Promise<string> {
		if (this.type === "compoundV3") return CompoundV3.getClaimer(this.contract);
		if (this.type === "erc4626Merkl") return ERC4626Merkl.getClaimer(this.contract);
		throw new Error(`getClaimer not supported on ${this.type}`);
	}
	setClaimer(newClaimer: string): Promise<ethers.TransactionResponse> {
		if (this.type === "compoundV3")
			return CompoundV3.setClaimer(this.contract, newClaimer);
		if (this.type === "erc4626Merkl")
			return ERC4626Merkl.setClaimer(this.contract, newClaimer);
		throw new Error(`setClaimer not supported on ${this.type}`);
	}
	claim(data: string): Promise<ethers.TransactionResponse> {
		if (this.type === "compoundV3") return CompoundV3.claim(this.contract, data);
		if (this.type === "erc4626Merkl") return ERC4626Merkl.claim(this.contract, data);
		throw new Error(`claim not supported on ${this.type}`);
	}

	// ----- compoundV3-only -----
	getCometRewards(): Promise<string> {
		this.requireType("compoundV3");
		return CompoundV3.getCometRewards(this.contract);
	}

	// ----- erc4626Merkl-only -----
	getMerklDistributor(): Promise<string> {
		this.requireType("erc4626Merkl");
		return ERC4626Merkl.getMerklDistributor(this.contract);
	}

	// ----- morphoMarketV1 V2 timelock + abdicate surface -----
	getTimelock(selector: string): Promise<bigint> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.getTimelock(this.contract, selector);
	}
	getAbdicated(selector: string): Promise<boolean> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.getAbdicated(this.contract, selector);
	}
	getExecutableAt(data: string): Promise<bigint> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.getExecutableAt(this.contract, data);
	}
	submit(data: string): Promise<ethers.TransactionResponse> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.submit(this.contract, data);
	}
	revoke(data: string): Promise<ethers.TransactionResponse> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.revoke(this.contract, data);
	}
	abdicate(selector: string): Promise<ethers.TransactionResponse> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.abdicate(this.contract, selector);
	}
	increaseTimelock(
		selector: string,
		newDuration: bigint,
	): Promise<ethers.TransactionResponse> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.increaseTimelock(this.contract, selector, newDuration);
	}
	decreaseTimelock(
		selector: string,
		newDuration: bigint,
	): Promise<ethers.TransactionResponse> {
		this.requireType("morphoMarketV1");
		return MorphoMarketV1.decreaseTimelock(this.contract, selector, newDuration);
	}

	private requireType(expected: AdapterType): void {
		if (this.type !== expected) {
			throw new Error(`This call requires a ${expected} adapter, got ${this.type}`);
		}
	}
}
