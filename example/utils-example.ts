import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { TimelockFunction } from "../src/clients/curators";

dotenv.config();

export const RPC_URL = process.env.RPC_URL || "";
export const MNEMONIC = process.env.MNEMONIC || "";

export const timelocks: TimelockFunction[] = [
  "abdicateSubmit",
  "setIsAdapter",
  "decreaseTimelock",
  "increaseAbsoluteCap",
  "increaseRelativeCap",
  "setIsAllocator",
  "setSharesGate",
  "setReceiveAssetsGate",
  "setSendAssetsGate",
  "setPerformanceFee",
  "setPerformanceFeeRecipient",
  "setManagementFee",
  "setManagementFeeRecipient",
  "setMaxRate",
  "setForceDeallocatePenalty",
];

export const waitHalfSecond = () =>
  new Promise((resolve) => setTimeout(resolve, 500));

export async function finalReading(
  client: ByzantineClient,
  vaultAddress: string,
  userAddress: string
) {
  console.log("\n*********************************************************");
  console.log("*                                                       *");
  console.log(`*   Vault: ${vaultAddress}   *`);
  console.log("*                                                       *");
  console.log("*********************************************************");
  console.log("*                                                       *");
  const asset = await client.getAsset(vaultAddress);
  const name = await client.getVaultName(vaultAddress);
  const symbol = await client.getVaultSymbol(vaultAddress);

  const owner = await client.getOwner(vaultAddress);
  const curator = await client.getCurator(vaultAddress);
  const isSentinel = await client.isSentinel(vaultAddress, userAddress);
  const isAllocator = await client.getIsAllocator(vaultAddress, userAddress);

  const performanceFee = await client.getPerformanceFee(vaultAddress);
  const managementFee = await client.getManagementFee(vaultAddress);
  const performanceFeeRecipient = await client.getPerformanceFeeRecipient(
    vaultAddress
  );
  const managementFeeRecipient = await client.getManagementFeeRecipient(
    vaultAddress
  );
  const maxRate = await client.getMaxRate(vaultAddress);

  const adaptersLength = await client.getAdaptersLength(vaultAddress);
  const allAdapters = await Promise.all(
    Array.from({ length: Number(adaptersLength) }, async (_, index) => {
      const address = await client.getAdapterByIndex(vaultAddress, index);

      // Get caps for each adapter (using address as ID, padded to bytes32)
      const absoluteCap = await client.getAbsoluteCap(vaultAddress, index);
      const relativeCap = await client.getRelativeCap(vaultAddress, index);
      const forceDeallocatePenalty = await client.getForceDeallocatePenalty(
        vaultAddress,
        address
      );

      return {
        index,
        address,
        absoluteCap: absoluteCap.toString(),
        relativeCap: relativeCap.toString(),
        forceDeallocatePenalty: forceDeallocatePenalty.toString(),
      };
    })
  );

  const allTimelocks = await Promise.all(
    timelocks.map(async (timelock) => {
      return {
        name: timelock,
        timelock: await client.getTimelock(vaultAddress, timelock),
      };
    })
  );

  console.log("* Asset:", asset);
  console.log("* Name:", name);
  console.log("* Symbol:", symbol);
  console.log("*");
  console.log("* Your address:", userAddress, "✅");
  console.log("* Owner:", owner, owner === userAddress ? "✅" : "❌");
  console.log("* Curator:", curator, curator === userAddress ? "✅" : "❌");
  console.log("* Is Sentinel:", isSentinel, isSentinel ? "✅" : "❌");
  console.log("* Is allocator:", isAllocator, isAllocator ? "✅" : "❌");
  console.log("*");
  console.log("* Performance Fee:", (Number(performanceFee) / 1e18) * 100, "%");
  console.log(
    "* Management Fee:",
    Math.round((Number(managementFee) / 1e18) * 31536000 * 1e5) / 1e5,
    "%/year"
  );
  console.log("* Performance Fee Recipient:", performanceFeeRecipient);
  console.log("* Management Fee Recipient:", managementFeeRecipient);
  console.log(
    "* Max Rate:",
    ((Number(maxRate) / 1e18) * 31536000 * 1e5) / 1e5,
    "%/year"
  );
  console.log("*");
  console.log("* Adapters length:", adaptersLength);
  allAdapters.forEach((adapter) => {
    const relativeCapPercent =
      adapter.relativeCap !== "0"
        ? ((Number(adapter.relativeCap) / 1e18) * 100).toFixed(2) + "%"
        : "0%";
    const absoluteCapFormatted =
      adapter.absoluteCap !== "0"
        ? (Number(adapter.absoluteCap) / 1e6).toFixed(2)
        : "0";
    const forceDeallocatePenaltyPercent =
      adapter.forceDeallocatePenalty !== "0"
        ? ((Number(adapter.forceDeallocatePenalty) / 1e18) * 100).toFixed(2) +
          "%"
        : "0%";
    console.log(
      `* Adapter ${adapter.index}: ${adapter.address} | RelativeCap: ${relativeCapPercent} | AbsoluteCap: ${absoluteCapFormatted} USDC | ForceDeallocatePenalty: ${forceDeallocatePenaltyPercent}`
    );
  });
  console.log("*");
  allTimelocks.forEach((timelock) => {
    console.log(`* Timelock of ${timelock.name}:`, timelock.timelock);
  });
  console.log("*                                                       *");
  console.log("*********************************************************");
}
