/**
 * Shared test helpers — env loading and skip predicates.
 *
 * Integration tests are gated by environment variables so the unit suite
 * can run without RPC / signer / funds.
 */

import "dotenv/config";

export const RPC_URL = process.env.RPC_URL ?? "";
export const MNEMONIC = process.env.MNEMONIC ?? "";
export const TEST_VAULT_ADDRESS = process.env.TEST_VAULT_ADDRESS ?? "";

/** A read-only RPC URL is enough for integration-read tests. */
export const hasRpc = () => RPC_URL.length > 0;

/** Read-write integration tests need RPC + signer mnemonic. */
export const hasRpcAndSigner = () => hasRpc() && MNEMONIC.length > 0;

/**
 * `TEST_VAULT_ADDRESS` points at an existing vault to inspect.
 *
 * 🚨 READ-ONLY. This address is only used by `integration-read/*` tests
 * to verify reads against a real, populated vault. Never deploy, never
 * write — write-side integration tests always create a *fresh* vault
 * via `setupWithFreshVault()` and operate exclusively on that vault.
 */
export const hasTestVault = () => hasRpc() && TEST_VAULT_ADDRESS.length > 0;

/**
 * `DEBUG=1` toggles per-tx gas / hash / block logging in integration
 * tests via the `logTx()` helper. Off by default to keep CI output tidy.
 *
 *   DEBUG=1 npm run test:integration:write
 */
export const DEBUG =
	process.env.DEBUG === "1" || process.env.DEBUG?.toLowerCase() === "true";

/**
 * Vitest helper: returns a `describe.skipIf` predicate with a printed
 * reason so the user knows *why* a suite was skipped.
 */
export function skipReason(condition: boolean, reason: string): string | false {
	return condition ? false : reason;
}
