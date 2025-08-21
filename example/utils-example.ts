import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, formatUnits } from "ethers";
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

  const totalAssets = await client.getTotalAssets(vaultAddress);
  const totalSupply = await client.getTotalSupply(vaultAddress);
  const virtualShares = await client.getVirtualShares(vaultAddress);

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

      // Get force deallocate penalty for the adapter
      const forceDeallocatePenalty = await client.getForceDeallocatePenalty(
        vaultAddress,
        address
      );

      // Try to determine adapter type and get IDs
      let ids: string[] = [];
      let adapterType: string = "unknown";
      let underlying: string = "unknown";

      try {
        // Try Morpho Vault V1 first
        const isVaultV1Adapter = await client.isAdapter(
          "morphoVaultV1",
          address
        );
        if (isVaultV1Adapter) {
          adapterType = "morphoVaultV1";
          const vaultId = await client.getIdsAdapterVaultV1(address);
          ids = [vaultId]; // Vault V1 returns a single ID
        } else {
          // Try Morpho Market V1
          const isMarketV1Adapter = await client.isAdapter(
            "morphoMarketV1",
            address
          );
          if (isMarketV1Adapter) {
            adapterType = "morphoMarketV1";
            // For Market V1, we would need market params to get IDs
            // For now, we'll skip this as it requires specific market parameters
            ids = [];
          }
        }
      } catch (error) {
        console.log(
          `Could not determine adapter type for ${address}: ${error}`
        );
      }

      if (adapterType === "morphoVaultV1") {
        underlying = await client.getUnderlyingVaultFromAdapterV1(address);
      } else if (adapterType === "morphoMarketV1") {
        underlying = await client.getUnderlyingMarketFromAdapterV1(address);
      }

      // Get caps for each ID (caps are per ID, not per adapter)
      const idsWithCaps = await Promise.all(
        ids.map(async (id) => {
          try {
            // Use the ID directly to get caps from the vault
            // The vault's absoluteCap and relativeCap functions take bytes32 directly

            const absoluteCapResult = await client.getAbsoluteCap(
              vaultAddress,
              id
            );
            const relativeCapResult = await client.getRelativeCap(
              vaultAddress,
              id
            );

            const allocation = await client.getAllocation(vaultAddress, id);

            return {
              id,
              absoluteCap: absoluteCapResult.toString(),
              relativeCap: relativeCapResult.toString(),
              hasCaps: true,
              allocation: allocation.toString(),
            };
          } catch (error) {
            console.log(`Error getting caps for ID ${id}: ${error}`);
            // Still include the ID even if we can't get caps
            return {
              id,
              absoluteCap: "N/A",
              relativeCap: "N/A",
              hasCaps: false,
              allocation: "N/A",
            };
          }
        })
      );

      return {
        index,
        address,
        adapterType,
        underlying,
        forceDeallocatePenalty: forceDeallocatePenalty.toString(),
        idsWithCaps,
      };
    })
  );

  const idleBalance = await client.getIdleBalance(vaultAddress);

  const liquidityAdapter = await client.getLiquidityAdapter(vaultAddress);
  const liquidityData = await client.getLiquidityData(vaultAddress);

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
  console.log(
    "* Total Assets:",
    totalAssets,
    " (",
    formatUnits(totalAssets, 6),
    "USDC)"
  );
  console.log(
    "* Total Supply:",
    totalSupply,
    " (",
    formatUnits(totalSupply, 18),
    "byzUSDC)"
  );
  console.log("* Virtual Shares:", virtualShares);
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
    const forceDeallocatePenaltyPercent =
      adapter.forceDeallocatePenalty !== "0"
        ? ((Number(adapter.forceDeallocatePenalty) / 1e18) * 100).toFixed(2) +
          "%"
        : "0%";

    const isLiquidityAdapter = adapter.address === liquidityAdapter;

    console.log(
      `* Adapter ${adapter.index}: ${adapter.address} (${
        adapter.adapterType
      } with underlying ${
        adapter.underlying
      }) | ForceDeallocatePenalty: ${forceDeallocatePenaltyPercent} ${
        isLiquidityAdapter ? " | (Liquidity Adapter 💦)" : ""
      }`
    );

    if (adapter.idsWithCaps.length > 0) {
      adapter.idsWithCaps.forEach((idWithCap) => {
        if (idWithCap.hasCaps) {
          const relativeCapPercent =
            idWithCap.relativeCap !== "0"
              ? ((Number(idWithCap.relativeCap) / 1e18) * 100).toFixed(2) + "%"
              : "0%";
          const absoluteCapFormatted =
            idWithCap.absoluteCap !== "0"
              ? (Number(idWithCap.absoluteCap) / 1e6).toFixed(2)
              : "0";
          const allocationFormatted =
            idWithCap.allocation !== "0"
              ? (Number(idWithCap.allocation) / 1e18).toFixed(2)
              : "0";

          console.log(
            `*    |-> ID ${idWithCap.id}: RelativeCap: ${relativeCapPercent} | AbsoluteCap: ${absoluteCapFormatted} USDC  | Allocation: ${allocationFormatted}`
          );
        } else {
          // Show ID even if we can't get caps
          console.log(
            `*    |-> ID ${idWithCap.id}: RelativeCap: N/A | AbsoluteCap: N/A (caps not available)`
          );
        }
      });
    } else {
      console.log(
        `*    |-> No IDs found for this adapter (${adapter.adapterType})`
      );
    }
  });
  console.log("*");
  console.log("* Liquidity Adapter:", liquidityAdapter);
  console.log("* Liquidity Data:", liquidityData);
  console.log("*");
  console.log(
    "* Idle Balance:",
    idleBalance,
    " (",
    formatUnits(idleBalance, 6),
    "USDC)"
  );
  console.log("*");
  allTimelocks.forEach((timelock) => {
    console.log(`* Timelock of ${timelock.name}:`, timelock.timelock);
  });
  console.log("*                                                       *");
  console.log("*********************************************************");
}
