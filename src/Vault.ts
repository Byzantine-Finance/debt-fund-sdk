/**
 * Vault — unified class for all interactions with a single VaultV2 instance.
 *
 * Reads match the contract function names directly (e.g. `vault.totalAssets()`,
 * `vault.absoluteCap(id)`).
 *
 * Writes:
 *  - Owner-only setters are direct (`setName`, `setOwner`, ...).
 *  - Curator setters are timelocked, exposed as a triplet:
 *      submitX(...)  → schedules
 *      X(...)        → executes (after timelock has expired)
 *      instantX(...) → submit + execute via multicall (only if timelock = 0)
 *  - Allocator and user actions are direct.
 *
 * `vault.multicall([...])` accepts an array of `Action` (string | string[])
 * built from the `Actions` namespace, and bundles everything into one tx.
 */

import { Contract, ethers } from "ethers";
import {
	Actions,
	flattenActions,
	idData as buildIdData,
	timelockSelector,
} from "./actions";
import type { Action, IdType, TimelockFunction } from "./actions";
import { VAULT_ABI } from "./constants/abis";
import { callContractMethod, executeContractMethod } from "./utils";

const ERC20_MIN_ABI = [
	"function balanceOf(address) view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
] as const;

export class Vault {
	readonly address: string;
	readonly contract: ethers.Contract;
	private readonly runner: ethers.ContractRunner;

	constructor(address: string, runner: ethers.ContractRunner) {
		this.address = address;
		this.runner = runner;
		this.contract = new Contract(address, VAULT_ABI, runner);
	}

	// ====================================================================
	// MULTICALL — the central feature
	// ====================================================================

	/**
	 * Bundle multiple actions into a single transaction via the contract's
	 * `multicall(bytes[])`. Accepts a mix of single calldatas and arrays
	 * (returned by `instantX` actions); the array is flattened automatically.
	 *
	 * @example
	 * await vault.multicall([
	 *   Actions.owner.setName("Byzantine USDC"),
	 *   Actions.curator.instantAddAdapter(adapter),
	 *   Actions.curator.instantIncreaseAbsoluteCap(idData, cap),
	 *   Actions.allocator.setMaxRate(rate),
	 * ]);
	 */
	async multicall(actions: readonly Action[]): Promise<ethers.TransactionResponse> {
		return executeContractMethod(this.contract, "multicall", flattenActions(actions));
	}

	// ====================================================================
	// READS — match the contract surface
	// ====================================================================

	asset(): Promise<string> {
		return callContractMethod(this.contract, "asset");
	}
	decimals(): Promise<number> {
		return callContractMethod(this.contract, "decimals");
	}
	name(): Promise<string> {
		return callContractMethod(this.contract, "name");
	}
	symbol(): Promise<string> {
		return callContractMethod(this.contract, "symbol");
	}
	owner(): Promise<string> {
		return callContractMethod(this.contract, "owner");
	}
	curator(): Promise<string> {
		return callContractMethod(this.contract, "curator");
	}
	totalAssets(): Promise<bigint> {
		return callContractMethod(this.contract, "totalAssets");
	}
	totalSupply(): Promise<bigint> {
		return callContractMethod(this.contract, "totalSupply");
	}
	virtualShares(): Promise<bigint> {
		return callContractMethod(this.contract, "virtualShares");
	}
	maxRate(): Promise<bigint> {
		return callContractMethod(this.contract, "maxRate");
	}
	lastUpdate(): Promise<bigint> {
		return callContractMethod(this.contract, "lastUpdate");
	}

	// ----- shares (ERC20) -----
	balanceOf(account: string): Promise<bigint> {
		return callContractMethod(this.contract, "balanceOf", account);
	}
	allowance(owner: string, spender: string): Promise<bigint> {
		return callContractMethod(this.contract, "allowance", owner, spender);
	}

	// ----- previews -----
	previewDeposit(assets: bigint): Promise<bigint> {
		return callContractMethod(this.contract, "previewDeposit", assets);
	}
	previewMint(shares: bigint): Promise<bigint> {
		return callContractMethod(this.contract, "previewMint", shares);
	}
	previewWithdraw(assets: bigint): Promise<bigint> {
		return callContractMethod(this.contract, "previewWithdraw", assets);
	}
	previewRedeem(shares: bigint): Promise<bigint> {
		return callContractMethod(this.contract, "previewRedeem", shares);
	}
	convertToShares(assets: bigint): Promise<bigint> {
		return callContractMethod(this.contract, "convertToShares", assets);
	}
	convertToAssets(shares: bigint): Promise<bigint> {
		return callContractMethod(this.contract, "convertToAssets", shares);
	}

	// ----- adapters -----
	adaptersLength(): Promise<bigint> {
		return callContractMethod(this.contract, "adaptersLength");
	}
	adapter(index: number): Promise<string> {
		return callContractMethod(this.contract, "adapters", index);
	}
	isAdapter(account: string): Promise<boolean> {
		return callContractMethod(this.contract, "isAdapter", account);
	}
	adapterRegistry(): Promise<string> {
		return callContractMethod(this.contract, "adapterRegistry");
	}

	// ----- caps & allocations -----
	absoluteCap(id: string): Promise<bigint> {
		return callContractMethod(this.contract, "absoluteCap", id);
	}
	relativeCap(id: string): Promise<bigint> {
		return callContractMethod(this.contract, "relativeCap", id);
	}
	allocation(id: string): Promise<bigint> {
		return callContractMethod(this.contract, "allocation", id);
	}

	// ----- roles -----
	isAllocator(account: string): Promise<boolean> {
		return callContractMethod(this.contract, "isAllocator", account);
	}
	isSentinel(account: string): Promise<boolean> {
		return callContractMethod(this.contract, "isSentinel", account);
	}

	// ----- gates -----
	receiveSharesGate(): Promise<string> {
		return callContractMethod(this.contract, "receiveSharesGate");
	}
	sendSharesGate(): Promise<string> {
		return callContractMethod(this.contract, "sendSharesGate");
	}
	receiveAssetsGate(): Promise<string> {
		return callContractMethod(this.contract, "receiveAssetsGate");
	}
	sendAssetsGate(): Promise<string> {
		return callContractMethod(this.contract, "sendAssetsGate");
	}

	// ----- fees -----
	performanceFee(): Promise<bigint> {
		return callContractMethod(this.contract, "performanceFee");
	}
	performanceFeeRecipient(): Promise<string> {
		return callContractMethod(this.contract, "performanceFeeRecipient");
	}
	managementFee(): Promise<bigint> {
		return callContractMethod(this.contract, "managementFee");
	}
	managementFeeRecipient(): Promise<string> {
		return callContractMethod(this.contract, "managementFeeRecipient");
	}
	forceDeallocatePenalty(adapter: string): Promise<bigint> {
		return callContractMethod(this.contract, "forceDeallocatePenalty", adapter);
	}

	// ----- liquidity adapter -----
	liquidityAdapter(): Promise<string> {
		return callContractMethod(this.contract, "liquidityAdapter");
	}
	liquidityData(): Promise<string> {
		return callContractMethod(this.contract, "liquidityData");
	}

	// ----- timelock -----
	timelock(fn: TimelockFunction): Promise<bigint> {
		return callContractMethod(this.contract, "timelock", timelockSelector(fn));
	}
	executableAt(data: string): Promise<bigint> {
		return callContractMethod(this.contract, "executableAt", data);
	}
	abdicated(fn: TimelockFunction): Promise<boolean> {
		return callContractMethod(this.contract, "abdicated", timelockSelector(fn));
	}

	// ----- helpers (asset-side reads) -----
	/** Underlying-asset balance of an arbitrary account. */
	async assetBalance(account: string): Promise<bigint> {
		const assetAddr = await this.asset();
		const token = new Contract(assetAddr, ERC20_MIN_ABI, this.runner);
		return callContractMethod(token, "balanceOf", account);
	}
	/** Allowance granted to the vault by `owner` on the underlying asset. */
	async assetAllowance(owner: string): Promise<bigint> {
		const assetAddr = await this.asset();
		const token = new Contract(assetAddr, ERC20_MIN_ABI, this.runner);
		return callContractMethod(token, "allowance", owner, this.address);
	}
	/** Underlying-asset balance currently sitting idle in the vault. */
	idleBalance(): Promise<bigint> {
		return this.assetBalance(this.address);
	}

	/** Build the `idData` blob for cap-related actions. */
	idData(type: IdType, ...args: string[]): string {
		// @ts-expect-error — variadic forwarding to overloaded `buildIdData`
		return buildIdData(type, ...args);
	}

	// ====================================================================
	// WRITES — OWNER (no timelock)
	// ====================================================================

	setOwner(newOwner: string): Promise<ethers.TransactionResponse> {
		return executeContractMethod(this.contract, "setOwner", newOwner);
	}
	setCurator(newCurator: string): Promise<ethers.TransactionResponse> {
		return executeContractMethod(this.contract, "setCurator", newCurator);
	}
	setIsSentinel(account: string, is: boolean): Promise<ethers.TransactionResponse> {
		return executeContractMethod(this.contract, "setIsSentinel", account, is);
	}
	setName(newName: string): Promise<ethers.TransactionResponse> {
		return executeContractMethod(this.contract, "setName", newName);
	}
	setSymbol(newSymbol: string): Promise<ethers.TransactionResponse> {
		return executeContractMethod(this.contract, "setSymbol", newSymbol);
	}
	/** Set name + symbol in a single tx via multicall. */
	setNameAndSymbol(newName: string, newSymbol: string) {
		return this.multicall([
			Actions.owner.setName(newName),
			Actions.owner.setSymbol(newSymbol),
		]);
	}

	// ====================================================================
	// WRITES — CURATOR (timelocked: triplet submit / execute / instant)
	//
	// Convention:
	//   submitX(...)  → schedules the call
	//   X(...)        → executes (after the timelock has expired)
	//   instantX(...) → submit + execute via multicall (timelock must be 0)
	// ====================================================================

	// ----- generic timelock primitives -----
	/** Submit any pre-encoded calldata for timelock. */
	submit(data: string): Promise<ethers.TransactionResponse> {
		return executeContractMethod(this.contract, "submit", data);
	}
	/** Revoke a pending timelocked submission. */
	revoke(data: string): Promise<ethers.TransactionResponse> {
		return executeContractMethod(this.contract, "revoke", data);
	}

	// ----- ADAPTERS -----
	submitAddAdapter(adapter: string) {
		return this.submit(Actions.curator.addAdapter(adapter));
	}
	addAdapter(adapter: string) {
		return executeContractMethod(this.contract, "addAdapter", adapter);
	}
	instantAddAdapter(adapter: string) {
		return this.multicall([Actions.curator.instantAddAdapter(adapter)]);
	}

	submitRemoveAdapter(adapter: string) {
		return this.submit(Actions.curator.removeAdapter(adapter));
	}
	removeAdapter(adapter: string) {
		return executeContractMethod(this.contract, "removeAdapter", adapter);
	}
	instantRemoveAdapter(adapter: string) {
		return this.multicall([Actions.curator.instantRemoveAdapter(adapter)]);
	}

	// ----- CAPS -----
	submitIncreaseAbsoluteCap(idData: string, cap: bigint) {
		return this.submit(Actions.curator.increaseAbsoluteCap(idData, cap));
	}
	increaseAbsoluteCap(idData: string, cap: bigint) {
		return executeContractMethod(this.contract, "increaseAbsoluteCap", idData, cap);
	}
	instantIncreaseAbsoluteCap(idData: string, cap: bigint) {
		return this.multicall([Actions.curator.instantIncreaseAbsoluteCap(idData, cap)]);
	}
	/** Decrease is callable by curator OR sentinel without timelock. */
	decreaseAbsoluteCap(idData: string, cap: bigint) {
		return executeContractMethod(this.contract, "decreaseAbsoluteCap", idData, cap);
	}

	submitIncreaseRelativeCap(idData: string, cap: bigint) {
		return this.submit(Actions.curator.increaseRelativeCap(idData, cap));
	}
	increaseRelativeCap(idData: string, cap: bigint) {
		return executeContractMethod(this.contract, "increaseRelativeCap", idData, cap);
	}
	instantIncreaseRelativeCap(idData: string, cap: bigint) {
		return this.multicall([Actions.curator.instantIncreaseRelativeCap(idData, cap)]);
	}
	/** Decrease is callable by curator OR sentinel without timelock. */
	decreaseRelativeCap(idData: string, cap: bigint) {
		return executeContractMethod(this.contract, "decreaseRelativeCap", idData, cap);
	}

	// ----- ALLOCATOR ROLE (set by curator) -----
	submitSetIsAllocator(account: string, is: boolean) {
		return this.submit(Actions.curator.setIsAllocator(account, is));
	}
	setIsAllocator(account: string, is: boolean) {
		return executeContractMethod(this.contract, "setIsAllocator", account, is);
	}
	instantSetIsAllocator(account: string, is: boolean) {
		return this.multicall([Actions.curator.instantSetIsAllocator(account, is)]);
	}

	// ----- GATES -----
	submitSetReceiveSharesGate(gate: string) {
		return this.submit(Actions.curator.setReceiveSharesGate(gate));
	}
	setReceiveSharesGate(gate: string) {
		return executeContractMethod(this.contract, "setReceiveSharesGate", gate);
	}
	instantSetReceiveSharesGate(gate: string) {
		return this.multicall([Actions.curator.instantSetReceiveSharesGate(gate)]);
	}

	submitSetSendSharesGate(gate: string) {
		return this.submit(Actions.curator.setSendSharesGate(gate));
	}
	setSendSharesGate(gate: string) {
		return executeContractMethod(this.contract, "setSendSharesGate", gate);
	}
	instantSetSendSharesGate(gate: string) {
		return this.multicall([Actions.curator.instantSetSendSharesGate(gate)]);
	}

	submitSetReceiveAssetsGate(gate: string) {
		return this.submit(Actions.curator.setReceiveAssetsGate(gate));
	}
	setReceiveAssetsGate(gate: string) {
		return executeContractMethod(this.contract, "setReceiveAssetsGate", gate);
	}
	instantSetReceiveAssetsGate(gate: string) {
		return this.multicall([Actions.curator.instantSetReceiveAssetsGate(gate)]);
	}

	submitSetSendAssetsGate(gate: string) {
		return this.submit(Actions.curator.setSendAssetsGate(gate));
	}
	setSendAssetsGate(gate: string) {
		return executeContractMethod(this.contract, "setSendAssetsGate", gate);
	}
	instantSetSendAssetsGate(gate: string) {
		return this.multicall([Actions.curator.instantSetSendAssetsGate(gate)]);
	}

	// ----- ADAPTER REGISTRY -----
	submitSetAdapterRegistry(registry: string) {
		return this.submit(Actions.curator.setAdapterRegistry(registry));
	}
	setAdapterRegistry(registry: string) {
		return executeContractMethod(this.contract, "setAdapterRegistry", registry);
	}
	instantSetAdapterRegistry(registry: string) {
		return this.multicall([Actions.curator.instantSetAdapterRegistry(registry)]);
	}

	// ----- FEES -----
	submitSetPerformanceFee(fee: bigint) {
		return this.submit(Actions.curator.setPerformanceFee(fee));
	}
	setPerformanceFee(fee: bigint) {
		return executeContractMethod(this.contract, "setPerformanceFee", fee);
	}
	instantSetPerformanceFee(fee: bigint) {
		return this.multicall([Actions.curator.instantSetPerformanceFee(fee)]);
	}

	submitSetManagementFee(fee: bigint) {
		return this.submit(Actions.curator.setManagementFee(fee));
	}
	setManagementFee(fee: bigint) {
		return executeContractMethod(this.contract, "setManagementFee", fee);
	}
	instantSetManagementFee(fee: bigint) {
		return this.multicall([Actions.curator.instantSetManagementFee(fee)]);
	}

	submitSetPerformanceFeeRecipient(r: string) {
		return this.submit(Actions.curator.setPerformanceFeeRecipient(r));
	}
	setPerformanceFeeRecipient(r: string) {
		return executeContractMethod(this.contract, "setPerformanceFeeRecipient", r);
	}
	instantSetPerformanceFeeRecipient(r: string) {
		return this.multicall([Actions.curator.instantSetPerformanceFeeRecipient(r)]);
	}

	submitSetManagementFeeRecipient(r: string) {
		return this.submit(Actions.curator.setManagementFeeRecipient(r));
	}
	setManagementFeeRecipient(r: string) {
		return executeContractMethod(this.contract, "setManagementFeeRecipient", r);
	}
	instantSetManagementFeeRecipient(r: string) {
		return this.multicall([Actions.curator.instantSetManagementFeeRecipient(r)]);
	}

	submitSetForceDeallocatePenalty(adapter: string, penalty: bigint) {
		return this.submit(Actions.curator.setForceDeallocatePenalty(adapter, penalty));
	}
	setForceDeallocatePenalty(adapter: string, penalty: bigint) {
		return executeContractMethod(this.contract, "setForceDeallocatePenalty", adapter, penalty);
	}
	instantSetForceDeallocatePenalty(adapter: string, penalty: bigint) {
		return this.multicall([
			Actions.curator.instantSetForceDeallocatePenalty(adapter, penalty),
		]);
	}

	// ----- TIMELOCK MGMT -----
	submitIncreaseTimelock(fn: TimelockFunction, duration: bigint) {
		return this.submit(Actions.curator.increaseTimelock(fn, duration));
	}
	increaseTimelock(fn: TimelockFunction, duration: bigint) {
		return executeContractMethod(
			this.contract,
			"increaseTimelock",
			timelockSelector(fn),
			duration,
		);
	}
	instantIncreaseTimelock(fn: TimelockFunction, duration: bigint) {
		return this.multicall([Actions.curator.instantIncreaseTimelock(fn, duration)]);
	}

	submitDecreaseTimelock(fn: TimelockFunction, duration: bigint) {
		return this.submit(Actions.curator.decreaseTimelock(fn, duration));
	}
	decreaseTimelock(fn: TimelockFunction, duration: bigint) {
		return executeContractMethod(
			this.contract,
			"decreaseTimelock",
			timelockSelector(fn),
			duration,
		);
	}
	instantDecreaseTimelock(fn: TimelockFunction, duration: bigint) {
		return this.multicall([Actions.curator.instantDecreaseTimelock(fn, duration)]);
	}

	submitAbdicate(fn: TimelockFunction) {
		return this.submit(Actions.curator.abdicate(fn));
	}
	abdicate(fn: TimelockFunction) {
		return executeContractMethod(this.contract, "abdicate", timelockSelector(fn));
	}

	// ====================================================================
	// WRITES — ALLOCATOR
	// ====================================================================

	allocate(adapter: string, data: string, assets: bigint) {
		return executeContractMethod(this.contract, "allocate", adapter, data, assets);
	}
	deallocate(adapter: string, data: string, assets: bigint) {
		return executeContractMethod(this.contract, "deallocate", adapter, data, assets);
	}
	setLiquidityAdapterAndData(adapter: string, data: string) {
		return executeContractMethod(this.contract, "setLiquidityAdapterAndData", adapter, data);
	}
	setMaxRate(rate: bigint) {
		return executeContractMethod(this.contract, "setMaxRate", rate);
	}

	// ====================================================================
	// WRITES — USER
	// ====================================================================

	deposit(assets: bigint, onBehalf: string) {
		return executeContractMethod(this.contract, "deposit", assets, onBehalf);
	}
	mint(shares: bigint, onBehalf: string) {
		return executeContractMethod(this.contract, "mint", shares, onBehalf);
	}
	withdraw(assets: bigint, receiver: string, onBehalf: string) {
		return executeContractMethod(this.contract, "withdraw", assets, receiver, onBehalf);
	}
	redeem(shares: bigint, receiver: string, onBehalf: string) {
		return executeContractMethod(this.contract, "redeem", shares, receiver, onBehalf);
	}
	transfer(to: string, shares: bigint) {
		return executeContractMethod(this.contract, "transfer", to, shares);
	}
	transferFrom(from: string, to: string, shares: bigint) {
		return executeContractMethod(this.contract, "transferFrom", from, to, shares);
	}
	approve(spender: string, shares: bigint) {
		return executeContractMethod(this.contract, "approve", spender, shares);
	}
	permit(
		owner: string,
		spender: string,
		shares: bigint,
		deadline: bigint,
		v: number,
		r: string,
		s: string,
	) {
		return executeContractMethod(
			this.contract,
			"permit",
			owner,
			spender,
			shares,
			deadline,
			v,
			r,
			s,
		);
	}
	forceDeallocate(adapter: string, data: string, assets: bigint, onBehalf: string) {
		return executeContractMethod(
			this.contract,
			"forceDeallocate",
			adapter,
			data,
			assets,
			onBehalf,
		);
	}
	accrueInterest() {
		return executeContractMethod(this.contract, "accrueInterest");
	}

	/**
	 * Approve the underlying asset to be spent by the vault.
	 * Convenience helper: targets the asset contract, not the vault.
	 */
	async approveAsset(amount: bigint): Promise<ethers.TransactionResponse> {
		const assetAddr = await this.asset();
		const token = new Contract(assetAddr, ERC20_MIN_ABI, this.runner);
		return executeContractMethod(token, "approve", this.address, amount);
	}
}
