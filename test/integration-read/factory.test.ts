/**
 * Integration-read: factory contracts.
 *
 * Confirms the SDK can talk to the on-chain factories. No state changes.
 */

import { ZeroAddress } from "ethers";
import { beforeAll, describe, expect, it } from "vitest";
import type { AdapterType } from "../../src/clients/adapters";
import { DEAD_ADDRESS } from "../_fixtures";
import { hasRpc } from "../_helpers";
import { type ReadOnlyContext, setupReadOnly } from "../_setup";

const ADAPTER_TYPES: AdapterType[] = [
	"erc4626",
	"erc4626Merkl",
	"compoundV3",
	"morphoMarketV1",
];

describe.skipIf(!hasRpc())("integration-read · factories", () => {
	let ctx: ReadOnlyContext;

	beforeAll(() => {
		ctx = setupReadOnly();
	});

	it("vault factory contract has bytecode at the configured address", async () => {
		const factory = await ctx.client.getVaultFactoryContract();
		const code = await ctx.provider.getCode(factory.target as string);
		expect(code).not.toBe("0x");
		expect(code.length).toBeGreaterThan(2);
	});

	it.each(ADAPTER_TYPES)(
		"isAdapter('%s', random) returns false (when callable)",
		async (type) => {
			// Most factories return false on a non-adapter address; some may
			// revert on EXTCODESIZE checks. Either outcome confirms the SDK
			// can reach the factory — we accept both.
			try {
				expect(await ctx.client.isAdapter(type, DEAD_ADDRESS)).toBe(false);
			} catch (err) {
				expect(String(err)).toMatch(/missing revert data|reverted/i);
			}
		},
	);

	it("findAdapter returns ZeroAddress for a non-existent vault/underlying pair", async () => {
		const found = await ctx.client.findAdapter(DEAD_ADDRESS, DEAD_ADDRESS, {
			type: "erc4626",
		});
		expect(found.toLowerCase()).toBe(ZeroAddress);
	});

	it("findAdapter without `type` falls through all types and returns ZeroAddress", async () => {
		const found = await ctx.client.findAdapter(DEAD_ADDRESS, DEAD_ADDRESS);
		expect(found.toLowerCase()).toBe(ZeroAddress);
	});
});
