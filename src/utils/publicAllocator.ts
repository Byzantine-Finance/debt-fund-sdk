import { Interface } from "ethers";
import type { MarketParams } from "../clients/adapters";
import type { ReadFn } from "./exitLiquidity";

/**
 * The Morpho PublicAllocator lets ANYONE move a MetaMorpho v1 vault's supply
 * between its own markets within curator-set flow caps (`reallocateTo`, plus
 * an optional per-call ETH fee). Withdrawing from a market that way frees its
 * liquidity exactly like a VaultV2 force-deallocate does, and supplying INTO
 * a market refills the one a VaultV2 liquidity adapter is stuck on.
 *
 * One `reallocateTo` withdraws from one or more markets and supplies a SINGLE
 * destination market of the same vault.
 */

/** Canonical deployments (their `MORPHO()` is the Morpho Blue singleton). */
export const PUBLIC_ALLOCATOR: Record<number, string> = {
	1: "0xfd32fA2ca22c76dD6E550706Ad913FC6CE91c75D",
	8453: "0xA090dD1a701408Df1d4d0B85b716c87565f90467",
};

/** The Morpho Blue singleton, the same address on both chains. */
export const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

const PA_INTERFACE = new Interface([
	"function reallocateTo(address vault, tuple(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint128 amount)[] withdrawals, tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) supplyMarketParams) payable",
]);

/** A transaction ready to send: `signer.sendTransaction({ to, data, value })`. */
export interface TxRequest {
	to: string;
	data: string;
	value: bigint;
}

export interface PaWithdrawal {
	marketParams: MarketParams;
	amount: bigint;
}

/**
 * `reallocateTo(vault, withdrawals, supplyMarketParams)`. The PublicAllocator
 * wants the withdrawals' market ids unique and strictly increasing
 * (`InconsistentWithdrawals` otherwise): {@link groupPushes} does it.
 * `feeWei` is the vault's
 * `fee(vault)`, paid once per call.
 */
export function buildReallocateTo(
	chainId: number,
	vault: string,
	withdrawals: readonly PaWithdrawal[],
	supplyMarketParams: MarketParams,
	feeWei: bigint,
): TxRequest {
	const to = PUBLIC_ALLOCATOR[chainId];
	if (!to) throw new Error(`No PublicAllocator on chain ${chainId}`);
	const struct = (m: MarketParams) => [
		m.loanToken,
		m.collateralToken,
		m.oracle,
		m.irm,
		BigInt(m.lltv),
	];
	return {
		to,
		data: PA_INTERFACE.encodeFunctionData("reallocateTo", [
			vault,
			withdrawals.map((w) => [struct(w.marketParams), w.amount]),
			struct(supplyMarketParams),
		]),
		value: feeWei,
	};
}

/** A sibling market of the vault that could absorb the moved funds. */
export interface PaDestination {
	marketId: string;
	/** Remaining inbound flow cap. */
	maxIn: bigint;
	/** supplyCap - supplyAssets, clamped at zero. */
	capHeadroom: bigint;
}

/** A v1 vault with a usable PublicAllocator route out of one market. */
export interface PaRoute {
	vault: string;
	/** Wei of native currency per `reallocateTo` call. */
	feeWei: bigint;
	/** The vault's supply in the market. */
	position: bigint;
	/** Remaining outbound flow cap of the market. */
	maxOut: bigint;
	destinations: PaDestination[];
}

/** How much a destination can absorb: min(maxIn, supply-cap room). */
export function destinationHeadroom(d: PaDestination): bigint {
	return d.maxIn < d.capHeadroom ? d.maxIn : d.capHeadroom;
}

export interface PaPullPlan {
	/** What one reallocateTo call can actually move. */
	amount: bigint;
	/** Where it goes; null when no destination can absorb anything. */
	destination: PaDestination | null;
}

/**
 * Plan a single-destination pull out of a market, routed to the sibling
 * market with the most headroom. Bounded by the vault's position, the
 * market's `maxOut`, the market's own liquidity and the destination's room.
 */
export function planPaPull(route: PaRoute, marketLiquidity: bigint): PaPullPlan {
	let best: PaDestination | null = null;
	let bestRoom = 0n;
	for (const d of route.destinations) {
		const room = destinationHeadroom(d);
		if (room > bestRoom) {
			best = d;
			bestRoom = room;
		}
	}
	if (!best) return { amount: 0n, destination: null };
	let amount = route.position;
	if (route.maxOut < amount) amount = route.maxOut;
	if (bestRoom < amount) amount = bestRoom;
	if (marketLiquidity < amount) amount = marketLiquidity;
	return { amount: amount < 0n ? 0n : amount, destination: best };
}

const lower = (s: string) => s.toLowerCase();

/**
 * Read, on-chain, whether a MetaMorpho v1 `vault` has a usable
 * PublicAllocator route out of `marketId`. Null when it has none: the
 * PublicAllocator is not one of its allocators (`reallocateTo` would revert
 * NotAllocatorRole), no outbound flow cap on this market, no position, or
 * no sibling market with room left.
 *
 * The position is read at the last accrual (an upper bound for a market with
 * borrowers); the flow caps and supply caps are the contracts' own.
 */
export async function readPaRoute(
	read: ReadFn,
	chainId: number,
	vault: string,
	marketId: string,
): Promise<PaRoute | null> {
	const pa = PUBLIC_ALLOCATOR[chainId];
	if (!pa) return null;
	if (!(await read(vault, "isAllocator", [pa]))) return null;

	const flow = async (id: string) =>
		(await read(pa, "flowCaps", [vault, id])) as readonly bigint[] | undefined;
	const here = await flow(marketId);
	const maxOut = here?.[1] ?? 0n;
	if (maxOut <= 0n) return null;

	const supplied = async (id: string) => {
		const [pos, m] = (await Promise.all([
			read(MORPHO_BLUE, "position", [id, vault]),
			read(MORPHO_BLUE, "market", [id]),
		])) as [readonly bigint[] | undefined, readonly bigint[] | undefined];
		if (!pos || !m) return 0n;
		// Morpho's own virtual-share conversion, rounding down.
		return (pos[0] * (m[0] + 1n)) / (m[1] + 1_000_000n);
	};
	const position = await supplied(marketId);
	if (position <= 0n) return null;

	const length = Number(((await read(vault, "withdrawQueueLength")) as bigint | undefined) ?? 0n);
	const ids = (await Promise.all(
		Array.from({ length }, (_, i) => read(vault, "withdrawQueue", [BigInt(i)])),
	)) as (string | undefined)[];

	const destinations: PaDestination[] = [];
	for (const id of ids) {
		if (!id || lower(id) === lower(marketId)) continue;
		const [caps, cfg, held] = await Promise.all([
			flow(id),
			read(vault, "config", [id]) as Promise<readonly [bigint, boolean, bigint] | undefined>,
			supplied(id),
		]);
		const maxIn = caps?.[0] ?? 0n;
		const cap = cfg?.[0] ?? 0n;
		const capHeadroom = cap > held ? cap - held : 0n;
		if (maxIn > 0n && capHeadroom > 0n) destinations.push({ marketId: id, maxIn, capHeadroom });
	}
	if (destinations.length === 0) return null;

	const feeWei = ((await read(pa, "fee", [vault])) as bigint | undefined) ?? 0n;
	return { vault, feeWei, position, maxOut, destinations };
}
