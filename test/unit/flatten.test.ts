import { describe, expect, it } from "vitest";
import { flattenActions } from "../../src/actions";

describe("flattenActions", () => {
	it("returns an empty array for empty input", () => {
		expect(flattenActions([])).toEqual([]);
	});

	it("preserves a flat list of single calldatas", () => {
		expect(flattenActions(["0x01", "0x02", "0x03"])).toEqual([
			"0x01",
			"0x02",
			"0x03",
		]);
	});

	it("flattens a single instant pair (string[])", () => {
		expect(flattenActions([["0xaa", "0xbb"]])).toEqual(["0xaa", "0xbb"]);
	});

	it("mixes single calldatas and instant pairs in declared order", () => {
		const out = flattenActions([
			"0x00",
			["0x10", "0x11"],
			"0x20",
			["0x30", "0x31"],
		]);
		expect(out).toEqual(["0x00", "0x10", "0x11", "0x20", "0x30", "0x31"]);
	});

	it("does not mutate the input array", () => {
		const input: (string | readonly string[])[] = ["0x00", ["0x10", "0x11"]];
		const snapshot = JSON.stringify(input);
		flattenActions(input);
		expect(JSON.stringify(input)).toBe(snapshot);
	});
});
