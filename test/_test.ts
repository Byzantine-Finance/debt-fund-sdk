/**
 * Custom vitest `test` with per-test Anvil isolation, à la Morpho.
 *
 * Each test that consumes the `anvil` (or `freshVault`) fixture gets its
 * OWN Anvil process forked from `RPC_URL` on a free port. A fresh ethers
 * Wallet (derived from `MNEMONIC`) is funded with 10 000 ETH on the fork
 * via `anvil_setBalance`. The Anvil is stopped on teardown.
 *
 * Why per-test instead of per-file? Per-test isolation means:
 *   - no nonce races (each test owns its chain)
 *   - no leftover state from previous tests
 *   - parallel test execution becomes safe
 *
 * Cost: one Anvil boot per test (~500-1000ms). Acceptable for the small
 * integration-write suite; if it ever grows we'd switch to per-file
 * Anvil with cleanup.
 */

import { ethers, randomBytes } from "ethers";
import { test as vitest } from "vitest";
import { ByzantineClient, LocalNonceManager, type Vault } from "../src";
import { type AnvilHandle, spawnAnvil } from "./_anvil";
import { RPC_URL } from "./_helpers";

/**
 * Anvil's well-known default test mnemonic. Each spawned Anvil pre-funds
 * the first 10 derived accounts with 10 000 ETH each, and they start
 * with on-chain nonce 0 — exactly what we want for clean per-test state
 * (vs. the user's real `MNEMONIC` whose wallet starts at the actual
 * mainnet nonce, which can interact awkwardly with Anvil's pending
 * pool right after fork).
 */
const ANVIL_TEST_MNEMONIC =
	"test test test test test test test test test test test junk";

export interface AnvilContext {
	anvil: AnvilHandle;
	provider: ethers.JsonRpcProvider;
	/** The base ethers Wallet (no nonce tracking — for `getAddress`, signing, etc.). */
	wallet: ethers.HDNodeWallet;
	/**
	 * The signer used by `client` and any contracts. This is a
	 * `LocalNonceManager` wrapper around `wallet` — it tracks nonces
	 * locally and bakes them into the tx BEFORE `estimateGas` runs, which
	 * dodges Anvil's stale-pending-pool race that surfaces as "nonce too
	 * low" between fast consecutive txs.
	 */
	signer: LocalNonceManager;
	client: ByzantineClient;
	me: string;
}

export interface FreshVaultContext extends AnvilContext {
	vault: Vault;
}

/**
 * USDC whales on each supported chain — used by `dealUSDC()` to transfer
 * USDC to the test wallet via `anvil_impersonateAccount`. Pick addresses
 * that historically hold lots of USDC and aren't likely to drain.
 */
const USDC_WHALES: Record<string, string> = {
	// Base — Aave V3 USDC reserve
	"8453": "0x0A1a3b5f2041F33522C4efc754a7D096f880eE16",
	// Ethereum — Coinbase 7 hot wallet
	"1": "0x46340b20830761efd32832A74d7169B29FEB9758",
};

/**
 * Transfer some USDC to `recipient` on the active fork by impersonating
 * a known whale and sending an ERC20 transfer. Requires the fork chain
 * to be in `USDC_WHALES`.
 */
async function dealUSDC(
	provider: ethers.JsonRpcProvider,
	recipient: string,
	amount: bigint,
	usdcAddress: string,
): Promise<void> {
	const network = await provider.getNetwork();
	const whale = USDC_WHALES[network.chainId.toString()];
	if (!whale)
		throw new Error(`No USDC whale configured for chain ${network.chainId}`);

	// Make sure the whale has gas to send the transfer.
	await provider.send("anvil_setBalance", [whale, "0xde0b6b3a7640000"]);
	await provider.send("anvil_impersonateAccount", [whale]);
	try {
		const usdc = new ethers.Contract(
			usdcAddress,
			["function transfer(address,uint256) returns (bool)"],
			await provider.getSigner(whale),
		);
		const tx = await usdc.transfer(recipient, amount);
		await tx.wait();
	} finally {
		await provider.send("anvil_stopImpersonatingAccount", [whale]);
	}
}

/**
 * Vitest `test` extended with two fixtures:
 *
 *   - `anvil`        — fresh Anvil + funded wallet + ByzantineClient
 *   - `freshVault`   — `anvil` + a brand-new Vault (USDC asset)
 *
 * Use the smallest fixture you need — `freshVault` builds on top of
 * `anvil`, so requesting `freshVault` automatically provisions the
 * underlying Anvil too.
 */
export interface FundedVaultContext extends FreshVaultContext {
	/** USDC amount that was dealt to the test wallet. */
	usdcDealt: bigint;
}

export const test = vitest.extend<{
	anvil: AnvilContext;
	freshVault: FreshVaultContext;
	fundedVault: FundedVaultContext;
}>({
	// biome-ignore lint/correctness/noEmptyPattern: required by vitest
	anvil: async ({}, use) => {
		const handle = await spawnAnvil({ forkUrl: RPC_URL });
		const provider = new ethers.JsonRpcProvider(handle.rpcUrl);

		// Use Anvil's default test mnemonic — the first derived account is
		// pre-funded with 10 000 ETH and starts at on-chain nonce 0.
		const wallet =
			ethers.Wallet.fromPhrase(ANVIL_TEST_MNEMONIC).connect(provider);
		const me = await wallet.getAddress();

		const signer = new LocalNonceManager(wallet);
		const client = new ByzantineClient(provider, signer);

		if (
			process.env.DEBUG === "1" ||
			process.env.DEBUG?.toLowerCase() === "true"
		) {
			const cfg = await client.getNetworkConfig();
			const network = await provider.getNetwork();
			const block = await provider.getBlockNumber();
			console.log(
				`  🔱 Anvil fork of ${cfg.name} (chainId ${network.chainId}) @ block ${block} — ${handle.rpcUrl}`,
			);
		}

		try {
			await use({ anvil: handle, provider, wallet, signer, client, me });
		} finally {
			// Tear down the JsonRpcProvider's poller + HTTP keepalive sockets
			// before killing Anvil — otherwise the next request from the
			// (still-alive) provider would race against the dying process.
			provider.destroy();
			await handle.stop();
		}
	},

	freshVault: async ({ anvil: ctx }, use) => {
		const cfg = await ctx.client.getNetworkConfig();
		const tx = await ctx.client.createVault(
			ctx.me,
			cfg.USDCaddress,
			ethers.hexlify(randomBytes(32)),
		);
		await tx.wait();
		await use({ ...ctx, vault: tx.vault });
	},

	/**
	 * Same as `freshVault` plus 1 USDC dealt to the running wallet via a
	 * known whale impersonation. Use this for any deposit/withdraw test.
	 */
	fundedVault: async ({ freshVault: ctx }, use) => {
		const cfg = await ctx.client.getNetworkConfig();
		const usdcDealt = 1_000_000n; // 1 USDC (6 decimals)
		await dealUSDC(ctx.provider, ctx.me, usdcDealt, cfg.USDCaddress);
		await use({ ...ctx, usdcDealt });
	},
});

/**
 * Wait for a tx receipt and, when `DEBUG=1`, print a one-liner with the
 * tx hash, block, gas used and (where the provider returns it) effective
 * gas price + total cost in native.
 */
export async function logTx(
	tx: ethers.TransactionResponse,
	label = "tx",
): Promise<ethers.TransactionReceipt | null> {
	const receipt = await tx.wait();
	if (
		process.env.DEBUG === "1" ||
		process.env.DEBUG?.toLowerCase() === "true"
	) {
		if (receipt) {
			const gas = receipt.gasUsed;
			const gasPriceWei =
				receipt.gasPrice ?? tx.gasPrice ?? tx.maxFeePerGas ?? null;
			const cost =
				gasPriceWei !== null ? ethers.formatEther(gas * gasPriceWei) : "?";
			const gasPriceGwei =
				gasPriceWei !== null
					? `${(Number(gasPriceWei) / 1e9).toFixed(3)} gwei`
					: "? gwei";
			console.log(
				`  ⛽ ${label}: tx ${tx.hash}\n` +
					`     block ${receipt.blockNumber} | gas ${gas} @ ${gasPriceGwei} | cost ${cost} native`,
			);
		}
	}
	return receipt;
}
