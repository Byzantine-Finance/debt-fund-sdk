import { ByzantineClient } from "../../src/clients/ByzantineClient";
import { formatUnits } from "ethers";
import { waitHalfSecond } from "./toolbox";

export // Helper function to check and approve asset if needed
async function checkAndApproveIfNeeded(
  client: ByzantineClient,
  vaultAddress: string,
  amount: bigint,
  userAddress: string,
  operation: "deposit" | "mint" | "withdraw" | "redeem" = "deposit"
): Promise<boolean> {
  // For mint operations, we need to calculate how many assets are needed
  let amountToApprove = amount;

  if (operation === "mint") {
    amountToApprove = await client.previewMint(vaultAddress, amount);
    console.log(
      `   📊 For minting ${formatUnits(amount, 18)} shares, need ${formatUnits(
        amountToApprove,
        6
      )} USDC`
    );
  }

  const currentAllowance = await client.getAssetAllowance(
    vaultAddress,
    userAddress
  );

  if (currentAllowance < amountToApprove) {
    console.log(
      `   🔓 Approving vault to spend ${formatUnits(
        amountToApprove,
        6
      )} USDC for ${operation}`
    );
    const tx = await client.approveAsset(vaultAddress, amountToApprove);
    await tx.wait();
    await waitHalfSecond();
    return true; // Approval was needed and performed
  }

  console.log(
    `   ✅ Vault already has sufficient allowance (${formatUnits(
      currentAllowance,
      6
    )} USDC) for ${operation}`
  );
  return false; // No approval needed
}
