import { Interface } from "ethers";
import { describe, expect, it } from "vitest";
import type { ReadFn } from "../../src/utils/exitLiquidity";
import {
	buildReallocateTo,
	PUBLIC_ALLOCATOR,
	planPaPull,
	readPaRoute,
} from "../../src/utils/publicAllocator";
import {
	groupPushes,
	type LiquidityBreakdown,
	type OwnSource,
	penaltyAssetsOf,
	type PushSource,
	planTransactions,
	planWithdraw,
} from "../../src/utils/withdrawPlan";
import { ADDR_A, ADDR_B, ADDR_C, ADDR_D } from "../_fixtures";

const WAD = 10n ** 18n;
const PARAMS = (n: number) => ({
	loanToken: ADDR_A,
	collateralToken: ADDR_B,
	oracle: ADDR_C,
	irm: ADDR_D,
	lltv: String(n),
});
const own = (adapter: string, amount: bigint, penaltyWad: bigint): OwnSource => ({
	adapter,
	venue: adapter,
	kind: "vault",
	data: "0x",
	amount,
	penaltyWad,
});
const push = (vault: string, id: string, assets: bigint, feeWei: bigint): PushSource => ({
	vault,
	feeWei,
	fromMarketId: id,
	fromParams: PARAMS(Number(id)),
	assets,
});
const base: LiquidityBreakdown = {
	idle: 100n,
	adapter: 50n,
	adapterShortfall: 0n,
	own: [],
	push: [],
};

describe("penaltyAssetsOf", () => {
	it("rounds up and is free at 0", () => {
		expect(penaltyAssetsOf(1000n, 0n)).toBe(0n);
		expect(penaltyAssetsOf(1000n, WAD / 100n)).toBe(10n);
		expect(penaltyAssetsOf(1n, WAD / 100n)).toBe(1n);
	});
});

describe("planWithdraw", () => {
	it("needs no lever within the instant liquidity", () => {
		const p = planWithdraw(base, 120n);
		expect(p).toMatchObject({ instant: 150n, covered: true, reachable: 150n });
		expect(p.pulls).toEqual([]);
	});

	it("pulls the lowest penalty first and only what is missing", () => {
		const b = { ...base, own: [own(ADDR_A, 100n, WAD / 50n), own(ADDR_B, 100n, WAD / 100n)] };
		const p = planWithdraw(b, 200n);
		expect(p.pulls.map((x) => [x.source.adapter, x.assets])).toEqual([
			[ADDR_B, 50n],
		]);
		expect(p.covered).toBe(true);
		const q = planWithdraw(b, 300n);
		expect(q.pulls.map((x) => x.assets)).toEqual([100n, 50n]);
		expect(q.penalty).toBe(1n + 1n);
	});

	it("pushes only up to the adapter's shortfall, cheapest fee first", () => {
		const b = {
			...base,
			adapterShortfall: 60n,
			push: [push(ADDR_A, "2", 100n, 5n), push(ADDR_B, "3", 100n, 1n)],
		};
		const p = planWithdraw(b, 150n + 80n);
		expect(p.pushes.map((x) => [x.source.vault, x.assets])).toEqual([[ADDR_B, 60n]]);
		expect(p.covered).toBe(false);
		expect(p.feeWei).toBe(1n);
	});

	it("skips a lever left out", () => {
		const b = { ...base, own: [own(ADDR_A, 100n, 0n)] };
		expect(planWithdraw(b, 200n, { useOwn: false }).pulls).toEqual([]);
	});
});

describe("groupPushes", () => {
	it("merges per vault, ids ascending, fee once", () => {
		const calls = groupPushes([
			{ source: push(ADDR_A, "9", 1n, 4n), assets: 10n },
			{ source: push(ADDR_A, "3", 1n, 4n), assets: 20n },
			{ source: push(ADDR_A, "9", 1n, 4n), assets: 5n },
		]);
		expect(calls).toHaveLength(1);
		expect(calls[0].withdrawals.map((w) => [w.marketId, w.amount])).toEqual([
			["3", 20n],
			["9", 15n],
		]);
	});
});

describe("transactions", () => {
	it("encodes reallocateTo with the fee as value", () => {
		const tx = buildReallocateTo(1, ADDR_A, [{ marketParams: PARAMS(1), amount: 7n }], PARAMS(2), 3n);
		expect(tx.to).toBe(PUBLIC_ALLOCATOR[1]);
		expect(tx.value).toBe(3n);
		const iface = new Interface([
			"function reallocateTo(address vault, tuple(tuple(address,address,address,address,uint256),uint128)[] w, tuple(address,address,address,address,uint256) s)",
		]);
		const [vault, w] = iface.decodeFunctionData("reallocateTo", tx.data);
		expect(vault.toLowerCase()).toBe(ADDR_A);
		expect(w[0][1]).toBe(7n);
		expect(() => buildReallocateTo(5, ADDR_A, [], PARAMS(1), 0n)).toThrow();
	});

	it("sends pushes first, then the force-deallocates as one multicall", () => {
		const b = {
			...base,
			adapterShortfall: 10n,
			push: [push(ADDR_C, "1", 10n, 2n)],
			own: [own(ADDR_A, 100n, 0n), own(ADDR_B, 100n, 0n)],
		};
		const plan = planWithdraw(b, 150n + 10n + 150n);
		const txs = planTransactions(plan, 1, ADDR_D, PARAMS(9), ADDR_A);
		expect(txs.map((t) => t.to)).toEqual([PUBLIC_ALLOCATOR[1], ADDR_D]);
		expect(txs[0].value).toBe(2n);
		expect(txs[1].data.startsWith("0xac9650d8")).toBe(true);
	});
});

describe("readPaRoute / planPaPull", () => {
	const PA = PUBLIC_ALLOCATOR[1];
	const V = "0x00000000000000000000000000000000000000d1";
	const ID1 = `0x${"1".padStart(64, "0")}`;
	const ID2 = `0x${"2".padStart(64, "0")}`;
	const MORPHO = "0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb";
	const table: Record<string, unknown> = {
		[`${V}:isAllocator:${PA.toLowerCase()}`]: true,
		[`${PA.toLowerCase()}:flowCaps:${V},${ID1}`]: [0n, 500n],
		[`${PA.toLowerCase()}:flowCaps:${V},${ID2}`]: [300n, 0n],
		[`${PA.toLowerCase()}:fee:${V}`]: 9n,
		[`${MORPHO}:position:${ID1},${V}`]: [1000n, 0n, 0n],
		[`${MORPHO}:position:${ID2},${V}`]: [0n, 0n, 0n],
		[`${MORPHO}:market:${ID1}`]: [999_999n, 999_999n * 1n, 0n, 0n, 0n, 0n],
		[`${MORPHO}:market:${ID2}`]: [0n, 0n, 0n, 0n, 0n, 0n],
		[`${V}:withdrawQueueLength`]: 2n,
		[`${V}:withdrawQueue:0`]: ID1,
		[`${V}:withdrawQueue:1`]: ID2,
		[`${V}:config:${ID2}`]: [1000n, true, 0n],
	};
	const read: ReadFn = async (address, fn, args = []) =>
		table[[address.toLowerCase(), fn, ...(args.length ? [args.join(",").toLowerCase()] : [])].join(":")];

	it("reads the route and plans the pull within every bound", async () => {
		const route = await readPaRoute(read, 1, V, ID1);
		expect(route).toMatchObject({ vault: V, feeWei: 9n, maxOut: 500n });
		expect(route?.destinations).toEqual([{ marketId: ID2, maxIn: 300n, capHeadroom: 1000n }]);
		// position ~1000 shares, maxOut 500, room 300, liquidity 10_000: 300 wins
		expect(planPaPull(route!, 10_000n).amount).toBe(300n);
		expect(planPaPull(route!, 50n).amount).toBe(50n);
	});

	it("is null when the PublicAllocator is not an allocator", async () => {
		table[`${V}:isAllocator:${PA.toLowerCase()}`] = false;
		expect(await readPaRoute(read, 1, V, ID1)).toBeNull();
	});
});
