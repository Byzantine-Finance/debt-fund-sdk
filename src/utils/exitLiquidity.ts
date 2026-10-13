import { AbiCoder, Contract, type ContractRunner, keccak256 } from "ethers";

/**
 * What a VaultV2 can pay out, mirroring `VaultV2.exit()`:
 *
 *  - `idle`: the asset the vault holds, paid first;
 *  - `liquidityAdapter`: what the liquidity adapter pulls back during the
 *    withdrawal itself (its position, within what the venue below can pay);
 *  - `deallocatable`: the vault's OTHER positions, reachable by a
 *    `forceDeallocate` first (for the vault's penalty);
 *  - `instant` = idle + liquidityAdapter: one transaction, no penalty;
 *  - `reachable` = instant + deallocatable.
 *
 * A venue that is itself a VaultV2 is followed down its own liquidity
 * adapter (a VaultV2 answers 0 to `maxWithdraw` by design). All amounts are
 * in the vault asset's base units. Reads only: no signer needed.
 */
export interface ExitLiquidity {
	asset: string;
	idle: bigint;
	liquidityAdapter: bigint;
	instant: bigint;
	deallocatable: bigint;
	reachable: bigint;
	/** Every position behind `deallocatable`, to apply the per-adapter
	 *  penalty (`vault.forceDeallocatePenalty(adapter)`) or build the
	 *  `forceDeallocate` calls. */
	sources: ExitSource[];
}

export interface ExitSource {
	adapter: string;
	/** The venue the adapter supplies into: a Morpho market id, or the
	 *  address of the vault / pool / Comet below. */
	venue: string;
	kind: "morphoMarket" | "vault" | "aave" | "compoundV3";
	/** The `forceDeallocate` data: the market's encoded params, or `0x`. */
	data: string;
	/** The most a force-deallocate can pull from this position. */
	amount: bigint;
}

export interface ExitLiquidityOptions {
	/** How many VaultV2s deep a venue is followed (default 5). Past it a
	 *  VaultV2 venue counts for its idle only, never more than it holds. */
	maxDepth?: number;
}

export const DEFAULT_EXIT_DEPTH = 5;

const ABI = [
	"function asset() view returns (address)",
	"function balanceOf(address) view returns (uint256)",
	"function maxWithdraw(address) view returns (uint256)",
	"function liquidityAdapter() view returns (address)",
	"function liquidityData() view returns (bytes)",
	"function adaptersLength() view returns (uint256)",
	"function adapters(uint256) view returns (address)",
	"function realAssets() view returns (uint256)",
	"function morpho() view returns (address)",
	"function marketIdsLength() view returns (uint256)",
	"function marketIds(uint256) view returns (bytes32)",
	"function expectedSupplyAssets(bytes32) view returns (uint256)",
	"function idToMarketParams(bytes32) view returns (address,address,address,address,uint256)",
	"function market(bytes32) view returns (uint128,uint128,uint128,uint128,uint128,uint128)",
	"function isAllocator(address) view returns (bool)",
	"function flowCaps(address, bytes32) view returns (uint128, uint128)",
	"function fee(address) view returns (uint256)",
	"function position(bytes32, address) view returns (uint256, uint128, uint128)",
	"function withdrawQueueLength() view returns (uint256)",
	"function withdrawQueue(uint256) view returns (bytes32)",
	"function config(bytes32) view returns (uint184, bool, uint64)",
	"function aToken() view returns (address)",
	"function comet() view returns (address)",
	"function erc4626Vault() view returns (address)",
	"function morphoVaultV1() view returns (address)",
] as const;

/** One read; resolves `undefined` when the call reverts. */
export type ReadFn = (
	address: string,
	fn: string,
	args?: unknown[],
) => Promise<unknown>;

const ZERO = 0n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MARKET_PARAMS = ["tuple(address,address,address,address,uint256)"];
const min = (a: bigint, b: bigint) => (a < b ? a : b);
const isSet = (a: unknown): a is string =>
	typeof a === "string" && a.toLowerCase() !== ZERO_ADDRESS;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The reads of an ethers runner, reverts swallowed. */
export function readerFor(runner: ContractRunner): ReadFn {
	return async (address, fn, args = []) => {
		try {
			return await new Contract(address, ABI, runner).getFunction(fn)(
				...args,
			);
		} catch {
			return undefined;
		}
	};
}

/** `liquidityData` names a Morpho market when it is abi-encoded
 *  MarketParams; its id is the hash of that encoding. */
function marketIdOf(data: string): string | undefined {
	try {
		const coder = AbiCoder.defaultAbiCoder();
		return keccak256(coder.encode(MARKET_PARAMS, coder.decode(MARKET_PARAMS, data)));
	} catch {
		return undefined;
	}
}

/** The free cash of a Morpho market: supplied minus borrowed. */
async function marketCash(read: ReadFn, morpho: string, id: string) {
	const m = (await read(morpho, "market", [id])) as readonly bigint[] | undefined;
	return m ? m[0] - m[2] : undefined;
}

/**
 * What `holder` can withdraw from `target` in one transaction, capped by its
 * `position`. A VaultV2 target is followed down (see the file header); any
 * other one answers `maxWithdraw`, falling back to the asset it holds (a
 * Comet's liquidity exactly) when that answers 0.
 */
export async function venueReach(
	read: ReadFn,
	holder: string,
	target: string,
	position: bigint,
	asset: string,
	depth: number,
): Promise<bigint> {
	if (depth > 0 && isSet(await read(target, "liquidityAdapter"))) {
		return min(position, await vaultReach(read, target, asset, depth - 1));
	}
	const [max, held] = (await Promise.all([
		read(target, "maxWithdraw", [holder]),
		read(asset, "balanceOf", [target]),
	])) as (bigint | undefined)[];
	return min(position, max && max > ZERO ? max : (held ?? ZERO));
}

/** What a withdrawal from a VaultV2 pays in one transaction. */
export async function vaultReach(
	read: ReadFn,
	vault: string,
	asset: string,
	depth: number,
): Promise<bigint> {
	const [idle, la, data] = (await Promise.all([
		read(asset, "balanceOf", [vault]),
		read(vault, "liquidityAdapter"),
		read(vault, "liquidityData"),
	])) as [bigint | undefined, string | undefined, string | undefined];
	const pulled = isSet(la)
		? await adapterReach(read, la, data ?? "0x", asset, depth)
		: ZERO;
	return (idle ?? ZERO) + pulled;
}

/** What a liquidity adapter pulls back for `data`. An adapter of an unknown
 *  kind counts for nothing. */
async function adapterReach(
	read: ReadFn,
	adapter: string,
	data: string,
	asset: string,
	depth: number,
): Promise<bigint> {
	const id = marketIdOf(data);
	const morpho = id ? await read(adapter, "morpho") : undefined;
	if (id && isSet(morpho)) {
		const [position, cash] = await Promise.all([
			read(adapter, "expectedSupplyAssets", [id]) as Promise<bigint | undefined>,
			marketCash(read, morpho, id),
		]);
		return position === undefined || cash === undefined ? ZERO : min(position, cash);
	}
	const found = await locate(read, adapter);
	if (!found) return ZERO;
	const position = ((await read(adapter, "realAssets")) as bigint | undefined) ?? ZERO;
	return venueCap(read, adapter, found, position, asset, depth);
}

type Venue =
	| { kind: "aave"; address: string }
	| { kind: "compoundV3"; address: string }
	| { kind: "vault"; address: string };

/** Which single-position venue an adapter supplies into. */
async function locate(read: ReadFn, adapter: string): Promise<Venue | undefined> {
	const [aToken, comet, erc4626, morphoV1] = await Promise.all([
		read(adapter, "aToken"),
		read(adapter, "comet"),
		read(adapter, "erc4626Vault"),
		read(adapter, "morphoVaultV1"),
	]);
	if (isSet(aToken)) return { kind: "aave", address: aToken };
	if (isSet(comet)) return { kind: "compoundV3", address: comet };
	const vault = isSet(erc4626) ? erc4626 : isSet(morphoV1) ? morphoV1 : undefined;
	return vault ? { kind: "vault", address: vault } : undefined;
}

/** A single-position adapter's `position`, capped by what its venue pays. */
async function venueCap(
	read: ReadFn,
	adapter: string,
	venue: Venue,
	position: bigint,
	asset: string,
	depth: number,
): Promise<bigint> {
	if (venue.kind === "vault") {
		return venueReach(read, adapter, venue.address, position, asset, depth);
	}
	// Aave pays out of the cash its aToken's pool holds; a Comet's liquidity
	// is the base asset it holds.
	const cash = (await read(asset, "balanceOf", [venue.address])) as bigint | undefined;
	return min(position, cash ?? ZERO);
}

/**
 * Measure what a VaultV2 can pay out. See {@link ExitLiquidity}.
 *
 * @param runner - An ethers provider (or any contract runner)
 * @param vault - The VaultV2
 */
export async function getExitLiquidity(
	runner: ContractRunner,
	vault: string,
	options: ExitLiquidityOptions = {},
): Promise<ExitLiquidity> {
	return exitLiquidityWith(readerFor(runner), vault, options);
}

/** {@link getExitLiquidity} over any reader (for tests, or a multicall). */
export async function exitLiquidityWith(
	read: ReadFn,
	vault: string,
	{ maxDepth = DEFAULT_EXIT_DEPTH }: ExitLiquidityOptions = {},
): Promise<ExitLiquidity> {
	const [asset, la, data, length] = (await Promise.all([
		read(vault, "asset"),
		read(vault, "liquidityAdapter"),
		read(vault, "liquidityData"),
		read(vault, "adaptersLength"),
	])) as [string, string | undefined, string | undefined, bigint | undefined];
	const idle = ((await read(asset, "balanceOf", [vault])) as bigint | undefined) ?? ZERO;
	const liquidityAdapter = isSet(la)
		? await adapterReach(read, la, data ?? "0x", asset, maxDepth)
		: ZERO;

	// The liquidity adapter's own market is skipped below: the redeem
	// pulls from it after the force-deallocates, and keeps what it needs.
	const liqId = isSet(la) && data ? marketIdOf(data) : undefined;
	const sources: ExitSource[] = [];
	const marketRows = new Map<string, { morpho: string; rows: { adapter: string; position: bigint }[] }>();

	const adapters = await Promise.all(
		Array.from({ length: Number(length ?? ZERO) }, (_, i) =>
			read(vault, "adapters", [BigInt(i)]) as Promise<string | undefined>,
		),
	);
	for (const adapter of adapters) {
		if (!isSet(adapter)) continue;
		const morpho = await read(adapter, "morpho");
		if (isSet(morpho)) {
			const count = Number(((await read(adapter, "marketIdsLength")) as bigint | undefined) ?? ZERO);
			const ids = (await Promise.all(
				Array.from({ length: count }, (_, i) => read(adapter, "marketIds", [BigInt(i)])),
			)) as (string | undefined)[];
			for (const id of ids) {
				if (!id) continue;
				const position = (await read(adapter, "expectedSupplyAssets", [id])) as bigint | undefined;
				if (!position) continue;
				if (isSet(la) && same(adapter, la) && id === liqId) continue;
				const key = id.toLowerCase();
				const group = marketRows.get(key) ?? { morpho, rows: [] };
				group.rows.push({ adapter, position });
				marketRows.set(key, group);
			}
			continue;
		}
		if (isSet(la) && same(adapter, la)) continue;
		const venue = await locate(read, adapter);
		if (!venue) continue;
		const position = ((await read(adapter, "realAssets")) as bigint | undefined) ?? ZERO;
		const amount = await venueCap(read, adapter, venue, position, asset, maxDepth);
		if (amount > ZERO) sources.push({ adapter, venue: venue.address, kind: venue.kind, data: "0x", amount });
	}

	// Several positions share one market's cash; the liquidity adapter's
	// own pull keeps what it needs of its market.
	for (const [id, { morpho, rows }] of marketRows) {
		const cash = (await marketCash(read, morpho, id)) ?? ZERO;
		const params = (await read(morpho, "idToMarketParams", [id])) as readonly unknown[] | undefined;
		const data = params ? AbiCoder.defaultAbiCoder().encode(MARKET_PARAMS, [[...params]]) : "0x";
		let left = id === liqId ? (cash > liquidityAdapter ? cash - liquidityAdapter : ZERO) : cash;
		for (const { adapter, position } of rows) {
			const amount = min(position, left);
			left -= amount;
			if (amount > ZERO) sources.push({ adapter, venue: id, kind: "morphoMarket", data, amount });
		}
	}

	const deallocatable = sources.reduce((sum, s) => sum + s.amount, ZERO);
	const instant = idle + liquidityAdapter;
	return { asset, idle, liquidityAdapter, instant, deallocatable, reachable: instant + deallocatable, sources };
}
