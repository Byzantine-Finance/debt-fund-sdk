import type { Vault } from "../../src";
import { formatAmount } from "../../src";
import { waitHalfSecond } from "./toolbox";

/**
 * Ensure the vault has enough underlying-asset allowance for a given operation.
 * Approves only if needed; returns `true` if an approval tx was sent.
 *
 * For `mint`, the input is in shares — we preview the asset cost first.
 */
export async function checkAndApproveIfNeeded(
	vault: Vault,
	amount: bigint,
	userAddress: string,
	operation: "deposit" | "mint" | "withdraw" | "redeem" = "deposit",
): Promise<boolean> {
	let amountToApprove = amount;

	if (operation === "mint") {
		amountToApprove = await vault.previewMint(amount);
		console.log(
			`   📊 Mint ${formatAmount(amount, 18, 4)} shares → need ${formatAmount(amountToApprove, 6, 4)} USDC`,
		);
	}

	const currentAllowance = await vault.assetAllowance(userAddress);
	if (currentAllowance < amountToApprove) {
		console.log(
			`   🔓 Approving vault for ${formatAmount(amountToApprove, 6, 4)} USDC (${operation})`,
		);
		await (await vault.approveAsset(amountToApprove)).wait();
		await waitHalfSecond();
		return true;
	}

	console.log(
		`   ✅ Allowance sufficient (${formatAmount(currentAllowance, 6, 4)} USDC) for ${operation}`,
	);
	return false;
}
