import { formatUnits, JsonRpcProvider, Wallet } from "ethers";
import {
	ByzantineClient,
	planTransactions,
	readPaRoute,
} from "../src";
import { MNEMONIC, RPC_URL } from "./utils/toolbox";

// byzUSD → Keyrock USDC → a Morpho market: a nested VaultV2 chain.
const VAULT_ADDRESS = "0x30cACd22F178C9e57b0B010E1F9432881aa530C4";
const CHAIN_ID = 1;

/** Set to actually send the plan's transactions (needs shares + gas). */
const SEND = false;

async function main() {
	const provider = new JsonRpcProvider(RPC_URL);
	const wallet = Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const vault = client.vault(VAULT_ADDRESS);
	const user = await wallet.getAddress();
	const decimals = 6; // the vault's asset (USDC)
	const fmt = (n: bigint) => formatUnits(n, decimals);

	// 1. What can this vault pay out? Nested VaultV2s are followed down.
	const exit = await vault.exitLiquidity();
	console.log(`Idle:                ${fmt(exit.idle)}`);
	console.log(`Liquidity adapter:   ${fmt(exit.liquidityAdapter)}`);
	console.log(`Instant (1 tx):      ${fmt(exit.instant)}`);
	console.log(`Force-deallocatable: ${fmt(exit.deallocatable)}`);
	console.log(`Reachable:           ${fmt(exit.reachable)}`);
	for (const s of exit.sources) {
		console.log(`  · ${s.kind} ${s.adapter} → ${fmt(s.amount)}`);
	}

	// 2. How to withdraw a bit more than the instant liquidity?
	//    Pushes (PublicAllocator, optional) are found per candidate v1 vault:
	//    const route = await readPaRoute(read, CHAIN_ID, v1Vault, fromMarketId);
	void readPaRoute;
	const need = exit.instant + 2_000n;
	const { plan } = await vault.planExit(need, user);
	console.log(`\nNeed ${fmt(need)}: covered=${plan.covered}`);
	console.log(`Penalty (burned shares, in assets): ${fmt(plan.penalty)}`);
	for (const p of plan.pulls) {
		console.log(`  forceDeallocate ${p.source.adapter} ${fmt(p.assets)}`);
	}

	// 3. The transactions to send BEFORE the withdraw/redeem.
	const txs = planTransactions(plan, CHAIN_ID, VAULT_ADDRESS, undefined, user);
	if (SEND) {
		for (const tx of txs) await (await wallet.sendTransaction(tx)).wait();
		await (await vault.withdraw(need, user, user)).wait();
	} else {
		console.log(`\n${txs.length} pre-transaction(s) ready (SEND = false)`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
