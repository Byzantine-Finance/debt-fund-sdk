import { describe, expect, it } from "vitest";
import {
	formatAmount,
	formatAnnualRate,
	formatPercent,
	ONE_PERCENT_WAD,
	ONE_WAD,
	parseAmount,
	parseAnnualRate,
	parsePercent,
	SECONDS_IN_YEAR,
} from "../../src/utils/conversions";

describe("formatAmount", () => {
	it("formats integer amounts", () => {
		expect(formatAmount(0n, 18)).toBe("0");
		expect(formatAmount(1_500_000n, 6)).toBe("1.5");
		expect(formatAmount(1_000_000_000_000_000_000n, 18)).toBe("1");
	});

	it("strips trailing zeros from the fractional part", () => {
		expect(formatAmount(1_500_000n, 6)).toBe("1.5");
		expect(formatAmount(1_230_000n, 6)).toBe("1.23");
	});

	it("supports negative values", () => {
		expect(formatAmount(-1_500_000n, 6)).toBe("-1.5");
	});

	it("respects maxDecimals when provided", () => {
		expect(formatAmount(1_234_567_890n, 6, 4)).toBe("1234.5678");
		expect(formatAmount(1_500_000n, 6, 0)).toBe("1.");
	});
});

describe("parseAmount", () => {
	it("parses standard inputs", () => {
		expect(parseAmount("1.5", 6)).toBe(1_500_000n);
		expect(parseAmount("0", 18)).toBe(0n);
		expect(parseAmount("0.000001", 18)).toBe(1_000_000_000_000n);
	});

	it("tolerates empty / whitespace input", () => {
		expect(parseAmount("", 18)).toBe(0n);
		expect(parseAmount("   ", 18)).toBe(0n);
	});

	it("supports negative values", () => {
		expect(parseAmount("-2", 18)).toBe(-2_000_000_000_000_000_000n);
	});

	it("truncates extra fractional digits (no rounding)", () => {
		expect(parseAmount("1.123456789", 6)).toBe(1_123_456n);
	});
});

describe("amount round-trip", () => {
	for (const [v, dec] of [
		[0n, 18],
		[1n, 6],
		[1_500_000n, 6],
		[10n ** 18n, 18],
		[123_456_789_012_345n, 12],
	] as const) {
		it(`parse∘format = id for ${v} (decimals=${dec})`, () => {
			expect(parseAmount(formatAmount(v, dec), dec)).toBe(v);
		});
	}
});

describe("formatPercent / parsePercent", () => {
	it("formatPercent on key WAD values", () => {
		expect(formatPercent(ONE_WAD)).toBe("100");
		expect(formatPercent(5n * ONE_PERCENT_WAD)).toBe("5");
		expect(formatPercent(2n * 10n ** 17n)).toBe("20");
		expect(formatPercent(5n * 10n ** 15n)).toBe("0.5");
	});

	it("parsePercent on key strings", () => {
		expect(parsePercent("100")).toBe(ONE_WAD);
		expect(parsePercent("5")).toBe(5n * ONE_PERCENT_WAD);
		expect(parsePercent("0.5")).toBe(5n * 10n ** 15n);
	});

	it("round-trips", () => {
		for (const wad of [
			0n,
			ONE_WAD,
			5n * ONE_PERCENT_WAD,
			3n * 10n ** 17n,
		]) {
			expect(parsePercent(formatPercent(wad))).toBe(wad);
		}
	});
});

describe("formatAnnualRate / parseAnnualRate", () => {
	it("parseAnnualRate matches (percent * 1e16) / SECONDS_PER_YEAR", () => {
		const expected = (5n * ONE_PERCENT_WAD) / SECONDS_IN_YEAR;
		expect(parseAnnualRate("5")).toBe(expected);
	});

	it("0 input → 0n", () => {
		expect(parseAnnualRate("")).toBe(0n);
		expect(parseAnnualRate("0")).toBe(0n);
	});

	it("formatAnnualRate inverts parseAnnualRate up to 1-second truncation", () => {
		// 5%/year → tiny precision loss because the per-second rate is floored.
		const r = parseAnnualRate("5");
		const back = formatAnnualRate(r);
		// "5" or "4.99..." depending on truncation; just check it's close.
		expect(back.startsWith("5") || back.startsWith("4.99")).toBe(true);
	});

	it("constants exported correctly", () => {
		expect(ONE_WAD).toBe(10n ** 18n);
		expect(ONE_PERCENT_WAD).toBe(10n ** 16n);
		expect(SECONDS_IN_YEAR).toBe(31_536_000n);
	});
});
