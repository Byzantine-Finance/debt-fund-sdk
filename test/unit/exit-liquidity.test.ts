import { AbiCoder, keccak256 } from "ethers";
import { describe, expect, it } from "vitest";
import { exitLiquidityWith, type ReadFn } from "../../src/utils/exitLiquidity";
import { ADDR_A, ADDR_B, ADDR_C, ADDR_D, ZERO_ADDRESS } from "../_fixtures";

const ASSET = "0x00000000000000000000000000000000000000a5";
const VAULT = ADDR_A; // the vault
const LIQ = ADDR_B; // its liquidity adapter, into the inner vault
const INNER = ADDR_C; // a VaultV2 below
const INNER_ADAPTER = ADDR_D; // the inner vault's morpho adapter
const MORPHO = "0x00000000000000000000000000000000000000b1";
const OTHER = "0x00000000000000000000000000000000000000c1"; // a second, Aave adapter
const ATOKEN = "0x00000000000000000000000000000000000000c2";

const PARAMS = [
	ASSET,
	"0x0000000000000000000000000000000000000005",
	"0x0000000000000000000000000000000000000006",
	"0x0000000000000000000000000000000000000007",
	860000000000000000n,
];
const coder = AbiCoder.defaultAbiCoder();
const T = ["tuple(address,address,address,address,uint256)"];
const DATA = coder.encode(T, [PARAMS]);
const ID = keccak256(DATA);

/** A fake chain: `table[address][fn]` answers, anything missing reverts. */
const fake =
	(table: Record<string, Record<string, unknown>>): ReadFn =>
	async (address, fn, args = []) => {
		const key = fn === "balanceOf" ? `balanceOf:${args[0]}` : fn;
		return table[address.toLowerCase()]?.[key];
	};

describe("exitLiquidityWith", () => {
	const chain = fake({
		[VAULT]: {
			asset: ASSET,
			liquidityAdapter: LIQ,
			liquidityData: "0x",
			adaptersLength: 2n,
			"adapters:0": undefined,
		},
		[ASSET]: {
			[`balanceOf:${VAULT}`]: 5n,
			[`balanceOf:${INNER}`]: 10n,
			[`balanceOf:${ATOKEN}`]: 40n,
		},
		[LIQ]: { erc4626Vault: INNER, realAssets: 5000n },
		[INNER]: {
			liquidityAdapter: INNER_ADAPTER,
			liquidityData: DATA,
			maxWithdraw: 0n,
		},
		[INNER_ADAPTER]: { morpho: MORPHO, expectedSupplyAssets: 500n },
		// 1000 supplied, 700 borrowed: 300 of cash.
		[MORPHO]: { market: [1000n, 1000n, 700n, 0n, 0n, 0n] },
		[OTHER]: { aToken: ATOKEN, realAssets: 100n },
	});
	// `adapters(i)` is read with an index, which the fake keys by fn name.
	const read: ReadFn = async (address, fn, args = []) =>
		fn === "adapters" && address === VAULT
			? [LIQ, OTHER][Number(args[0])]
			: chain(address, fn, args);

	it("follows a VaultV2 venue and counts the other positions", async () => {
		const out = await exitLiquidityWith(read, VAULT);
		// idle 5, then the inner vault: its idle 10 + min(500, 300 of cash).
		expect(out.idle).toBe(5n);
		expect(out.liquidityAdapter).toBe(310n);
		expect(out.instant).toBe(315n);
		// The Aave adapter: its position 100, within the pool's 40 of cash.
		expect(out.deallocatable).toBe(40n);
		expect(out.reachable).toBe(355n);
		expect(out.sources).toEqual([
			{ adapter: OTHER, venue: ATOKEN, kind: "aave", data: "0x", amount: 40n },
		]);
	});

	it("counts only the idle for a vault with no liquidity adapter", async () => {
		const out = await exitLiquidityWith(
			fake({
				[VAULT]: { asset: ASSET, liquidityAdapter: ZERO_ADDRESS, adaptersLength: 0n },
				[ASSET]: { [`balanceOf:${VAULT}`]: 7n },
			}),
			VAULT,
		);
		expect(out.reachable).toBe(7n);
	});

	it("stops following VaultV2s past maxDepth", async () => {
		const out = await exitLiquidityWith(read, VAULT, { maxDepth: 0 });
		// Treated as a plain venue: maxWithdraw 0, the asset it holds (10).
		expect(out.liquidityAdapter).toBe(10n);
	});
});

void ID;
