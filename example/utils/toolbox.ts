import * as dotenv from "dotenv";
import type {
	AdapterType,
	ByzantineClient,
	TimelockFunction,
	Vault,
} from "../../src";
import {
	formatAmount,
	formatAnnualRate,
	formatPercent,
} from "../../src";

dotenv.config();

export const RPC_URL = process.env.RPC_URL || "";
export const MNEMONIC = process.env.MNEMONIC || "";

/** All timelocked functions on the vault — used by `fullReading` to print durations. */
export const timelocks: TimelockFunction[] = [
	"addAdapter",
	"removeAdapter",
	"decreaseTimelock",
	"increaseAbsoluteCap",
	"increaseRelativeCap",
	"setIsAllocator",
	"setAdapterRegistry",
	"setReceiveSharesGate",
	"setSendSharesGate",
	"setReceiveAssetsGate",
	"setSendAssetsGate",
	"setPerformanceFee",
	"setPerformanceFeeRecipient",
	"setManagementFee",
	"setManagementFeeRecipient",
	"setForceDeallocatePenalty",
];

export const waitDelay = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));
export const waitSecond = () => waitDelay(1000);
export const waitHalfSecond = () => waitDelay(500);

interface AdapterSnapshot {
	index: number;
	address: string;
	adapterType: AdapterType | undefined;
	underlying: string;
	forceDeallocatePenalty: bigint;
	idsWithCaps: {
		id: string;
		absoluteCap: bigint;
		relativeCap: bigint;
		allocation: bigint;
	}[];
}

export interface FullReadingVault {
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
	performanceFee: bigint;
	managementFee: bigint;
	performanceFeeRecipient: string;
	managementFeeRecipient: string;
	maxRate: bigint;
	adapterRegistry: string;
	receiveSharesGate: string;
	sendSharesGate: string;
	receiveAssetsGate: string;
	sendAssetsGate: string;
	adapters: AdapterSnapshot[];
	idleBalance: bigint;
	liquidityAdapter: string;
	liquidityData: string;
	timelocks: { name: TimelockFunction; timelock: bigint }[];
}

/** Pull the per-adapter ids list — branches on the adapter type. */
async function readAdapterIds(
	client: ByzantineClient,
	address: string,
	type: AdapterType | undefined,
): Promise<string[]> {
	switch (type) {
		case "erc4626":
			return [await client.getIdsERC4626(address)];
		case "erc4626Merkl":
			return [await client.getIdsERC4626Merkl(address)];
		case "compoundV3":
			return [await client.getIdsCompoundV3(address)];
		case "morphoMarketV1": {
			const out: string[] = [];
			const len = await client.getMarketIdsLength(address);
			for (let i = 0; i < len; i++) {
				out.push(await client.getMarketId(address, i));
			}
			return out;
		}
		default:
			return [];
	}
}

/** Pull the underlying market/vault address for the given adapter. */
async function readAdapterUnderlying(
	client: ByzantineClient,
	address: string,
	type: AdapterType | undefined,
): Promise<string> {
	switch (type) {
		case "erc4626":
			return client.getUnderlyingERC4626(address);
		case "erc4626Merkl":
			return client.getUnderlyingERC4626Merkl(address);
		case "compoundV3":
			return client.getUnderlyingCompoundV3(address);
		case "morphoMarketV1":
			return client.getUnderlyingMarketV1(address);
		default:
			return "unknown";
	}
}

/**
 * Print the full state of a vault to the console and return it as a struct.
 * Useful in examples / debugging — not meant for production code paths.
 */
export async function fullReading(
	client: ByzantineClient,
	vault: Vault,
	userAddress: string,
): Promise<FullReadingVault> {
	await waitHalfSecond();
	console.log("\n*********************************************************");
	console.log(`*   Vault: ${vault.address}`);
	console.log("*********************************************************");

	const snapshot: FullReadingVault = {
		sharesName: await vault.name(),
		sharesSymbol: await vault.symbol(),
		asset: await vault.asset(),
		totalAssets: await vault.totalAssets(),
		totalSupply: await vault.totalSupply(),
		virtualShares: await vault.virtualShares(),
		owner: await vault.owner(),
		curator: await vault.curator(),
		isSentinel: await vault.isSentinel(userAddress),
		isAllocator: await vault.isAllocator(userAddress),
		performanceFee: await vault.performanceFee(),
		managementFee: await vault.managementFee(),
		performanceFeeRecipient: await vault.performanceFeeRecipient(),
		managementFeeRecipient: await vault.managementFeeRecipient(),
		maxRate: await vault.maxRate(),
		adapterRegistry: await vault.adapterRegistry(),
		receiveSharesGate: await vault.receiveSharesGate(),
		sendSharesGate: await vault.sendSharesGate(),
		receiveAssetsGate: await vault.receiveAssetsGate(),
		sendAssetsGate: await vault.sendAssetsGate(),
		idleBalance: await vault.idleBalance(),
		liquidityAdapter: await vault.liquidityAdapter(),
		liquidityData: await vault.liquidityData(),
		adapters: [],
		timelocks: [],
	};

	const adaptersLength = Number(await vault.adaptersLength());
	snapshot.adapters = await Promise.all(
		Array.from({ length: adaptersLength }, async (_, index) => {
			const address = await vault.adapter(index);
			const forceDeallocatePenalty = await vault.forceDeallocatePenalty(address);

			let adapterType: AdapterType | undefined;
			try {
				adapterType = await client.getAdapterType(address);
			} catch (err) {
				console.log(`  ! Could not detect type for ${address}: ${err}`);
			}

			const ids = await readAdapterIds(client, address, adapterType);
			const underlying = await readAdapterUnderlying(client, address, adapterType);

			const idsWithCaps = await Promise.all(
				ids.map(async (id) => ({
					id,
					absoluteCap: await vault.absoluteCap(id).catch(() => 0n),
					relativeCap: await vault.relativeCap(id).catch(() => 0n),
					allocation: await vault.allocation(id).catch(() => 0n),
				})),
			);

			return {
				index,
				address,
				adapterType,
				underlying,
				forceDeallocatePenalty,
				idsWithCaps,
			};
		}),
	);

	snapshot.timelocks = await Promise.all(
		timelocks.map(async (name) => ({
			name,
			timelock: await vault.timelock(name),
		})),
	);

	// ----- pretty-print -----
	console.log(`* Asset:           ${snapshot.asset}`);
	console.log(`* Name:            ${snapshot.sharesName}`);
	console.log(`* Symbol:          ${snapshot.sharesSymbol}`);
	console.log(
		`* Total Assets:    ${snapshot.totalAssets} (${formatAmount(snapshot.totalAssets, 6, 4)} USDC)`,
	);
	console.log(
		`* Total Supply:    ${snapshot.totalSupply} (${formatAmount(snapshot.totalSupply, 18, 4)} shares)`,
	);
	console.log(`* Virtual Shares:  ${snapshot.virtualShares}`);
	console.log(`*`);
	console.log(`* User:            ${userAddress} ✅`);
	console.log(
		`* Owner:           ${snapshot.owner} ${snapshot.owner === userAddress ? "✅" : "❌"}`,
	);
	console.log(
		`* Curator:         ${snapshot.curator} ${snapshot.curator === userAddress ? "✅" : "❌"}`,
	);
	console.log(`* Is Sentinel:     ${snapshot.isSentinel}`);
	console.log(`* Is Allocator:    ${snapshot.isAllocator}`);
	console.log(`*`);
	console.log(`* Performance Fee: ${formatPercent(snapshot.performanceFee)} %`);
	console.log(
		`* Management Fee:  ${formatAnnualRate(snapshot.managementFee)} %/year (raw ${snapshot.managementFee})`,
	);
	console.log(`* Perf. Recipient: ${snapshot.performanceFeeRecipient}`);
	console.log(`* Mgmt. Recipient: ${snapshot.managementFeeRecipient}`);
	console.log(`* Max Rate:        ${formatAnnualRate(snapshot.maxRate)} %/year`);
	console.log(`* Adapter Registry: ${snapshot.adapterRegistry}`);
	console.log(`*`);
	console.log(`* Receive Shares Gate: ${snapshot.receiveSharesGate}`);
	console.log(`* Send Shares Gate:    ${snapshot.sendSharesGate}`);
	console.log(`* Receive Assets Gate: ${snapshot.receiveAssetsGate}`);
	console.log(`* Send Assets Gate:    ${snapshot.sendAssetsGate}`);
	console.log(`*`);
	console.log(`* Adapters (${snapshot.adapters.length}):`);
	for (const a of snapshot.adapters) {
		const penalty =
			a.forceDeallocatePenalty === 0n
				? "0%"
				: `${formatPercent(a.forceDeallocatePenalty)}%`;
		const isLiquidity = a.address === snapshot.liquidityAdapter;
		console.log(
			`*   [${a.index}] ${a.address} (${a.adapterType} → ${a.underlying}) | penalty: ${penalty}${
				isLiquidity ? "  💦 (liquidity adapter)" : ""
			}`,
		);
		if (a.idsWithCaps.length === 0) {
			console.log(`*       no IDs found`);
		}
		for (const c of a.idsWithCaps) {
			console.log(
				`*       ID ${c.id}: relCap ${formatPercent(c.relativeCap)}% | absCap ${formatAmount(c.absoluteCap, 6, 4)} USDC | alloc ${formatAmount(c.allocation, 6, 4)}`,
			);
		}
	}
	console.log(`*`);
	console.log(`* Liquidity Adapter: ${snapshot.liquidityAdapter}`);
	console.log(`* Liquidity Data:    ${snapshot.liquidityData}`);
	console.log(
		`* Idle Balance:      ${snapshot.idleBalance} (${formatAmount(snapshot.idleBalance, 6, 4)} USDC)`,
	);
	console.log(`*`);
	for (const t of snapshot.timelocks) {
		if (t.timelock > 0n) console.log(`* Timelock ${t.name}: ${t.timelock}s`);
	}
	console.log("*********************************************************\n");

	return snapshot;
}
