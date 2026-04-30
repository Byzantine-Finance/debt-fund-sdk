import { AbiCoder, keccak256 } from "ethers";
import { describe, expect, it } from "vitest";
import { idData, idHash } from "../../src/actions";
import type { MarketParams } from "../../src/clients/adapters";
import {
	ADDR_A as adapter,
	ADDR_B as collateral,
	ADDR_C as loan,
	ADDR_D as oracle,
} from "../_fixtures";

const abi = new AbiCoder();
const IRM = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const MARKET_PARAMS_TUPLE = "tuple(address,address,address,address,uint256)";

const params: MarketParams = {
	loanToken: loan,
	collateralToken: collateral,
	oracle,
	irm: IRM,
	lltv: "860000000000000000",
};

describe("idData", () => {
	it('encodes ("this", adapter) as ABI-encoded ("this", address)', () => {
		const expected = abi.encode(["string", "address"], ["this", adapter]);
		expect(idData("this", adapter)).toBe(expected);
	});

	it('encodes ("collateralToken", token) correctly', () => {
		const expected = abi.encode(
			["string", "address"],
			["collateralToken", collateral],
		);
		expect(idData("collateralToken", collateral)).toBe(expected);
	});

	it('encodes ("this/marketParams", adapter, marketParams) with the struct INLINE — matches the on-chain adapter encoding', () => {
		// MorphoMarketV1AdapterV2 hashes the struct directly as part of the
		// outer abi.encode (no `bytes` wrapper). Mirror that here so that
		// `keccak256(idData(...))` == the bucket id returned by `ids()`.
		const expected = abi.encode(
			["string", "address", MARKET_PARAMS_TUPLE],
			[
				"this/marketParams",
				adapter,
				[loan, collateral, oracle, IRM, params.lltv],
			],
		);
		expect(idData("this/marketParams", adapter, params)).toBe(expected);
	});

	it("produces distinct outputs for different idTypes with the same address", () => {
		expect(idData("this", adapter)).not.toBe(
			idData("collateralToken", adapter),
		);
	});
});

describe("idHash", () => {
	it("returns keccak256 of the corresponding idData blob (this)", () => {
		expect(idHash("this", adapter)).toBe(keccak256(idData("this", adapter)));
	});

	it("returns keccak256 of the corresponding idData blob (collateralToken)", () => {
		expect(idHash("collateralToken", collateral)).toBe(
			keccak256(idData("collateralToken", collateral)),
		);
	});

	it("returns keccak256 of the corresponding idData blob (this/marketParams)", () => {
		expect(idHash("this/marketParams", adapter, params)).toBe(
			keccak256(idData("this/marketParams", adapter, params)),
		);
	});

	it("produces distinct hashes for different flavours of the same adapter", () => {
		expect(idHash("this", adapter)).not.toBe(
			idHash("this/marketParams", adapter, params),
		);
		expect(idHash("collateralToken", collateral)).not.toBe(
			idHash("this/marketParams", adapter, params),
		);
	});
});
