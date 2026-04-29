import { AbiCoder } from "ethers";
import { describe, expect, it } from "vitest";
import { idData } from "../../src/actions";
import { ADDR_A as adapter, ADDR_B as collateral, RAW_DATA as marketParams } from "../_fixtures";

const abi = new AbiCoder();

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

	it('encodes ("this/marketParams", adapter, marketParams) correctly', () => {
		const expected = abi.encode(
			["string", "address", "bytes"],
			["this/marketParams", adapter, marketParams],
		);
		expect(idData("this/marketParams", adapter, marketParams)).toBe(expected);
	});

	it("produces distinct outputs for different idTypes with the same address", () => {
		expect(idData("this", adapter)).not.toBe(
			idData("collateralToken", adapter),
		);
	});
});
