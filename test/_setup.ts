/**
 * Shared setup helpers for integration tests.
 *
 * Three layers, one helper each:
 *   - `setupReadOnly()`        — provider + client, no signer
 *   - `setupSigner()`          — provider + wallet + client + `me`
 *   - `setupWithFreshVault()`  — `setupSigner()` + a brand-new vault deployed
 *                                with the chain's USDC as the asset
 *
 * Naming convention used everywhere:
 *   - `provider` — ethers Provider
 *   - `wallet`   — ethers Wallet
 *   - `client`   — ByzantineClient
 *   - `me`       — the running wallet's address
 *   - `vault`    — Vault instance (in fresh-vault helper)
 */

import { ethers, randomBytes } from "ethers";
import { ByzantineClient, type Vault } from "../src";
import { MNEMONIC, RPC_URL } from "./_helpers";

export interface ReadOnlyContext {
	provider: ethers.JsonRpcProvider;
	client: ByzantineClient;
}

export interface SignerContext extends ReadOnlyContext {
	wallet: ethers.HDNodeWallet;
	me: string;
}

export interface FreshVaultContext extends SignerContext {
	vault: Vault;
}

/** RPC + read-only client. Caller must have `RPC_URL` set. */
export function setupReadOnly(): ReadOnlyContext {
	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const client = new ByzantineClient(provider);
	return { provider, client };
}

/** RPC + signer-aware client. Caller must have `RPC_URL` + `MNEMONIC`. */
export async function setupSigner(): Promise<SignerContext> {
	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const me = await wallet.getAddress();
	return { provider, wallet, client, me };
}

/**
 * Same as `setupSigner()` but additionally deploys a fresh vault on the
 * active chain with `me` as owner and the chain's canonical USDC as asset.
 *
 * Awaits the deployment receipt before returning, so the returned `vault`
 * is immediately usable for reads/writes.
 */
export async function setupWithFreshVault(): Promise<FreshVaultContext> {
	const ctx = await setupSigner();
	const cfg = await ctx.client.getNetworkConfig();
	const tx = await ctx.client.createVault(
		ctx.me,
		cfg.USDCaddress,
		ethers.hexlify(randomBytes(32)),
	);
	await tx.wait();
	return { ...ctx, vault: tx.vault };
}
