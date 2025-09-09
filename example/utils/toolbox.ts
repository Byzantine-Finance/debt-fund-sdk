import { ByzantineClient } from "../../src/clients/ByzantineClient";
import { ethers, formatUnits } from "ethers";
import * as dotenv from "dotenv";
import { TimelockFunction } from "../../src/clients/curators";
import { AdapterType } from "../../src/clients/adapters";

dotenv.config();

export const RPC_URL = process.env.RPC_URL || "";
export const MNEMONIC = process.env.MNEMONIC || "";

export const timelocks: TimelockFunction[] = [
  "addAdapter",
  "removeAdapter",
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

export const waitDelay = (delay: number) =>
  new Promise((resolve) => setTimeout(resolve, delay));

export const waitSecond = () =>
  new Promise((resolve) => setTimeout(resolve, 1000));

export const waitHalfSecond = () =>
  new Promise((resolve) => setTimeout(resolve, 500));

interface FullReadingVault {
  sharesName: string;
  sharesSymbol: string;

  asset: string;
  totalAssets: bigint;
  totalSupply: bigint;
  virtualShares: bigint;

  owner: string;
  curator: string;
  isSentinel: boolean;
  isAllocator: boolean;

  performanceFee: number;
  managementFee: number;
  performanceFeeRecipient: string;
  managementFeeRecipient: string;
  maxRate: number;

  adapters: {
    index: number;
    address: string;
    adapterType: AdapterType | undefined;
    underlying: string;
    forceDeallocatePenalty: string;
    idsWithCaps: {
      id: string;
      absoluteCap: bigint;
      relativeCap: bigint;
      allocation: bigint;
    }[];
  }[];

  idleBalance: bigint;
  liquidityAdapter: string;
  liquidityData: any;
  timelocks: {
    name: string;
    timelock: bigint;
  }[];
}

export async function fullReading(
  client: ByzantineClient,
  vaultAddress: string,
  userAddress: string
): Promise<FullReadingVault> {
  await waitHalfSecond();
  console.log("\n*********************************************************");
  console.log("*                                                       *");
  console.log(`*   Vault: ${vaultAddress}   *`);
  console.log("*                                                       *");
  console.log("*********************************************************");
  console.log("*                                                       *");

  const fullReadingVault: FullReadingVault = {
    sharesName: await client.getSharesName(vaultAddress),
    sharesSymbol: await client.getSharesSymbol(vaultAddress),

    asset: await client.getAsset(vaultAddress),
    totalAssets: await client.getTotalAssets(vaultAddress),
    totalSupply: await client.getTotalSupply(vaultAddress),
    virtualShares: await client.getVirtualShares(vaultAddress),

    owner: await client.getOwner(vaultAddress),
    curator: await client.getCurator(vaultAddress),
    isSentinel: await client.isSentinel(vaultAddress, userAddress),
    isAllocator: await client.getIsAllocator(vaultAddress, userAddress),
    performanceFee: Number(await client.getPerformanceFee(vaultAddress)),
    managementFee: Number(await client.getManagementFee(vaultAddress)),
    performanceFeeRecipient: await client.getPerformanceFeeRecipient(
      vaultAddress
    ),
    managementFeeRecipient: await client.getManagementFeeRecipient(
      vaultAddress
    ),
    maxRate: Number(await client.getMaxRate(vaultAddress)) / 1e16,
    adapters: [], // Will be updated later
    idleBalance: await client.getIdleBalance(vaultAddress),
    liquidityAdapter: await client.getLiquidityAdapter(vaultAddress),
    liquidityData: await client.getLiquidityData(vaultAddress),
    timelocks: [], // Will be updated later
  };

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
      let adapterType: AdapterType | undefined = undefined;
      let underlying: string = "unknown";

      try {
        adapterType = await client.getAdapterType(address);
        switch (adapterType) {
          case "erc4626":
            const erc4626Id = await client.getIdsAdapterERC4626(address);
            ids = [erc4626Id]; // ERC4626 returns a single ID
            break;
          case "erc4626Merkl":
            const erc4626MerklId = await client.getIdsAdapterERC4626Merkl(
              address
            );
            ids = [erc4626MerklId]; // ERC4626 Merkl returns a single ID
            break;
          case "compoundV3":
            const compoundV3Id = await client.getIdsAdapterCompoundV3(address);
            ids = [compoundV3Id]; // Compound V3 returns a single ID
            break;
          case "morphoMarketV1":
            const marketParamsListLength =
              await client.getAdapterMarketParamsListLength(address);
            for (let i = 0; i < marketParamsListLength; i++) {
              const marketParams = await client.getAdapterMarketParamsList(
                address,
                i
              );
              const idsForMarket = await client.getIdsAdapterMarketV1(
                address,
                marketParams
              );
              ids.push(...idsForMarket);
            }
            break;
          default:
            ids = [];
            break;
        }
      } catch (error) {
        console.log(
          `Could not determine adapter type for ${address}: ${error}`
        );
      }

      if (adapterType === "erc4626") {
        underlying = await client.getUnderlyingAdapterERC4626(address);
      } else if (adapterType === "erc4626Merkl") {
        underlying = await client.getUnderlyingAdapterERC4626Merkl(address);
      } else if (adapterType === "compoundV3") {
        underlying = await client.getUnderlyingAdapterCompoundV3(address);
      } else if (adapterType === "morphoMarketV1") {
        underlying = await client.getUnderlyingAdapterMarketV1(address);
      } else if (adapterType === "morphoMarketV1") {
        underlying = await client.getUnderlyingAdapterMarketV1(address);
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
              absoluteCap: absoluteCapResult,
              relativeCap: relativeCapResult,
              allocation: allocation,
            };
          } catch (error) {
            console.log(`Error getting caps for ID ${id}: ${error}`);
            // Still include the ID even if we can't get caps
            return {
              id,
              absoluteCap: BigInt(0),
              relativeCap: BigInt(0),
              allocation: BigInt(0),
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

  // Update fullReadingVault with all additional data
  fullReadingVault.adapters = allAdapters;
  fullReadingVault.idleBalance = idleBalance;
  fullReadingVault.liquidityAdapter = liquidityAdapter;
  fullReadingVault.liquidityData = liquidityData;
  fullReadingVault.timelocks = allTimelocks;

  console.log("* Asset:", fullReadingVault.asset);
  console.log("* Name:", fullReadingVault.sharesName);
  console.log("* Symbol:", fullReadingVault.sharesSymbol);
  console.log("*");
  console.log(
    `* Total Assets: ${fullReadingVault.totalAssets} (${formatUnits(
      fullReadingVault.totalAssets,
      6
    )} USDC)`
  );
  console.log(
    `* Total Supply: ${fullReadingVault.totalSupply} (${formatUnits(
      fullReadingVault.totalSupply,
      18
    )} byzUSDC)`
  );
  console.log("* Virtual Shares:", fullReadingVault.virtualShares);
  console.log("*");
  console.log("* Your address:", userAddress, "✅");
  console.log(
    "* Owner:",
    fullReadingVault.owner,
    fullReadingVault.owner === userAddress ? "✅" : "❌"
  );
  console.log(
    "* Curator:",
    fullReadingVault.curator,
    fullReadingVault.curator === userAddress ? "✅" : "❌"
  );
  console.log(
    "* Is Sentinel:",
    fullReadingVault.isSentinel,
    fullReadingVault.isSentinel ? "✅" : "❌"
  );
  console.log(
    "* Is allocator:",
    fullReadingVault.isAllocator,
    fullReadingVault.isAllocator ? "✅" : "❌"
  );
  console.log("*");
  console.log(
    "* Performance Fee:",
    (Number(fullReadingVault.performanceFee) / 1e18) * 100,
    "%"
  );
  console.log(
    "* Management Fee:",
    fullReadingVault.managementFee,
    " -> ",
    Math.round(
      (Number(fullReadingVault.managementFee) / 1e18) * 31536000 * 1e5
    ) / 1e5,
    "%/year"
  );
  console.log(
    "* Performance Fee Recipient:",
    fullReadingVault.performanceFeeRecipient
  );
  console.log(
    "* Management Fee Recipient:",
    fullReadingVault.managementFeeRecipient
  );
  console.log(
    "* Max Rate:",
    fullReadingVault.maxRate,
    " -> ",
    (Number(fullReadingVault.maxRate) / 1e16) * 31536000,
    "%/year"
  );
  console.log("*");
  console.log("* Adapters length:", fullReadingVault.adapters.length);
  allAdapters.forEach((adapter) => {
    const forceDeallocatePenaltyPercent =
      adapter.forceDeallocatePenalty !== "0"
        ? (Number(adapter.forceDeallocatePenalty) / 1e16).toFixed(2) + "%"
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
        if (
          idWithCap.absoluteCap !== BigInt(0) &&
          idWithCap.relativeCap !== BigInt(0)
        ) {
          const relativeCapPercent =
            idWithCap.relativeCap !== BigInt(0)
              ? ((Number(idWithCap.relativeCap) / 1e18) * 100).toFixed(2) + "%"
              : "0%";
          const absoluteCapFormatted =
            idWithCap.absoluteCap !== BigInt(0)
              ? (Number(idWithCap.absoluteCap) / 1e6).toFixed(2)
              : "0";
          const allocationFormatted =
            idWithCap.allocation !== BigInt(0)
              ? (Number(idWithCap.allocation) / 1e6).toFixed(2)
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
    `* Idle Balance: ${idleBalance} (${formatUnits(idleBalance, 6)} USDC)`
  );
  console.log("*");
  allTimelocks.forEach((timelock) => {
    console.log(`* Timelock of ${timelock.name}:`, timelock.timelock);
  });
  console.log("*                                                       *");
  console.log("*********************************************************");

  return fullReadingVault;
}
