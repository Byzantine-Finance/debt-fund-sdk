import * as dotenv from "dotenv";
import { AbiCoder, type ethers, keccak256 } from "ethers";
import type {
	Action,
	AdapterType,
	ByzantineClient,
	MarketParams,
	TimelockFunction,
	Vault,
} from "../../src";
import { formatAmount, formatAnnualRate, formatPercent } from "../../src";

dotenv.config();

export const RPC_URL = process.env.RPC_URL || "";
export const MNEMONIC = process.env.MNEMONIC || "";

/** All timelocked functions on the vault — used by `fullReading` to print durations. */
export const timelocks: TimelockFunction[] = [
	"addAdapter",
	"removeAdapter",
	"decreaseTimelock",
	"increaseAbsoluteCap",
	"increaseRelativeCap",
	"setIsAllocator",
	"setAdapterRegistry",
	"setReceiveSharesGate",
	"setSendSharesGate",
	"setReceiveAssetsGate",
	"setSendAssetsGate",
	"setPerformanceFee",
	"setPerformanceFeeRecipient",
	"setManagementFee",
	"setManagementFeeRecipient",
	"setForceDeallocatePenalty",
];

export const waitDelay = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));
export const waitSecond = () => waitDelay(1000);
export const waitHalfSecond = () => waitDelay(500);

/**
 * Pretty-print each action in a multicall before sending it. Decodes
 * calldata via the vault's `Interface`. For an `instantX` action (a
 * `[submit, execute]` pair) only the execute leg is printed and prefixed
 * with `instant` so the timelock pattern is obvious without doubling the
 * line count.
 */
export function describeActions(
	vault: { contract: ethers.Contract },
	actions: readonly Action[],
): void {
	const iface = vault.contract.interface;
	const fmt = (data: string): string => {
		try {
			const parsed = iface.parseTransaction({ data });
			if (!parsed) return data;
			return `${parsed.name}(${parsed.args.map(String).join(", ")})`;
		} catch {
			return data;
		}
	};

	let i = 1;
	for (const a of actions) {
		if (typeof a === "string") {
			console.log(`   ${i++}. ${fmt(a)}`);
		} else {
			// [submitCalldata, executeCalldata] — log only the execute leg.
			const execute = a[a.length - 1];
			console.log(`   ${i++}. instant ${fmt(execute)}`);
		}
	}
}

export const MAX_UINT256 = (1n << 256n) - 1n;

/** Format an absolute cap, collapsing `type(uint256).max` to `∞` (unlimited). */
export function fmtAbsCap(cap: bigint, decimals = 6): string {
	if (cap >= MAX_UINT256) return "∞";
	return `${formatAmount(cap, decimals, 4)} USDC`;
}

export type MorphoFlavour =
	| "this"
	| "this/marketParams"
	| "collateralToken"
	| "unknown";

/**
 * Label a Morpho V1 vault id by which `idData` flavour produced it.
 *
 * The Morpho V1 adapter's `ids(marketParams)` returns exactly three buckets
 * — `this` (adapter-wide), `collateralToken` (per-collateral, shared across
 * adapters), and `this/marketParams` (per-market under this adapter). We
 * match the first two by recomputing `keccak256(abi.encode(...))` directly;
 * anything else returned by the adapter for a market is, by elimination,
 * the `this/marketParams` bucket.
 */
export function classifyMorphoFlavour(
	id: string,
	adapterAddress: string,
	adapterId: string | undefined,
	marketParams: MarketParams | undefined,
): MorphoFlavour {
	const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
	if (adapterId && eq(id, adapterId)) return "this";
	if (!marketParams) return "unknown";

	const abi = AbiCoder.defaultAbiCoder();
	const idCollateral = keccak256(
		abi.encode(
			["string", "address"],
			["collateralToken", marketParams.collateralToken],
		),
	);
	if (eq(id, idCollateral)) return "collateralToken";

	// By elimination — current Morpho V1 adapter exposes only three flavours.
	void adapterAddress;
	return "this/marketParams";
}

/**
 * Per-id live snapshot pulled from the underlying protocol. All four
 * adapter types contribute the fields they can read on-chain — fields
 * that don't apply (e.g. APY for ERC4626 vaults) are left undefined.
 */
interface IdMarketData {
	/** Total assets supplied in the underlying market (loanToken units). */
	underlyingTotalAssets?: bigint;
	/** Free liquidity available right now in the underlying market. */
	underlyingLiquidity?: bigint;
	/** 1e18-scaled utilization (totalBorrow/totalSupply). */
	utilization?: bigint;
	/** Per-second supply rate in WAD. Annualize via `formatAnnualRate`. */
	supplyRatePerSec?: bigint;
}

interface IdCapEntry {
	/** Vault-side id (the bytes32 the vault uses for caps + allocation). */
	id: string;
	absoluteCap: bigint;
	relativeCap: bigint;
	allocation: bigint;
	/**
	 * Morpho V1 only — the raw `bytes32` market id this entry was derived
	 * from. Multiple vault ids can share one raw market (e.g. one bucket
	 * per `idData` flavour: `this/marketParams`, `collateralToken`, …).
	 */
	rawMarketId?: string;
	/** Morpho V1 only — the marketParams of `rawMarketId`. */
	marketParams?: MarketParams;
	marketData?: IdMarketData;
}

interface AdapterSnapshot {
	index: number;
	address: string;
	adapterType: AdapterType | undefined;
	adapterId: string | undefined;
	underlying: string;
	forceDeallocatePenalty: bigint;
	idsWithCaps: IdCapEntry[];
}

export interface FullReadingVault {
	sharesName: string;
	sharesSymbol: string;
	asset: string;
	totalAssets: bigint;
	totalSupply: bigint;
	virtualShares: bigint;
	owner: string;
	curator: string;
	isSentinel: boolean;
	isAllocator: boolean;
	performanceFee: bigint;
	managementFee: bigint;
	performanceFeeRecipient: string;
	managementFeeRecipient: string;
	maxRate: bigint;
	adapterRegistry: string;
	receiveSharesGate: string;
	sendSharesGate: string;
	receiveAssetsGate: string;
	sendAssetsGate: string;
	adapters: AdapterSnapshot[];
	idleBalance: bigint;
	liquidityAdapter: string;
	liquidityData: string;
	timelocks: { name: TimelockFunction; timelock: bigint }[];
}

/**
 * Build the list of cap-bearing entries for an adapter. The `id` field on
 * each entry is the **vault-side** id (used by `vault.absoluteCap(id)` etc.).
 *
 * - For single-id adapter types (erc4626, erc4626Merkl, compoundV3) the
 *   adapter's `ids()` returns the vault id directly — one entry per id.
 * - For Morpho V1 markets, the adapter stores raw Morpho market ids in
 *   `marketIds[]`, but caps/allocations are tracked under the vault ids
 *   returned by `adapter.ids(marketParams)` (typically several buckets
 *   per market). We resolve the marketParams via Morpho's
 *   `idToMarketParams` and emit one entry per vault id, all sharing the
 *   same `rawMarketId` and `marketData`.
 */
async function buildIdEntries(
	client: ByzantineClient,
	vault: Vault,
	adapterAddress: string,
	type: AdapterType | undefined,
): Promise<IdCapEntry[]> {
	const fetchCaps = async (id: string) => ({
		absoluteCap: await vault.absoluteCap(id).catch(() => 0n),
		relativeCap: await vault.relativeCap(id).catch(() => 0n),
		allocation: await vault.allocation(id).catch(() => 0n),
	});

	switch (type) {
		case "erc4626":
		case "erc4626Merkl":
		case "compoundV3": {
			const ids =
				type === "erc4626"
					? await client.getIdsERC4626(adapterAddress)
					: type === "erc4626Merkl"
						? await client.getIdsERC4626Merkl(adapterAddress)
						: await client.getIdsCompoundV3(adapterAddress);
			return Promise.all(
				ids.map(async (id) => ({
					id,
					...(await fetchCaps(id)),
					marketData: await readIdMarketData(
						client,
						adapterAddress,
						type,
						id,
					),
				})),
			);
		}
		case "morphoMarketV1": {
			const len = Number(await client.getMarketIdsLength(adapterAddress));
			const perMarket = await Promise.all(
				Array.from({ length: len }, async (_, i) => {
					const rawMarketId = await client.getMarketId(adapterAddress, i);
					const state = await client
						.getMarketState(adapterAddress, rawMarketId)
						.catch(() => undefined);
					if (!state) return [] as IdCapEntry[];

					const marketData: IdMarketData = {
						underlyingTotalAssets: state.totalSupplyAssets,
						underlyingLiquidity: state.liquidity,
						utilization: state.utilization,
						supplyRatePerSec: state.supplyRatePerSec,
					};

					const vaultIds = await client
						.getIdsMarketV1(adapterAddress, state.marketParams)
						.catch(() => [] as string[]);

					return Promise.all(
						vaultIds.map(async (id) => ({
							id,
							rawMarketId,
							marketParams: state.marketParams,
							marketData,
							...(await fetchCaps(id)),
						})),
					);
				}),
			);
			return perMarket.flat();
		}
		default:
			return [];
	}
}

/** Pull the underlying market/vault address for the given adapter. */
async function readAdapterUnderlying(
	client: ByzantineClient,
	address: string,
	type: AdapterType | undefined,
): Promise<string> {
	switch (type) {
		case "erc4626":
			return client.getUnderlyingERC4626(address);
		case "erc4626Merkl":
			return client.getUnderlyingERC4626Merkl(address);
		case "compoundV3":
			return client.getUnderlyingCompoundV3(address);
		case "morphoMarketV1":
			return client.getUnderlyingMarketV1(address);
		default:
			return "unknown";
	}
}

/**
 * Pull live state for a single (adapter, id) pair from the underlying protocol.
 * Returns `undefined` for fields that don't apply to the adapter type
 * (ERC4626/Merkl have no on-chain APY, etc.) or when the read fails.
 */
async function readIdMarketData(
	client: ByzantineClient,
	adapterAddress: string,
	type: AdapterType | undefined,
	id: string,
): Promise<IdMarketData | undefined> {
	try {
		switch (type) {
			case "morphoMarketV1": {
				const s = await client.getMarketState(adapterAddress, id);
				return {
					underlyingTotalAssets: s.totalSupplyAssets,
					underlyingLiquidity: s.liquidity,
					utilization: s.utilization,
					supplyRatePerSec: s.supplyRatePerSec,
				};
			}
			case "compoundV3": {
				const s = await client.getCometState(adapterAddress);
				return {
					underlyingTotalAssets: s.totalSupply,
					underlyingLiquidity: s.liquidity,
					utilization: s.utilization,
					supplyRatePerSec: s.supplyRatePerSec,
				};
			}
			case "erc4626": {
				const s = await client.getVaultStateERC4626(adapterAddress);
				return {
					underlyingTotalAssets: s.totalAssets,
					underlyingLiquidity: s.maxWithdraw,
				};
			}
			case "erc4626Merkl": {
				const s = await client.getVaultStateERC4626Merkl(adapterAddress);
				return {
					underlyingTotalAssets: s.totalAssets,
					underlyingLiquidity: s.maxWithdraw,
				};
			}
			default:
				return undefined;
		}
	} catch {
		return undefined;
	}
}

/**
 * Print the full state of a vault to the console and return it as a struct.
 * Useful in examples / debugging — not meant for production code paths.
 */
export async function fullReading(
	client: ByzantineClient,
	vault: Vault,
	userAddress: string,
): Promise<FullReadingVault> {
	await waitHalfSecond();
	console.log("\n*********************************************************");
	console.log(`*   Vault: ${vault.address}`);
	console.log("*********************************************************");

	const snapshot: FullReadingVault = {
		sharesName: await vault.name(),
		sharesSymbol: await vault.symbol(),
		asset: await vault.asset(),
		totalAssets: await vault.totalAssets(),
		totalSupply: await vault.totalSupply(),
		virtualShares: await vault.virtualShares(),
		owner: await vault.owner(),
		curator: await vault.curator(),
		isSentinel: await vault.isSentinel(userAddress),
		isAllocator: await vault.isAllocator(userAddress),
		performanceFee: await vault.performanceFee(),
		managementFee: await vault.managementFee(),
		performanceFeeRecipient: await vault.performanceFeeRecipient(),
		managementFeeRecipient: await vault.managementFeeRecipient(),
		maxRate: await vault.maxRate(),
		adapterRegistry: await vault.adapterRegistry(),
		receiveSharesGate: await vault.receiveSharesGate(),
		sendSharesGate: await vault.sendSharesGate(),
		receiveAssetsGate: await vault.receiveAssetsGate(),
		sendAssetsGate: await vault.sendAssetsGate(),
		idleBalance: await vault.idleBalance(),
		liquidityAdapter: await vault.liquidityAdapter(),
		liquidityData: await vault.liquidityData(),
		adapters: [],
		timelocks: [],
	};

	const adaptersLength = Number(await vault.adaptersLength());
	snapshot.adapters = await Promise.all(
		Array.from({ length: adaptersLength }, async (_, index) => {
			const address = await vault.adapter(index);
			const forceDeallocatePenalty =
				await vault.forceDeallocatePenalty(address);

			let adapterType: AdapterType | undefined;
			try {
				adapterType = await client.getAdapterType(address);
			} catch (err) {
				console.log(`  ! Could not detect type for ${address}: ${err}`);
			}

			const underlying = await readAdapterUnderlying(
				client,
				address,
				adapterType,
			);

			const adapterId = adapterType
				? await client
						.getAdapterId(address, adapterType)
						.catch(() => undefined)
				: undefined;

			const idsWithCaps = await buildIdEntries(
				client,
				vault,
				address,
				adapterType,
			);

			return {
				index,
				address,
				adapterType,
				adapterId,
				underlying,
				forceDeallocatePenalty,
				idsWithCaps,
			};
		}),
	);

	snapshot.timelocks = await Promise.all(
		timelocks.map(async (name) => ({
			name,
			timelock: await vault.timelock(name),
		})),
	);

	// ----- pretty-print -----
	console.log(`* Asset:           ${snapshot.asset}`);
	console.log(`* Name:            ${snapshot.sharesName}`);
	console.log(`* Symbol:          ${snapshot.sharesSymbol}`);
	console.log(
		`* Total Assets:    ${snapshot.totalAssets} (${formatAmount(snapshot.totalAssets, 6, 4)} USDC)`,
	);
	console.log(
		`* Total Supply:    ${snapshot.totalSupply} (${formatAmount(snapshot.totalSupply, 18, 4)} shares)`,
	);
	console.log(`* Virtual Shares:  ${snapshot.virtualShares}`);
	console.log(`*`);
	console.log(`* User:            ${userAddress} ✅`);
	console.log(
		`* Owner:           ${snapshot.owner} ${snapshot.owner === userAddress ? "✅" : "❌"}`,
	);
	console.log(
		`* Curator:         ${snapshot.curator} ${snapshot.curator === userAddress ? "✅" : "❌"}`,
	);
	console.log(`* Is Sentinel:     ${snapshot.isSentinel}`);
	console.log(`* Is Allocator:    ${snapshot.isAllocator}`);
	console.log(`*`);
	console.log(`* Performance Fee: ${formatPercent(snapshot.performanceFee)} %`);
	console.log(
		`* Management Fee:  ${formatAnnualRate(snapshot.managementFee)} %/year (raw ${snapshot.managementFee})`,
	);
	console.log(`* Perf. Recipient: ${snapshot.performanceFeeRecipient}`);
	console.log(`* Mgmt. Recipient: ${snapshot.managementFeeRecipient}`);
	console.log(
		`* Max Rate:        ${formatAnnualRate(snapshot.maxRate)} %/year`,
	);
	console.log(`* Adapter Registry: ${snapshot.adapterRegistry}`);
	console.log(`*`);
	console.log(`* Receive Shares Gate: ${snapshot.receiveSharesGate}`);
	console.log(`* Send Shares Gate:    ${snapshot.sendSharesGate}`);
	console.log(`* Receive Assets Gate: ${snapshot.receiveAssetsGate}`);
	console.log(`* Send Assets Gate:    ${snapshot.sendAssetsGate}`);
	console.log(`*`);
	console.log(`* Adapters (${snapshot.adapters.length}):`);
	for (const a of snapshot.adapters) {
		const penalty =
			a.forceDeallocatePenalty === 0n
				? "0%"
				: `${formatPercent(a.forceDeallocatePenalty)}%`;
		const isLiquidity = a.address === snapshot.liquidityAdapter;
		console.log(
			`*   [${a.index}] ${a.address} (${a.adapterType} → ${a.underlying}) | penalty: ${penalty}${
				isLiquidity ? "  💦 (liquidity adapter)" : ""
			}`,
		);
		if (a.adapterId) {
			console.log(`*       adapterId: ${a.adapterId}`);
		}
		if (a.idsWithCaps.length === 0) {
			console.log(`*       no IDs found`);
			continue;
		}

		const printMarketData = (md: IdMarketData | undefined): void => {
			if (!md) return;
			const parts: string[] = [];
			if (md.underlyingTotalAssets !== undefined) {
				parts.push(`undTVL ${formatAmount(md.underlyingTotalAssets, 6, 2)}`);
			}
			if (md.underlyingLiquidity !== undefined) {
				parts.push(`undLiq ${formatAmount(md.underlyingLiquidity, 6, 2)}`);
			}
			if (md.utilization !== undefined) {
				parts.push(`util ${formatPercent(md.utilization)}%`);
			}
			if (md.supplyRatePerSec !== undefined) {
				parts.push(`supplyAPY ${formatAnnualRate(md.supplyRatePerSec)}%/y`);
			}
			if (parts.length > 0) {
				console.log(`*           ${parts.join(" | ")}`);
			}
		};
		const printCapLine = (
			c: IdCapEntry,
			label: string | undefined,
		): void => {
			const lbl = label ? ` (${label})` : "";
			console.log(
				`*       ID ${c.id}${lbl}: relCap ${formatPercent(c.relativeCap)}% | absCap ${fmtAbsCap(c.absoluteCap)} | alloc ${formatAmount(c.allocation, 6, 4)}`,
			);
		};

		// Pull out the adapter-wide ("this") entry — it appears once per
		// market for Morpho V1 (same id across markets), so we dedupe and
		// print it once at the top.
		const isThis = (c: IdCapEntry) =>
			a.adapterId !== undefined &&
			c.id.toLowerCase() === a.adapterId.toLowerCase();
		const adapterWide = a.idsWithCaps.find(isThis);
		const perMarket = a.idsWithCaps.filter((c) => !isThis(c));

		if (adapterWide) {
			printCapLine(adapterWide, "adapter-wide");
		}

		let lastRawMarketId: string | undefined;
		for (const c of perMarket) {
			if (c.rawMarketId && c.rawMarketId !== lastRawMarketId) {
				console.log(`*       Market ${c.rawMarketId}`);
				lastRawMarketId = c.rawMarketId;
			}
			const flavour =
				a.adapterType === "morphoMarketV1"
					? classifyMorphoFlavour(
							c.id,
							a.address,
							a.adapterId,
							c.marketParams,
						)
					: undefined;
			const label =
				flavour === "this/marketParams"
					? "per-market"
					: flavour === "collateralToken"
						? "collateral"
						: undefined;
			printCapLine(c, label);
			printMarketData(c.marketData);
		}
	}
	console.log(`*`);
	console.log(`* Liquidity Adapter: ${snapshot.liquidityAdapter}`);
	console.log(`* Liquidity Data:    ${snapshot.liquidityData}`);
	console.log(
		`* Idle Balance:      ${snapshot.idleBalance} (${formatAmount(snapshot.idleBalance, 6, 4)} USDC)`,
	);
	console.log(`*`);
	for (const t of snapshot.timelocks) {
		if (t.timelock > 0n) console.log(`* Timelock ${t.name}: ${t.timelock}s`);
	}
	console.log("*********************************************************\n");

	return snapshot;
}
