/**
 * 🚀 Multicall showcase
 *
 * Demonstrates the central feature of the v2 SDK: bundling many vault
 * operations into a single transaction via `vault.multicall(...)` and the
 * `Actions` namespace.
 *
 * Scenario: starting from a freshly-created vault, configure it end-to-end
 *   - set name + symbol               (owner)
 *   - install a curator               (owner)  ← skipped here, we keep ourselves
 *   - install an allocator            (curator, instant)
 *   - set fees + recipients           (curator, instant × 4)
 *   - add an adapter                  (curator, instant)
 *   - set its force-deallocate penalty (curator, instant)
 *   - bump its absolute + relative caps (curator, instant × 2)
 *   - set the liquidity adapter       (allocator)
 *   - set the maxRate                 (allocator)
 *
 * Old API: ~12 sequential transactions (12 wallet signatures, 12 gas
 * overhead payments, 12 round-trips, no atomicity).
 *
 * New API: ONE transaction. Atomic. Cheap. Single signature.
 */

import { ethers, parseEther, parseUnits, randomBytes } from "ethers";
import { Actions, ByzantineClient, idData, parseAnnualRate } from "../src";
import { fullReading, MNEMONIC, RPC_URL } from "./utils/toolbox";

// USDC on Base
const ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// An existing ERC4626-compatible vault to plug in as an adapter target
const UNDERLYING_VAULT = "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738";

async function main() {
	console.log("🚀 multicall showcase — full vault setup in 1 tx\n");

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const userAddress = await wallet.getAddress();

	// ----- step 1: create the vault (separate tx — factory is its own contract) -----
	console.log("1️⃣  Creating vault…");
	const create = await client.createVault(
		userAddress,
		ASSET,
		ethers.hexlify(randomBytes(32)),
	);
	await create.wait();
	const vault = create.vault;
	console.log(`   ✅ vault @ ${vault.address}`);

	// ----- step 2: deploy the adapter (also its own factory contract) -----
	console.log("\n2️⃣  Deploying ERC4626 adapter…");
	const deploy = await client.deployAdapter(
		"erc4626",
		vault.address,
		UNDERLYING_VAULT,
	);
	await deploy.wait();
	const adapter = deploy.adapterAddress;
	console.log(`   ✅ adapter @ ${adapter}`);

	// ----- step 3: configure EVERYTHING in one multicall -----
	console.log("\n3️⃣  Bundling 11 configuration calls into ONE multicall…");

	const adapterIdData = idData("this", adapter);

	const tx = await vault.multicall([
		// owner-side
		Actions.owner.setName("Byzantine Showcase USD"),
		Actions.owner.setSymbol("bzShow"),
		Actions.owner.setIsSentinel(userAddress, true),

		// curator-side (instant — possible because timelock is 0 on a fresh vault)
		Actions.curator.instantSetIsAllocator(userAddress, true),
		Actions.curator.instantSetPerformanceFeeRecipient(userAddress),
		Actions.curator.instantSetManagementFeeRecipient(userAddress),
		Actions.curator.instantSetPerformanceFee(parseUnits("0.05", 18)), // 5 %
		Actions.curator.instantSetManagementFee(parseAnnualRate("1")), // 1 %/year
		Actions.curator.instantAddAdapter(adapter),
		Actions.curator.instantSetForceDeallocatePenalty(
			adapter,
			parseEther("0.01"),
		), // 1 %
		Actions.curator.instantIncreaseRelativeCap(
			adapterIdData,
			parseUnits("1", 18),
		), // 100 %
		Actions.curator.instantIncreaseAbsoluteCap(
			adapterIdData,
			parseUnits("1000", 6),
		), // 1000 USDC

		// allocator-side
		Actions.allocator.setLiquidityAdapterAndData(adapter, "0x"),
		Actions.allocator.setMaxRate(parseAnnualRate("200")), // cap distributed APY @ 200 %
	]);

	console.log(`   📨 tx: ${tx.hash}`);
	const receipt = await tx.wait();
	console.log(
		`   ✅ mined in block ${receipt?.blockNumber}, gas: ${receipt?.gasUsed}`,
	);

	// ----- step 4: verify -----
	console.log("\n4️⃣  Reading back the configured vault…");
	await fullReading(client, vault, userAddress);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
