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

export type { Action, IdType, TimelockFunction } from "./actions";
// ----- Calldata builders for multicall -----
export {
	Actions,
	flattenActions,
	idData,
	timelockSelector,
} from "./actions";
export type {
	AdapterType,
	DeployAdapterResult,
	MarketParams,
} from "./clients/adapters";
// ----- Adapter clients (kept as-is, used through ByzantineClient) -----
export {
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
export {
	ContractProvider,
	callContractMethod,
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
