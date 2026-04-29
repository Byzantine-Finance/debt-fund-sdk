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

// ----- Top-level client (factory) -----
export { ByzantineClient } from "./clients/ByzantineClient";
export type { CreateVaultResult } from "./clients/ByzantineClient";

// ----- Per-vault unified class -----
export { Vault } from "./Vault";

// ----- Calldata builders for multicall -----
export {
	Actions,
	flattenActions,
	idData,
	timelockSelector,
} from "./actions";
export type { Action, IdType, TimelockFunction } from "./actions";

// ----- Adapter clients (kept as-is, used through ByzantineClient) -----
export {
	AdaptersClient,
	AdaptersFactoryClient,
} from "./clients/adapters";
export type {
	AdapterType,
	DeployAdapterResult,
	MarketParams,
} from "./clients/adapters";

// ----- Types & constants -----
export * from "./types";
export * from "./constants";

// ----- Utilities (provider helpers, error formatting) -----
export {
	ContractProvider,
	executeContractMethod,
	callContractMethod,
	formatContractError,
	getWalletFromMnemonic,
	isValidAddress,
	formatAmount,
} from "./utils";
