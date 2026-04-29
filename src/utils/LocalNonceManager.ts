/**
 * `LocalNonceManager` — a drop-in replacement for `ethers.NonceManager`
 * that ALSO bakes the nonce into the tx before `estimateGas` is called.
 *
 * Why a custom one? `ethers.NonceManager` only overrides `sendTransaction`
 * and delegates `populateTransaction` to the inner Wallet. The inner
 * Wallet then fetches `getTransactionCount("pending")` itself and uses
 * that for `eth_estimateGas`. On Anvil (and similar dev nodes), the
 * pending pool is briefly stale right after a block mines — so
 * `estimateGas` reuses the just-used nonce and the chain replies
 * "nonce too low", crashing the whole call before the final
 * `sendTransaction` runs.
 *
 * We fix it by pre-computing the nonce ourselves and stamping it onto
 * the tx, so the inner Wallet never has to fetch.
 *
 * Use this whenever you fire several txs in quick succession against an
 * Anvil fork, e.g.:
 *
 * ```ts
 * import { ethers } from "ethers";
 * import { ByzantineClient, LocalNonceManager } from "@byzantine/debt-fund-sdk";
 *
 * const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
 * const client = new ByzantineClient(provider, new LocalNonceManager(wallet));
 * ```
 *
 * On real chains (Mainnet, Base, …) you don't need this — the canonical
 * RPC's pending pool is always consistent. It's only a workaround for
 * development chains.
 */

import {
	AbstractSigner,
	type BlockTag,
	type Provider,
	type Signer,
	type TransactionRequest,
	type TransactionResponse,
	type TypedDataDomain,
	type TypedDataField,
} from "ethers";

export class LocalNonceManager extends AbstractSigner {
	readonly signer: Signer;
	#noncePromise: Promise<number> | null = null;
	#delta = 0;

	constructor(signer: Signer) {
		super(signer.provider as Provider);
		this.signer = signer;
	}

	async getAddress(): Promise<string> {
		return this.signer.getAddress();
	}

	connect(provider: null | Provider): LocalNonceManager {
		return new LocalNonceManager(this.signer.connect(provider));
	}

	async getNonce(blockTag?: BlockTag): Promise<number> {
		if (blockTag === "pending") {
			if (this.#noncePromise == null) {
				this.#noncePromise = this.signer.getNonce("pending");
			}
			return (await this.#noncePromise) + this.#delta;
		}
		return this.signer.getNonce(blockTag);
	}

	increment(): void {
		this.#delta++;
	}

	reset(): void {
		this.#delta = 0;
		this.#noncePromise = null;
	}

	/**
	 * The fix: compute the nonce locally and bake it into the tx BEFORE
	 * delegating to `signer.sendTransaction()`. The inner Wallet will see
	 * `tx.nonce` already set and skip its own `getTransactionCount` —
	 * which means `estimateGas` runs with the correct nonce too.
	 */
	async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
		const nonce = await this.getNonce("pending");
		this.increment();
		return this.signer.sendTransaction({ ...tx, nonce });
	}

	signTransaction(tx: TransactionRequest): Promise<string> {
		return this.signer.signTransaction(tx);
	}

	signMessage(message: string | Uint8Array): Promise<string> {
		return this.signer.signMessage(message);
	}

	signTypedData(
		domain: TypedDataDomain,
		types: Record<string, TypedDataField[]>,
		value: Record<string, unknown>,
	): Promise<string> {
		return this.signer.signTypedData(domain, types, value);
	}
}
