/**
 * Vault class — interface-level tests that don't need an RPC.
 *
 * The class methods themselves all hit the chain, but we can verify:
 *   - the constructor sets address + contract correctly
 *   - the underlying `Interface` exposes the full Vault V2 ABI surface
 *   - `vault.idData(...)` matches the standalone `idData(...)` helper
 *   - the class shape (method names) matches the documented contract
 */

import { JsonRpcProvider } from "ethers";
import { describe, expect, it } from "vitest";
import { idData } from "../../src/actions";
import { Vault } from "../../src/Vault";

const ADDR = "0x1111111111111111111111111111111111111111";

// A "dead" provider — never makes any network call in these tests; it's
// only used to satisfy the Vault constructor signature.
const provider = new JsonRpcProvider("http://127.0.0.1:0");

describe("Vault constructor", () => {
	it("stores the vault address", () => {
		const v = new Vault(ADDR, provider);
		expect(v.address).toBe(ADDR);
	});

	it("attaches the underlying ethers Contract", () => {
		const v = new Vault(ADDR, provider);
		expect(v.contract).toBeDefined();
		expect(v.contract.target).toBe(ADDR);
	});

	it("the contract's Interface exposes the Vault V2 surface", () => {
		const v = new Vault(ADDR, provider);
		const iface = v.contract.interface;
		// Core ERC4626 surface
		for (const fn of [
			"deposit",
			"mint",
			"withdraw",
			"redeem",
			"totalAssets",
			"totalSupply",
			"asset",
			"decimals",
			"name",
			"symbol",
		]) {
			expect(iface.getFunction(fn), `missing function: ${fn}`).not.toBeNull();
		}
		// Curator-only surface
		for (const fn of [
			"submit",
			"revoke",
			"addAdapter",
			"removeAdapter",
			"increaseAbsoluteCap",
			"decreaseAbsoluteCap",
			"setIsAllocator",
			"abdicate",
			"increaseTimelock",
			"decreaseTimelock",
		]) {
			expect(iface.getFunction(fn), `missing function: ${fn}`).not.toBeNull();
		}
		// Allocator surface
		for (const fn of [
			"allocate",
			"deallocate",
			"setLiquidityAdapterAndData",
			"setMaxRate",
		]) {
			expect(iface.getFunction(fn), `missing function: ${fn}`).not.toBeNull();
		}
		// multicall is a must-have for the SDK's central feature.
		expect(iface.getFunction("multicall")).not.toBeNull();
	});

	it("the contract Interface exposes Vault V2 custom errors", () => {
		const v = new Vault(ADDR, provider);
		const iface = v.contract.interface;
		const expectedErrors = [
			"Unauthorized",
			"AbsoluteCapExceeded",
			"RelativeCapExceeded",
			"TimelockNotExpired",
			"DataNotTimelocked",
			"DataAlreadyPending",
			"FeeTooHigh",
			"MaxRateTooHigh",
			"NotAdapter",
			"PermitDeadlineExpired",
		];
		for (const e of expectedErrors) {
			expect(iface.getError(e), `missing error: ${e}`).not.toBeNull();
		}
	});
});

describe("Vault.idData mirrors the standalone idData helper", () => {
	const v = new Vault(ADDR, provider);
	const adapter = "0x2222222222222222222222222222222222222222";

	it('forwards "this" overload', () => {
		expect(v.idData("this", adapter)).toBe(idData("this", adapter));
	});

	it('forwards "collateralToken" overload', () => {
		const token = "0x3333333333333333333333333333333333333333";
		expect(v.idData("collateralToken", token)).toBe(
			idData("collateralToken", token),
		);
	});

	it('forwards "this/marketParams" overload', () => {
		expect(v.idData("this/marketParams", adapter, "0xdeadbeef")).toBe(
			idData("this/marketParams", adapter, "0xdeadbeef"),
		);
	});
});

describe("Vault — public method surface", () => {
	const v = new Vault(ADDR, provider);

	it.each([
		// reads
		"asset",
		"decimals",
		"name",
		"symbol",
		"owner",
		"curator",
		"totalAssets",
		"totalSupply",
		"virtualShares",
		"maxRate",
		"lastUpdate",
		"balanceOf",
		"allowance",
		"previewDeposit",
		"previewMint",
		"previewWithdraw",
		"previewRedeem",
		"convertToShares",
		"convertToAssets",
		"adaptersLength",
		"adapter",
		"isAdapter",
		"adapterRegistry",
		"absoluteCap",
		"relativeCap",
		"allocation",
		"isAllocator",
		"isSentinel",
		"receiveSharesGate",
		"sendSharesGate",
		"receiveAssetsGate",
		"sendAssetsGate",
		"performanceFee",
		"performanceFeeRecipient",
		"managementFee",
		"managementFeeRecipient",
		"forceDeallocatePenalty",
		"liquidityAdapter",
		"liquidityData",
		"timelock",
		"executableAt",
		"abdicated",
		"assetBalance",
		"assetAllowance",
		"idleBalance",
		"idData",

		// owner
		"setOwner",
		"setCurator",
		"setIsSentinel",
		"setName",
		"setSymbol",
		"setNameAndSymbol",

		// curator generic
		"submit",
		"revoke",

		// curator triplets
		"submitAddAdapter",
		"addAdapter",
		"instantAddAdapter",
		"submitRemoveAdapter",
		"removeAdapter",
		"instantRemoveAdapter",
		"submitIncreaseAbsoluteCap",
		"increaseAbsoluteCap",
		"instantIncreaseAbsoluteCap",
		"decreaseAbsoluteCap",
		"submitIncreaseRelativeCap",
		"increaseRelativeCap",
		"instantIncreaseRelativeCap",
		"decreaseRelativeCap",
		"submitSetIsAllocator",
		"setIsAllocator",
		"instantSetIsAllocator",
		"submitSetReceiveSharesGate",
		"setReceiveSharesGate",
		"instantSetReceiveSharesGate",
		"submitSetSendSharesGate",
		"setSendSharesGate",
		"instantSetSendSharesGate",
		"submitSetReceiveAssetsGate",
		"setReceiveAssetsGate",
		"instantSetReceiveAssetsGate",
		"submitSetSendAssetsGate",
		"setSendAssetsGate",
		"instantSetSendAssetsGate",
		"submitSetAdapterRegistry",
		"setAdapterRegistry",
		"instantSetAdapterRegistry",
		"submitSetPerformanceFee",
		"setPerformanceFee",
		"instantSetPerformanceFee",
		"submitSetManagementFee",
		"setManagementFee",
		"instantSetManagementFee",
		"submitSetPerformanceFeeRecipient",
		"setPerformanceFeeRecipient",
		"instantSetPerformanceFeeRecipient",
		"submitSetManagementFeeRecipient",
		"setManagementFeeRecipient",
		"instantSetManagementFeeRecipient",
		"submitSetForceDeallocatePenalty",
		"setForceDeallocatePenalty",
		"instantSetForceDeallocatePenalty",
		"submitIncreaseTimelock",
		"increaseTimelock",
		"instantIncreaseTimelock",
		"submitDecreaseTimelock",
		"decreaseTimelock",
		"instantDecreaseTimelock",
		"submitAbdicate",
		"abdicate",

		// allocator
		"allocate",
		"deallocate",
		"setLiquidityAdapterAndData",
		"setMaxRate",

		// user
		"deposit",
		"mint",
		"withdraw",
		"redeem",
		"transfer",
		"transferFrom",
		"approve",
		"permit",
		"forceDeallocate",
		"accrueInterest",
		"approveAsset",

		// multicall
		"multicall",
	] as const)("has method %s", (method) => {
		// @ts-expect-error — index access on a class instance
		expect(typeof v[method]).toBe("function");
	});
});
