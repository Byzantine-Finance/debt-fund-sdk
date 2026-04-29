/**
 * Integration-write: full timelock cycle.
 *
 *   1. Bump `timelock(addAdapter)` from 0 to a small non-zero duration.
 *   2. `submit` an addAdapter call — pending submission appears in
 *      `executableAt`.
 *   3. Trying to execute immediately reverts (timelock not expired).
 *   4. `revoke` clears the pending submission.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { Actions, type Vault } from "../../src";
import { DEAD_ADDRESS } from "../_fixtures";
import { hasRpcAndSigner } from "../_helpers";
import { type FreshVaultContext, setupWithFreshVault } from "../_setup";

const TIMELOCK_DURATION = 60n;

describe.skipIf(!hasRpcAndSigner())(
	"integration-write · curator timelock cycle",
	() => {
		let ctx: FreshVaultContext;
		let vault: Vault;

		beforeAll(async () => {
			ctx = await setupWithFreshVault();
			vault = ctx.vault;
			// We're the owner — also make ourselves the curator.
			await (await vault.setCurator(ctx.me)).wait();
		});

		it("starts with timelock(addAdapter) === 0", async () => {
			expect(await vault.timelock("addAdapter")).toBe(0n);
		});

		it("instantIncreaseTimelock raises the timelock to TIMELOCK_DURATION", async () => {
			await (
				await vault.instantIncreaseTimelock("addAdapter", TIMELOCK_DURATION)
			).wait();
			expect(await vault.timelock("addAdapter")).toBe(TIMELOCK_DURATION);
		});

		it("submit + executableAt records the pending call", async () => {
			const setCalldata = Actions.curator.addAdapter(DEAD_ADDRESS);

			await (await vault.submit(setCalldata)).wait();
			expect(await vault.executableAt(setCalldata)).toBeGreaterThan(0n);

			// Executing immediately reverts (timelock not expired).
			await expect(vault.addAdapter(DEAD_ADDRESS)).rejects.toThrow();
		});

		it("revoke clears the pending submission", async () => {
			const setCalldata = Actions.curator.addAdapter(DEAD_ADDRESS);
			await (await vault.revoke(setCalldata)).wait();
			expect(await vault.executableAt(setCalldata)).toBe(0n);
		});
	},
);
