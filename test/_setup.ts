/**
 * Read-only setup helpers — used by `test/integration-read/*` to talk to
 * the user's `RPC_URL` directly (no signer, no fork).
 *
 * Write-side tests use the per-test Anvil fixture in `_test.ts`, which
 * does its own setup; nothing in this file applies to them.
 */

import { ethers } from "ethers";
import { ByzantineClient } from "../src";
import { RPC_URL } from "./_helpers";

export interface ReadOnlyContext {
	provider: ethers.JsonRpcProvider;
	client: ByzantineClient;
}

export function setupReadOnly(): ReadOnlyContext {
	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const client = new ByzantineClient(provider);
	return { provider, client };
}
