import { formatUnits, JsonRpcProvider, Wallet, ZeroAddress } from "ethers";
import { ByzantineClient, type Vault } from "../src";
import { checkAndApproveIfNeeded } from "./utils/depositor";
import {
	fullReading,
	MNEMONIC,
	RPC_URL,
	waitHalfSecond,
} from "./utils/toolbox";

interface VaultOperations {
	depositAmount?: bigint;
	mintAmount?: bigint;
	withdrawAmount?: bigint;
	redeemAmount?: bigint;
}

const VAULT_ADDRESS = "0x08077ad8ddca0aa4f91922d9397d48877257fdd7";

const DEPOSIT_CONFIG: VaultOperations = {
	// depositAmount: parseUnits("0.1", 6),
	// mintAmount: parseUnits("0.5", 18),
	// withdrawAmount: parseUnits("0.04", 6),
	// redeemAmount: 1198496n,
};

async function main() {
	console.log("🚀 Start vault user-operations example");
	console.log("=".repeat(60));

	const provider = new JsonRpcProvider(RPC_URL);
	const wallet = Wallet.fromPhrase(MNEMONIC).connect(provider);
	const client = new ByzantineClient(provider, wallet);
	const vault = client.vault(VAULT_ADDRESS);
	const userAddress = await wallet.getAddress();

	console.log(`👤 User:  ${userAddress}`);
	console.log(`🏦 Vault: ${VAULT_ADDRESS}`);

	// Sanity-check that the vault address is real.
	const assetAddress = await vault.asset();
	if (!assetAddress || assetAddress === ZeroAddress) {
		throw new Error("Invalid vault — asset() returned the zero address.");
	}
	console.log(`💰 Asset: ${assetAddress}`);

	await fullReading(client, vault, userAddress);
	await displayBalances(vault, userAddress, "Initial");

	if (DEPOSIT_CONFIG.depositAmount) {
		console.log(
			`\n💸 Deposit ${formatUnits(DEPOSIT_CONFIG.depositAmount, 6)} USDC`,
		);
		await checkAndApproveIfNeeded(
			vault,
			DEPOSIT_CONFIG.depositAmount,
			userAddress,
			"deposit",
		);
		const tx = await vault.deposit(DEPOSIT_CONFIG.depositAmount, userAddress);
		await waitHalfSecond();
		const receipt = await tx.wait();
		console.log(
			`📤 deposit tx: ${tx.hash} (block ${receipt?.blockNumber}, gas ${receipt?.gasUsed})`,
		);
		await displayBalances(vault, userAddress, "After Deposit");
	}

	if (DEPOSIT_CONFIG.mintAmount) {
		console.log(
			`\n🪙 Mint ${formatUnits(DEPOSIT_CONFIG.mintAmount, 18)} shares`,
		);
		await checkAndApproveIfNeeded(
			vault,
			DEPOSIT_CONFIG.mintAmount,
			userAddress,
			"mint",
		);
		const tx = await vault.mint(DEPOSIT_CONFIG.mintAmount, userAddress);
		await waitHalfSecond();
		const receipt = await tx.wait();
		console.log(
			`📤 mint tx: ${tx.hash} (block ${receipt?.blockNumber}, gas ${receipt?.gasUsed})`,
		);
		await displayBalances(vault, userAddress, "After Mint");
	}

	if (DEPOSIT_CONFIG.withdrawAmount) {
		console.log(
			`\n💸 Withdraw ${formatUnits(DEPOSIT_CONFIG.withdrawAmount, 6)} USDC`,
		);
		const tx = await vault.withdraw(
			DEPOSIT_CONFIG.withdrawAmount,
			userAddress,
			userAddress,
		);
		await waitHalfSecond();
		const receipt = await tx.wait();
		console.log(
			`📤 withdraw tx: ${tx.hash} (block ${receipt?.blockNumber}, gas ${receipt?.gasUsed})`,
		);
		await displayBalances(vault, userAddress, "After Withdraw");
	}

	if (DEPOSIT_CONFIG.redeemAmount) {
		console.log(
			`\n🔄 Redeem ${formatUnits(DEPOSIT_CONFIG.redeemAmount, 18)} shares`,
		);
		const sharesBefore = await vault.balanceOf(userAddress);
		if (sharesBefore < DEPOSIT_CONFIG.redeemAmount) {
			throw new Error(
				`Insufficient shares for redeem. Have ${formatUnits(sharesBefore, 18)}, need ${formatUnits(DEPOSIT_CONFIG.redeemAmount, 18)}.`,
			);
		}
		const tx = await vault.redeem(
			DEPOSIT_CONFIG.redeemAmount,
			userAddress,
			userAddress,
		);
		await waitHalfSecond();
		const receipt = await tx.wait();
		console.log(
			`📤 redeem tx: ${tx.hash} (block ${receipt?.blockNumber}, gas ${receipt?.gasUsed})`,
		);
		await displayBalances(vault, userAddress, "After Redeem");
	}

	await fullReading(client, vault, userAddress);
	console.log("\n🎉 Done.");
}

async function displayBalances(
	vault: Vault,
	userAddress: string,
	stage: string,
) {
	console.log(`\n📊 ${stage} balances`);
	console.log("─".repeat(40));
	try {
		const shares = await vault.balanceOf(userAddress);
		const usdc = await vault.assetBalance(userAddress);
		const allowance = await vault.assetAllowance(userAddress);
		console.log(`   🪙 Shares:    ${shares}  (${formatUnits(shares, 18)})`);
		console.log(`   💰 USDC:      ${usdc}  (${formatUnits(usdc, 6)})`);
		console.log(
			`   🔓 Allowance: ${allowance}  (${formatUnits(allowance, 6)})`,
		);
	} catch (err) {
		console.log(`   ❌ ${err}`);
	}
}

main().catch((err) => {
	console.error("❌ Error:", err);
	process.exit(1);
});
