import type { ExitLiquidity, ExitSource } from "./exitLiquidity";
import type { MarketParams } from "../clients/adapters";
import type { PaRoute } from "./publicAllocator";
import { buildReallocateTo, type TxRequest } from "./publicAllocator";
import { Interface } from "ethers";
import { Actions } from "../actions";

const MULTICALL = new Interface(["function multicall(bytes[] data)"]);

/**
 * Where a VaultV2 withdrawal gets its assets from, and what reaching
 * further costs.
 *
 * `VaultV2.exit` pays out of the idle assets first, then deallocates from the
 * liquidity adapter alone. Past that the redeem reverts, even for a holder
 * with enough shares. Two permissionless levers push the limit out:
 *
 * - Own: force-deallocate the vault's OTHER positions back to idle in the
 *   same transaction. The contract burns `assets * penalty / WAD` of the
 *   caller's shares per pull, so this costs the withdrawer.
 * - Push: when the liquidity adapter sits in a Morpho market short of
 *   liquidity, MetaMorpho v1 vaults wired to the PublicAllocator can move
 *   supply INTO that market (`reallocateTo`, a flat ETH fee per call). That
 *   only helps up to the adapter's own position.
 */

export const WAD = 10n ** 18n;
const ZERO = 0n;
const min = (a: bigint, b: bigint) => (a < b ? a : b);

/** The penalty `forceDeallocate` burns for `assets`, in asset units (rounded up). */
export function penaltyAssetsOf(assets: bigint, penaltyWad: bigint): bigint {
	if (penaltyWad <= ZERO) return ZERO;
	return (assets * penaltyWad + WAD - 1n) / WAD;
}

/** One position of the vault a force-deallocate can pull from. */
export interface OwnSource extends ExitSource {
	/** `forceDeallocate`'s penalty for this adapter, WAD. */
	penaltyWad: bigint;
}

/** One PublicAllocator reallocation into the liquidity adapter's market. */
export interface PushSource {
	vault: string;
	/** Wei of native currency, per call. */
	feeWei: bigint;
	/** The market the supply is taken from. */
	fromMarketId: string;
	fromParams: MarketParams;
	/** Loan-asset units one call can move in. */
	assets: bigint;
}

/** A {@link PaRoute} out of `fromMarketId`, as a push into the liquidity market. */
export function pushFromRoute(
	route: PaRoute,
	fromMarketId: string,
	fromParams: MarketParams,
	amount: bigint,
): PushSource {
	return {
		vault: route.vault,
		feeWei: route.feeWei,
		fromMarketId,
		fromParams,
		assets: amount,
	};
}

export interface LiquidityBreakdown {
	idle: bigint;
	/** What the liquidity adapter releases now. */
	adapter: bigint;
	/** How much more it would release if its market had the liquidity.
	 *  Zero when the market is not the constraint. */
	adapterShortfall: bigint;
	own: OwnSource[];
	push: PushSource[];
}

/** An {@link ExitLiquidity} and the penalties of its sources, ready to plan. */
export function breakdownOf(
	exit: ExitLiquidity,
	penaltyWad: (adapter: string) => bigint,
	adapterShortfall: bigint = ZERO,
	push: PushSource[] = [],
): LiquidityBreakdown {
	return {
		idle: exit.idle,
		adapter: exit.liquidityAdapter,
		adapterShortfall,
		own: exit.sources.map((s) => ({ ...s, penaltyWad: penaltyWad(s.adapter) })),
		push,
	};
}

export interface PlannedOwnPull {
	source: OwnSource;
	assets: bigint;
	penalty: bigint;
}

export interface PlannedPush {
	source: PushSource;
	assets: bigint;
}

export interface WithdrawPlan {
	/** What the vault pays without any lever. */
	instant: bigint;
	pushes: PlannedPush[];
	pulls: PlannedOwnPull[];
	/** instant + everything the levers bring in. */
	reachable: bigint;
	/** Burned from the withdrawer's shares, asset units. */
	penalty: bigint;
	/** Native currency, wei. */
	feeWei: bigint;
	/** The levers cover `need`. */
	covered: boolean;
}

/**
 * The cheapest way to make `need` assets payable: pushes first (a flat fee,
 * often zero, and no penalty), each taking only what is still missing; then
 * force-deallocates, lowest penalty first. A lever left out is skipped.
 */
export function planWithdraw(
	b: LiquidityBreakdown,
	need: bigint,
	opts: { usePush?: boolean; useOwn?: boolean } = {},
): WithdrawPlan {
	const { usePush = true, useOwn = true } = opts;
	const instant = b.idle + b.adapter;
	let missing = need > instant ? need - instant : ZERO;

	const pushes: PlannedPush[] = [];
	if (usePush) {
		let room = b.adapterShortfall;
		const byFee = [...b.push].sort((x, y) =>
			x.feeWei === y.feeWei ? 0 : x.feeWei < y.feeWei ? -1 : 1,
		);
		for (const source of byFee) {
			if (missing === ZERO || room === ZERO) break;
			const assets = min(min(source.assets, room), missing);
			if (assets === ZERO) continue;
			pushes.push({ source, assets });
			missing -= assets;
			room -= assets;
		}
	}

	const pulls: PlannedOwnPull[] = [];
	if (useOwn) {
		const byPenalty = [...b.own].sort((x, y) =>
			x.penaltyWad === y.penaltyWad ? 0 : x.penaltyWad < y.penaltyWad ? -1 : 1,
		);
		for (const source of byPenalty) {
			if (missing === ZERO) break;
			const assets = min(source.amount, missing);
			if (assets === ZERO) continue;
			pulls.push({ source, assets, penalty: penaltyAssetsOf(assets, source.penaltyWad) });
			missing -= assets;
		}
	}

	const brought =
		pushes.reduce((sum, p) => sum + p.assets, ZERO) +
		pulls.reduce((sum, p) => sum + p.assets, ZERO);
	return {
		instant,
		pushes,
		pulls,
		reachable: instant + brought,
		penalty: pulls.reduce((sum, p) => sum + p.penalty, ZERO),
		feeWei: groupPushes(pushes).reduce((sum, c) => sum + c.feeWei, ZERO),
		covered: missing === ZERO,
	};
}

/** One `reallocateTo`: every market a vault gives up supply from. */
export interface PushCall {
	vault: string;
	/** Paid once per call, whatever the number of markets. */
	feeWei: bigint;
	withdrawals: { marketParams: MarketParams; marketId: string; amount: bigint }[];
}

/**
 * Pushes merged into one call per source vault. The PublicAllocator takes
 * several withdrawals in one `reallocateTo` but wants their market ids unique
 * and strictly increasing (`InconsistentWithdrawals` otherwise), and charges
 * the vault's fee once per call: merging cuts both the signatures and the fees.
 */
export function groupPushes(pushes: readonly PlannedPush[]): PushCall[] {
	const byVault = new Map<string, PushCall>();
	for (const { source, assets } of pushes) {
		const key = source.vault.toLowerCase();
		const call = byVault.get(key) ?? { vault: source.vault, feeWei: source.feeWei, withdrawals: [] };
		const id = source.fromMarketId.toLowerCase();
		const same = call.withdrawals.find((w) => w.marketId === id);
		if (same) same.amount += assets;
		else call.withdrawals.push({ marketParams: source.fromParams, marketId: id, amount: assets });
		byVault.set(key, call);
	}
	for (const call of byVault.values()) {
		call.withdrawals.sort((a, b) => (BigInt(a.marketId) < BigInt(b.marketId) ? -1 : 1));
	}
	return [...byVault.values()];
}

/**
 * The transactions that make a plan's levers happen, in order, to send
 * BEFORE the withdraw/redeem: one `reallocateTo` per source vault, then the
 * vault's `multicall` of `forceDeallocate`s (a single call goes out plain).
 *
 * @param liquidityMarket - The market the liquidity adapter sits in, where the pushes supply
 * @param onBehalf - Whose shares pay the penalty: the withdrawer
 */
export function planTransactions(
	plan: WithdrawPlan,
	chainId: number,
	vault: string,
	liquidityMarket: MarketParams | undefined,
	onBehalf: string,
): TxRequest[] {
	const txs: TxRequest[] = [];
	if (plan.pushes.length > 0) {
		if (!liquidityMarket) throw new Error("A push needs the liquidity adapter's market params");
		for (const call of groupPushes(plan.pushes)) {
			txs.push(buildReallocateTo(chainId, call.vault, call.withdrawals, liquidityMarket, call.feeWei));
		}
	}
	if (plan.pulls.length > 0) {
		const calls = plan.pulls.map((p) =>
			Actions.user.forceDeallocate(p.source.adapter, p.source.data, p.assets, onBehalf),
		);
		txs.push({
			to: vault,
			data: calls.length === 1 ? calls[0] : MULTICALL.encodeFunctionData("multicall", [calls]),
			value: 0n,
		});
	}
	return txs;
}
