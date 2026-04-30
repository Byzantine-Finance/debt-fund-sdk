/**
 * Pure unit tests for the example-toolbox helpers used by `fullReading` —
 * no RPC, no network. They guard:
 *
 *  - `fmtAbsCap` — boundary handling for `type(uint256).max`.
 *  - `classifyMorphoFlavour` — the keccak-based labelling that turns the
 *    bytes32 ids returned by `morphoMarketV1Adapter.ids(marketParams)`
 *    into one of `this` / `collateralToken` / `this/marketParams`.
 */

import { AbiCoder, keccak256 } from "ethers";
import { describe, expect, it } from "vitest";
import type { MarketParams } from "../../src";
import {
	classifyMorphoFlavour,
	fmtAbsCap,
	MAX_UINT256,
} from "../../example/utils/toolbox";
import { ADDR_A, ADDR_B, ADDR_C, ADDR_D } from "../_fixtures";

const ADAPTER = ADDR_A;
const COLLATERAL = ADDR_B;
const LOAN = ADDR_C;
const ORACLE = ADDR_D;
const IRM = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const PARAMS: MarketParams = {
	loanToken: LOAN,
	collateralToken: COLLATERAL,
	oracle: ORACLE,
	irm: IRM,
	lltv: "860000000000000000",
};

const abi = AbiCoder.defaultAbiCoder();

const ID_THIS = keccak256(
	abi.encode(["string", "address"], ["this", ADAPTER]),
);
const ID_COLLATERAL = keccak256(
	abi.encode(["string", "address"], ["collateralToken", COLLATERAL]),
);
const ID_UNRELATED =
	"0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

describe("fmtAbsCap", () => {
	it("formats a finite cap with USDC suffix", () => {
		expect(fmtAbsCap(100_000_000n)).toBe("100 USDC");
	});

	it("collapses type(uint256).max to ∞", () => {
		expect(fmtAbsCap(MAX_UINT256)).toBe("∞");
	});

	it("treats values strictly above MAX_UINT256 as ∞ too (defensive)", () => {
		expect(fmtAbsCap(MAX_UINT256 + 1n)).toBe("∞");
	});

	it("respects a non-default decimals argument", () => {
		expect(fmtAbsCap(1_000_000_000_000_000_000n, 18)).toBe("1 USDC");
	});

	it("returns 0 USDC for 0 (cap explicitly set to zero)", () => {
		expect(fmtAbsCap(0n)).toBe("0 USDC");
	});
});

describe("classifyMorphoFlavour", () => {
	it("returns `this` when id matches the adapter's adapterId", () => {
		expect(classifyMorphoFlavour(ID_THIS, ADAPTER, ID_THIS, PARAMS)).toBe(
			"this",
		);
	});

	it("`this` check is case-insensitive on the id hex", () => {
		expect(
			classifyMorphoFlavour(
				ID_THIS.toUpperCase().replace("0X", "0x"),
				ADAPTER,
				ID_THIS,
				PARAMS,
			),
		).toBe("this");
	});

	it("returns `collateralToken` for the recomputed collateral hash", () => {
		expect(
			classifyMorphoFlavour(ID_COLLATERAL, ADAPTER, ID_THIS, PARAMS),
		).toBe("collateralToken");
	});

	it("falls back to `this/marketParams` for any other morpho-returned id", () => {
		// The Morpho V1 adapter currently exposes only three flavours, so
		// anything that is neither `this` nor `collateralToken` is, by
		// elimination, the per-market bucket.
		expect(
			classifyMorphoFlavour(ID_UNRELATED, ADAPTER, ID_THIS, PARAMS),
		).toBe("this/marketParams");
	});

	it("returns `unknown` when marketParams are missing and id is not adapterId", () => {
		expect(
			classifyMorphoFlavour(ID_UNRELATED, ADAPTER, ID_THIS, undefined),
		).toBe("unknown");
	});

	it("returns `unknown` when adapterId is missing and id can't be matched", () => {
		// no adapterId provided AND no marketParams → classifier has nothing
		// to compare against, hits the unknown branch.
		expect(
			classifyMorphoFlavour(ID_UNRELATED, ADAPTER, undefined, undefined),
		).toBe("unknown");
	});

	it("does NOT confuse two different collateral tokens", () => {
		const otherParams: MarketParams = { ...PARAMS, collateralToken: ADDR_D };
		// ID_COLLATERAL was hashed for COLLATERAL=ADDR_B, but PARAMS now
		// claims collateral=ADDR_D — must NOT classify as collateralToken.
		expect(
			classifyMorphoFlavour(ID_COLLATERAL, ADAPTER, ID_THIS, otherParams),
		).toBe("this/marketParams");
	});
});
