/**
 * Integration-write: full timelock cycle on a fresh-per-test Anvil.
 *
 *   1. Bump `timelock(addAdapter)` from 0 to a small non-zero duration.
 *   2. `submit` an addAdapter call — pending submission appears in
 *      `executableAt`.
 *   3. Trying to execute immediately reverts (timelock not expired).
 *   4. `revoke` clears the pending submission.
 */

import { describe, expect } from "vitest";
import { Actions } from "../../src";
import { DEAD_ADDRESS } from "../_fixtures";
import { hasRpcAndSigner } from "../_helpers";
import { logTx, test } from "../_test";

const TIMELOCK_DURATION = 60n;

describe.skipIf(!hasRpcAndSigner())(
	"integration-write · curator timelock cycle",
	() => {
		test("starts with timelock(addAdapter) === 0", async ({
			freshVault: { vault },
		}) => {
			expect(await vault.timelock("addAdapter")).toBe(0n);
		});

		test("instantIncreaseTimelock raises the timelock to TIMELOCK_DURATION", async ({
			freshVault: { vault, me },
		}) => {
			// Fresh vault — we're owner; make ourselves curator first.
			await logTx(await vault.setCurator(me), "setCurator(me)");
			await logTx(
				await vault.instantIncreaseTimelock("addAdapter", TIMELOCK_DURATION),
				"instantIncreaseTimelock",
			);
			expect(await vault.timelock("addAdapter")).toBe(TIMELOCK_DURATION);
		});

		test("submit + executableAt records the pending call, execute reverts", async ({
			freshVault: { vault, me },
		}) => {
			await logTx(await vault.setCurator(me), "setCurator(me)");
			await logTx(
				await vault.instantIncreaseTimelock("addAdapter", TIMELOCK_DURATION),
				"instantIncreaseTimelock",
			);

			const setCalldata = Actions.curator.addAdapter(DEAD_ADDRESS);
			await logTx(await vault.submit(setCalldata), "submit(addAdapter)");
			expect(await vault.executableAt(setCalldata)).toBeGreaterThan(0n);

			// Executing immediately reverts (timelock not expired).
			await expect(vault.addAdapter(DEAD_ADDRESS)).rejects.toThrow();
		});

		test("revoke clears the pending submission", async ({
			freshVault: { vault, me },
		}) => {
			await logTx(await vault.setCurator(me), "setCurator(me)");
			await logTx(
				await vault.instantIncreaseTimelock("addAdapter", TIMELOCK_DURATION),
				"instantIncreaseTimelock",
			);

			const setCalldata = Actions.curator.addAdapter(DEAD_ADDRESS);
			await logTx(await vault.submit(setCalldata), "submit(addAdapter)");
			await logTx(await vault.revoke(setCalldata), "revoke");
			expect(await vault.executableAt(setCalldata)).toBe(0n);
		});
	},
);
