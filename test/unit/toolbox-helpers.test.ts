/**
 * Pure unit tests for the example-toolbox helpers used by `fullReading` —
 * no RPC, no network. They guard:
 *
 *  - `fmtAbsCap` — boundary handling for `type(uint256).max`.
 *  - `classifyMorphoFlavour` — the keccak-based labelling that turns the
 *    bytes32 ids returned by `morphoMarketV1Adapter.ids(marketParams)`
 *    into one of `this` / `collateralToken` / `this/marketParams`. Each
 *    flavour is a positive hash check against the SDK's `idHash`; any
 *    other input must come back as `unknown`.
 */

import { describe, expect, it } from "vitest";
import {
	classifyMorphoFlavour,
	fmtAbsCap,
	MAX_UINT256,
} from "../../example/utils/toolbox";
import type { MarketParams } from "../../src";
import { idHash } from "../../src";
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

const ID_THIS = idHash("this", ADAPTER);
const ID_COLLATERAL = idHash("collateralToken", COLLATERAL);
const ID_MARKET_PARAMS = idHash("this/marketParams", ADAPTER, PARAMS);
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

	it("returns `this/marketParams` for the recomputed market-params hash", () => {
		expect(
			classifyMorphoFlavour(ID_MARKET_PARAMS, ADAPTER, ID_THIS, PARAMS),
		).toBe("this/marketParams");
	});

	it("returns `unknown` for an id that matches no flavour (e.g. a future 4th bucket)", () => {
		expect(
			classifyMorphoFlavour(ID_UNRELATED, ADAPTER, ID_THIS, PARAMS),
		).toBe("unknown");
	});

	it("returns `unknown` when marketParams are missing and id is not adapterId", () => {
		expect(
			classifyMorphoFlavour(ID_UNRELATED, ADAPTER, ID_THIS, undefined),
		).toBe("unknown");
	});

	it("returns `unknown` when adapterId is missing and id can't be matched", () => {
		expect(
			classifyMorphoFlavour(ID_UNRELATED, ADAPTER, undefined, undefined),
		).toBe("unknown");
	});

	it("does NOT confuse two different collateral tokens", () => {
		const otherParams: MarketParams = { ...PARAMS, collateralToken: ADDR_D };
		// ID_COLLATERAL was hashed for COLLATERAL=ADDR_B, but PARAMS now
		// claims collateral=ADDR_D — must NOT classify as collateralToken,
		// AND the marketParams hash also differs (different collateral inside),
		// so it falls through to `unknown`.
		expect(
			classifyMorphoFlavour(ID_COLLATERAL, ADAPTER, ID_THIS, otherParams),
		).toBe("unknown");
	});

	it("does NOT confuse this/marketParams ids across different markets", () => {
		const otherParams: MarketParams = { ...PARAMS, lltv: "770000000000000000" };
		// Same adapter, different market → different `this/marketParams` hash.
		expect(
			classifyMorphoFlavour(ID_MARKET_PARAMS, ADAPTER, ID_THIS, otherParams),
		).toBe("unknown");
	});
});
