/**
 * Integration-read: network detection.
 *
 * Confirms chain ID detection, NetworkConfig completeness, and that the
 * cache short-circuits subsequent calls.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { isChainSupported } from "../../src/constants/networks";
import { ContractProvider } from "../../src/utils";
import { hasRpc } from "../_helpers";
import { type ReadOnlyContext, setupReadOnly } from "../_setup";

describe.skipIf(!hasRpc())("integration-read · network", () => {
	let ctx: ReadOnlyContext;

	beforeAll(() => {
		ctx = setupReadOnly();
	});

	it("detects a supported chain ID", async () => {
		expect(isChainSupported(await ctx.client.getChainId())).toBe(true);
	});

	it("returns a complete NetworkConfig", async () => {
		const cfg = await ctx.client.getNetworkConfig();
		expect(cfg.name).toBeTruthy();
		expect(cfg.vaultV2Factory).toMatch(/^0x[0-9a-fA-F]{40}$/);
		expect(cfg.morphoRegistry).toMatch(/^0x[0-9a-fA-F]{40}$/);
		expect(cfg.adapters.erc4626AdapterFactory).toMatch(/^0x[0-9a-fA-F]{40}$/);
		expect(cfg.adapters.morphoMarketV1AdapterFactory).toMatch(
			/^0x[0-9a-fA-F]{40}$/,
		);
	});

	it("caches the chain ID — second call doesn't re-query the network", async () => {
		const cp = new ContractProvider(ctx.provider);
		const a = await cp.getChainId();
		let calls = 0;
		const original = ctx.provider.getNetwork.bind(ctx.provider);
		ctx.provider.getNetwork = async () => {
			calls++;
			return original();
		};
		const b = await cp.getChainId();
		expect(b).toBe(a);
		expect(calls).toBe(0);
		ctx.provider.getNetwork = original;
	});
});
