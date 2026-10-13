/**
 * Byzantine Debt Fund SDK — main entry point.
 *
 * Recommended usage:
 *
 *   import { ByzantineClient, Actions } from "@byzantine/debt-fund-sdk";
 *
 *   const client = new ByzantineClient(provider, signer);
 *   const vault = client.vault(vaultAddress);
 *
 *   await vault.multicall([
 *     Actions.owner.setName("Byzantine USDC"),
 *     Actions.curator.instantAddAdapter(adapter),
 *     Actions.curator.instantIncreaseAbsoluteCap(idData, cap),
 *   ]);
 */

export type {
	Action,
	IdType,
	MorphoFlavour,
	TimelockFunction,
} from "./actions";
// ----- Calldata builders for multicall -----
export {
	Actions,
	classifyMorphoFlavour,
	flattenActions,
	idData,
	idHash,
	TIMELOCK_FUNCTIONS,
	timelockSelector,
} from "./actions";
export type {
	AdapterType,
	DeployAdapterResult,
	MarketParams,
} from "./clients/adapters";
// ----- Adapter clients (kept as-is, used through ByzantineClient) -----
export {
	AdapterInstance,
	AdaptersClient,
	AdaptersFactoryClient,
} from "./clients/adapters";
export type { CreateVaultResult } from "./clients/ByzantineClient";
// ----- Top-level client (factory) -----
export { ByzantineClient } from "./clients/ByzantineClient";
export * from "./constants";

// ----- Types & constants -----
export * from "./types";
// ----- Utilities (provider helpers, error formatting, conversions) -----
export type {
	ExitLiquidity,
	ExitLiquidityOptions,
	ExitSource,
	LiquidityBreakdown,
	PaDestination,
	PaRoute,
	PlannedOwnPull,
	PlannedPush,
	PushCall,
	PushSource,
	TxRequest,
	WithdrawPlan,
} from "./utils";
export {
	ContractProvider,
	callContractMethod,
	// What a VaultV2 can pay out: idle, liquidity adapter, deallocatable
	breakdownOf,
	buildReallocateTo,
	getExitLiquidity,
	groupPushes,
	MORPHO_BLUE,
	PUBLIC_ALLOCATOR,
	penaltyAssetsOf,
	planPaPull,
	planTransactions,
	planWithdraw,
	pushFromRoute,
	readPaRoute,
	// Ecosystem-wide revert decoding: name a custom error raised at ANY
	// call depth (vault -> adapter -> market -> token), plus Error(string)
	// and Panic(uint256).
	describeRevertData,
	ERROR_DICTIONARY,
	executeContractMethod,
	// Conversion helpers (bigint <-> human strings)
	formatAmount,
	formatAnnualRate,
	formatContractError,
	formatPercent,
	getWalletFromMnemonic,
	isValidAddress,
	// Anvil-fork helper — wrap your wallet with this when running tests
	// or examples against a local Anvil fork to avoid stale-nonce errors.
	LocalNonceManager,
	ONE_PERCENT_WAD,
	ONE_WAD,
	parseAmount,
	parseAnnualRate,
	parsePercent,
	SECONDS_IN_YEAR,
} from "./utils";
// ----- Per-vault unified class -----
export { Vault } from "./Vault";
