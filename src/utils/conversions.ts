/**
 * Conversion helpers — bigint (on-chain) ↔ human-readable string.
 *
 * Three conventions are used by the Vault V2 contract:
 *
 *   1. Token amounts       — bigint scaled by `decimals` (e.g. 6 for USDC).
 *   2. Percentages (WAD)   — bigint where 1e18 == 100 %.
 *   3. Rates (WAD/second)  — used for `maxRate` and `managementFee`.
 *                            Annual %  ←→  per-second WAD.
 *
 * Naming convention follows ethers' `formatUnits` / `parseUnits`:
 *   - `formatX(bigint) → string`  (encode → display)
 *   - `parseX(string) → bigint`   (display → encode)
 *
 * Implementations are lossless (pure bigint, no `Number` arithmetic) so
 * that `parseX(formatX(v)) === v` for representable inputs.
 */

const WAD = 10n ** 18n;
const SECONDS_PER_YEAR = 31_536_000n;
/** 1 % expressed in WAD (1e16). */
const WEI_PER_PERCENT = 10n ** 16n;

// ============================================================================
// TOKEN AMOUNTS  ←→  bigint
// ============================================================================

/**
 * Convert an on-chain bigint amount to a human-readable decimal string.
 *
 * Lossless: works entirely with bigints, no float precision issues.
 * Strips trailing zeros from the fractional part. Pass `maxDecimals` to
 * truncate (useful for compact display).
 *
 * @param value     The raw on-chain value.
 * @param decimals  The token's decimals (e.g. 6 for USDC, 18 for shares).
 * @param maxDecimals Optional cap on displayed fractional digits.
 *
 * @example
 * formatAmount(1_500_000n, 6)              // "1.5"  (1.5 USDC)
 * formatAmount(1_234_567_890n, 6, 4)       // "1234.5678"
 * formatAmount(0n, 18)                     // "0"
 * formatAmount(-500_000n, 6)               // "-0.5"
 */
export function formatAmount(
	value: bigint,
	decimals: number,
	maxDecimals?: number,
): string {
	const negative = value < 0n;
	const abs = negative ? -value : value;
	const divisor = 10n ** BigInt(decimals);
	const whole = abs / divisor;
	const frac = abs % divisor;

	if (frac === 0n) return `${negative ? "-" : ""}${whole}`;

	let fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
	if (maxDecimals !== undefined && fracStr.length > maxDecimals) {
		fracStr = fracStr.slice(0, maxDecimals);
	}
	return `${negative ? "-" : ""}${whole}.${fracStr}`;
}

/**
 * Parse a human decimal string into an on-chain bigint amount.
 *
 * Truncates extra fractional digits (does **not** round). Empty strings,
 * `null`-like inputs and leading/trailing whitespace are tolerated and
 * yield `0n`. Negative numbers are supported via a leading `-`.
 *
 * @param amount    Human-readable decimal string (e.g. `"1.5"`).
 * @param decimals  The token's decimals.
 *
 * @example
 * parseAmount("1.5", 6)         // 1_500_000n
 * parseAmount("0.000001", 18)   // 1_000_000_000_000n
 * parseAmount("-2", 18)         // -2_000_000_000_000_000_000n
 * parseAmount("", 18)           // 0n
 */
export function parseAmount(amount: string, decimals: number): bigint {
	if (!amount) return 0n;
	const trimmed = amount.trim();
	if (!trimmed) return 0n;

	const negative = trimmed.startsWith("-");
	const body = negative ? trimmed.slice(1) : trimmed;
	const [whole = "0", frac = ""] = body.split(".");

	const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
	const result =
		BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
	return negative ? -result : result;
}

// ============================================================================
// PERCENTAGES (WAD)  ←→  string
// ============================================================================

/**
 * Convert a WAD-encoded percentage (1e18 == 100 %) to a human percent string.
 *
 * @param wad  WAD bigint (e.g. `5n * 10n ** 16n` for 5 %).
 * @returns    Decimal string in percent units (e.g. `"5"` for 5 %).
 *
 * @example
 * formatPercent(10n ** 18n)         // "100"     (100 %)
 * formatPercent(5n * 10n ** 16n)    // "5"       (5 %)
 * formatPercent(2n * 10n ** 17n)    // "20"      (20 %)
 * formatPercent(5n * 10n ** 15n)    // "0.5"     (0.5 %)
 */
export function formatPercent(wad: bigint): string {
	return formatAmount(wad, 16);
}

/**
 * Convert a percent string into its WAD bigint encoding.
 *
 * @param percent  Decimal percent string (e.g. `"5"` for 5 %).
 * @returns        WAD bigint (e.g. `5n * 10n ** 16n`).
 *
 * @example
 * parsePercent("100")  // 10n ** 18n        (100 %)
 * parsePercent("5")    // 5n * 10n ** 16n   (5 %)
 * parsePercent("0.5")  // 5n * 10n ** 15n   (0.5 %)
 */
export function parsePercent(percent: string): bigint {
	return parseAmount(percent, 16);
}

// ============================================================================
// RATES  (WAD per second)  ←→  annual %
// ============================================================================

/**
 * Convert a per-second WAD rate into an annual percent string.
 *
 * Used for the vault's `maxRate` and `managementFee`, which are stored as
 * WAD-per-second. Multiplies by `SECONDS_PER_YEAR` (31_536_000) before
 * formatting as percent.
 *
 * @param perSecondWad  WAD-per-second bigint.
 * @returns             Annual percent as a decimal string.
 *
 * @example
 * // 5 %/year stored as wei/second:
 * const r = parseAnnualRate("5");                 // ≈ 1_585_489_599n
 * formatAnnualRate(r);                            // "4.999999..." (truncates)
 */
export function formatAnnualRate(perSecondWad: bigint): string {
	return formatPercent(perSecondWad * SECONDS_PER_YEAR);
}

/**
 * Convert an annual percent string into a per-second WAD rate.
 *
 * Computes `(percent * 1e16) / SECONDS_PER_YEAR`. Truncates the result
 * (floor division), so round-tripping `formatAnnualRate(parseAnnualRate(p))`
 * may lose sub-second precision.
 *
 * @param annualPercent  Annual percent decimal string (e.g. `"5"` for 5 %).
 * @returns              WAD-per-second bigint.
 *
 * @example
 * parseAnnualRate("5")   // ≈ 1_585_489_599n  (5 %/year per second)
 * parseAnnualRate("0")   // 0n
 */
export function parseAnnualRate(annualPercent: string): bigint {
	if (!annualPercent) return 0n;
	const annualWei = parsePercent(annualPercent);
	return annualWei / SECONDS_PER_YEAR;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** 1 WAD == 1e18 == 100 %. */
export const ONE_WAD = WAD;
/** 1 % expressed in WAD (1e16). */
export const ONE_PERCENT_WAD = WEI_PER_PERCENT;
/** Seconds in a (non-leap) year, used for annual-rate conversions. */
export const SECONDS_IN_YEAR = SECONDS_PER_YEAR;
