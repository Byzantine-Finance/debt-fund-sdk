/**
 * Exhaustive unit tests for the `Actions` namespace.
 *
 * Every calldata builder is checked against `Interface.encodeFunctionData`
 * as ground truth. `instantX` builders are checked against their
 * `[submit(setX), setX]` decomposition.
 */

import { Interface } from "ethers";
import { describe, expect, it } from "vitest";
import { Actions, timelockSelector } from "../../src/actions";
import { VAULT_ABI } from "../../src/constants";
import {
	ADDR_A,
	ADDR_B,
	ADDR_C,
	ADDR_D,
	ID_DATA_ZERO as ID_DATA,
	RAW_DATA,
	SIGNATURE_R,
	SIGNATURE_S,
} from "../_fixtures";

const I = new Interface(VAULT_ABI);
const enc = (fn: string, args: readonly unknown[]) =>
	I.encodeFunctionData(fn, args as unknown[]);

// ============================================================================
// OWNER
// ============================================================================

describe("Actions.owner", () => {
	it("setOwner", () => {
		expect(Actions.owner.setOwner(ADDR_A)).toBe(enc("setOwner", [ADDR_A]));
	});
	it("setCurator", () => {
		expect(Actions.owner.setCurator(ADDR_B)).toBe(enc("setCurator", [ADDR_B]));
	});
	it("setIsSentinel(true)", () => {
		expect(Actions.owner.setIsSentinel(ADDR_A, true)).toBe(
			enc("setIsSentinel", [ADDR_A, true]),
		);
	});
	it("setIsSentinel(false)", () => {
		expect(Actions.owner.setIsSentinel(ADDR_A, false)).toBe(
			enc("setIsSentinel", [ADDR_A, false]),
		);
	});
	it("setName empty string", () => {
		expect(Actions.owner.setName("")).toBe(enc("setName", [""]));
	});
	it("setName unicode string", () => {
		expect(Actions.owner.setName("Byzantine 🚀")).toBe(
			enc("setName", ["Byzantine 🚀"]),
		);
	});
	it("setSymbol", () => {
		expect(Actions.owner.setSymbol("BYZ")).toBe(enc("setSymbol", ["BYZ"]));
	});
});

// ============================================================================
// CURATOR — primitives + setters
// ============================================================================

describe("Actions.curator — primitives", () => {
	it("submit wraps any inner calldata", () => {
		const inner = enc("addAdapter", [ADDR_A]);
		expect(Actions.curator.submit(inner)).toBe(enc("submit", [inner]));
	});
	it("submit on raw bytes", () => {
		expect(Actions.curator.submit(RAW_DATA)).toBe(enc("submit", [RAW_DATA]));
	});
	it("revoke", () => {
		expect(Actions.curator.revoke(RAW_DATA)).toBe(enc("revoke", [RAW_DATA]));
	});
});

describe("Actions.curator — adapters", () => {
	it("addAdapter", () => {
		expect(Actions.curator.addAdapter(ADDR_A)).toBe(
			enc("addAdapter", [ADDR_A]),
		);
	});
	it("removeAdapter", () => {
		expect(Actions.curator.removeAdapter(ADDR_A)).toBe(
			enc("removeAdapter", [ADDR_A]),
		);
	});
});

describe("Actions.curator — caps", () => {
	it("increaseAbsoluteCap", () => {
		expect(Actions.curator.increaseAbsoluteCap(ID_DATA, 1000n)).toBe(
			enc("increaseAbsoluteCap", [ID_DATA, 1000n]),
		);
	});
	it("decreaseAbsoluteCap", () => {
		expect(Actions.curator.decreaseAbsoluteCap(ID_DATA, 500n)).toBe(
			enc("decreaseAbsoluteCap", [ID_DATA, 500n]),
		);
	});
	it("increaseRelativeCap (100% = 1e18)", () => {
		expect(Actions.curator.increaseRelativeCap(ID_DATA, 10n ** 18n)).toBe(
			enc("increaseRelativeCap", [ID_DATA, 10n ** 18n]),
		);
	});
	it("decreaseRelativeCap (10% = 1e17)", () => {
		expect(Actions.curator.decreaseRelativeCap(ID_DATA, 10n ** 17n)).toBe(
			enc("decreaseRelativeCap", [ID_DATA, 10n ** 17n]),
		);
	});
});

describe("Actions.curator — roles", () => {
	it("setIsAllocator(true)", () => {
		expect(Actions.curator.setIsAllocator(ADDR_A, true)).toBe(
			enc("setIsAllocator", [ADDR_A, true]),
		);
	});
	it("setIsAllocator(false)", () => {
		expect(Actions.curator.setIsAllocator(ADDR_A, false)).toBe(
			enc("setIsAllocator", [ADDR_A, false]),
		);
	});
});

describe("Actions.curator — gates (4 gates)", () => {
	it.each([
		["setReceiveSharesGate", Actions.curator.setReceiveSharesGate],
		["setSendSharesGate", Actions.curator.setSendSharesGate],
		["setReceiveAssetsGate", Actions.curator.setReceiveAssetsGate],
		["setSendAssetsGate", Actions.curator.setSendAssetsGate],
	] as const)("%s encodes correctly", (fn, builder) => {
		expect(builder(ADDR_A)).toBe(enc(fn, [ADDR_A]));
	});

	it("supports the zero-address sentinel meaning 'unset gate'", () => {
		const ZERO = "0x0000000000000000000000000000000000000000";
		expect(Actions.curator.setReceiveSharesGate(ZERO)).toBe(
			enc("setReceiveSharesGate", [ZERO]),
		);
	});
});

describe("Actions.curator — adapter registry", () => {
	it("setAdapterRegistry", () => {
		expect(Actions.curator.setAdapterRegistry(ADDR_A)).toBe(
			enc("setAdapterRegistry", [ADDR_A]),
		);
	});
});

describe("Actions.curator — fees", () => {
	it("setPerformanceFee 0", () => {
		expect(Actions.curator.setPerformanceFee(0n)).toBe(
			enc("setPerformanceFee", [0n]),
		);
	});
	it("setPerformanceFee 5%", () => {
		expect(Actions.curator.setPerformanceFee(5n * 10n ** 16n)).toBe(
			enc("setPerformanceFee", [5n * 10n ** 16n]),
		);
	});
	it("setManagementFee", () => {
		expect(Actions.curator.setManagementFee(1234567n)).toBe(
			enc("setManagementFee", [1234567n]),
		);
	});
	it("setPerformanceFeeRecipient", () => {
		expect(Actions.curator.setPerformanceFeeRecipient(ADDR_A)).toBe(
			enc("setPerformanceFeeRecipient", [ADDR_A]),
		);
	});
	it("setManagementFeeRecipient", () => {
		expect(Actions.curator.setManagementFeeRecipient(ADDR_B)).toBe(
			enc("setManagementFeeRecipient", [ADDR_B]),
		);
	});
	it("setForceDeallocatePenalty", () => {
		expect(Actions.curator.setForceDeallocatePenalty(ADDR_A, 10n ** 16n)).toBe(
			enc("setForceDeallocatePenalty", [ADDR_A, 10n ** 16n]),
		);
	});
});

describe("Actions.curator — timelock management", () => {
	it("increaseTimelock uses the right selector", () => {
		const sel = timelockSelector("addAdapter");
		expect(Actions.curator.increaseTimelock("addAdapter", 3600n)).toBe(
			enc("increaseTimelock", [sel, 3600n]),
		);
	});
	it("decreaseTimelock uses the right selector", () => {
		const sel = timelockSelector("setPerformanceFee");
		expect(Actions.curator.decreaseTimelock("setPerformanceFee", 1800n)).toBe(
			enc("decreaseTimelock", [sel, 1800n]),
		);
	});
	it("abdicate uses the right selector", () => {
		const sel = timelockSelector("setReceiveSharesGate");
		expect(Actions.curator.abdicate("setReceiveSharesGate")).toBe(
			enc("abdicate", [sel]),
		);
	});
});

// ============================================================================
// CURATOR — instant tuples
// ============================================================================

describe("Actions.curator — instant* always returns [submit, set]", () => {
	const checkInstant = (
		tuple: readonly string[],
		expectedSetCalldata: string,
	) => {
		expect(tuple).toHaveLength(2);
		expect(tuple[1]).toBe(expectedSetCalldata);
		expect(tuple[0]).toBe(enc("submit", [expectedSetCalldata]));
	};

	it("instantAddAdapter", () => {
		checkInstant(
			Actions.curator.instantAddAdapter(ADDR_A),
			enc("addAdapter", [ADDR_A]),
		);
	});
	it("instantRemoveAdapter", () => {
		checkInstant(
			Actions.curator.instantRemoveAdapter(ADDR_A),
			enc("removeAdapter", [ADDR_A]),
		);
	});
	it("instantIncreaseAbsoluteCap", () => {
		checkInstant(
			Actions.curator.instantIncreaseAbsoluteCap(ID_DATA, 100n),
			enc("increaseAbsoluteCap", [ID_DATA, 100n]),
		);
	});
	it("instantIncreaseRelativeCap", () => {
		checkInstant(
			Actions.curator.instantIncreaseRelativeCap(ID_DATA, 10n ** 18n),
			enc("increaseRelativeCap", [ID_DATA, 10n ** 18n]),
		);
	});
	it("instantSetIsAllocator", () => {
		checkInstant(
			Actions.curator.instantSetIsAllocator(ADDR_A, true),
			enc("setIsAllocator", [ADDR_A, true]),
		);
	});
	it.each([
		[
			"instantSetReceiveSharesGate",
			Actions.curator.instantSetReceiveSharesGate,
			"setReceiveSharesGate",
		],
		[
			"instantSetSendSharesGate",
			Actions.curator.instantSetSendSharesGate,
			"setSendSharesGate",
		],
		[
			"instantSetReceiveAssetsGate",
			Actions.curator.instantSetReceiveAssetsGate,
			"setReceiveAssetsGate",
		],
		[
			"instantSetSendAssetsGate",
			Actions.curator.instantSetSendAssetsGate,
			"setSendAssetsGate",
		],
	] as const)("%s", (_label, builder, fn) => {
		checkInstant(builder(ADDR_A), enc(fn, [ADDR_A]));
	});
	it("instantSetAdapterRegistry", () => {
		checkInstant(
			Actions.curator.instantSetAdapterRegistry(ADDR_A),
			enc("setAdapterRegistry", [ADDR_A]),
		);
	});
	it("instantSetPerformanceFee", () => {
		checkInstant(
			Actions.curator.instantSetPerformanceFee(10n ** 17n),
			enc("setPerformanceFee", [10n ** 17n]),
		);
	});
	it("instantSetManagementFee", () => {
		checkInstant(
			Actions.curator.instantSetManagementFee(123n),
			enc("setManagementFee", [123n]),
		);
	});
	it("instantSetPerformanceFeeRecipient", () => {
		checkInstant(
			Actions.curator.instantSetPerformanceFeeRecipient(ADDR_C),
			enc("setPerformanceFeeRecipient", [ADDR_C]),
		);
	});
	it("instantSetManagementFeeRecipient", () => {
		checkInstant(
			Actions.curator.instantSetManagementFeeRecipient(ADDR_D),
			enc("setManagementFeeRecipient", [ADDR_D]),
		);
	});
	it("instantSetForceDeallocatePenalty", () => {
		checkInstant(
			Actions.curator.instantSetForceDeallocatePenalty(ADDR_A, 100n),
			enc("setForceDeallocatePenalty", [ADDR_A, 100n]),
		);
	});
	it("instantIncreaseTimelock", () => {
		const sel = timelockSelector("setIsAllocator");
		checkInstant(
			Actions.curator.instantIncreaseTimelock("setIsAllocator", 3600n),
			enc("increaseTimelock", [sel, 3600n]),
		);
	});
	it("instantDecreaseTimelock", () => {
		const sel = timelockSelector("setIsAllocator");
		checkInstant(
			Actions.curator.instantDecreaseTimelock("setIsAllocator", 1800n),
			enc("decreaseTimelock", [sel, 1800n]),
		);
	});
});

// ============================================================================
// ALLOCATOR
// ============================================================================

describe("Actions.allocator", () => {
	it("allocate with empty data", () => {
		expect(Actions.allocator.allocate(ADDR_A, "0x", 100n)).toBe(
			enc("allocate", [ADDR_A, "0x", 100n]),
		);
	});
	it("allocate with non-empty data", () => {
		expect(Actions.allocator.allocate(ADDR_A, RAW_DATA, 100n)).toBe(
			enc("allocate", [ADDR_A, RAW_DATA, 100n]),
		);
	});
	it("deallocate", () => {
		expect(Actions.allocator.deallocate(ADDR_A, "0x", 200n)).toBe(
			enc("deallocate", [ADDR_A, "0x", 200n]),
		);
	});
	it("setLiquidityAdapterAndData", () => {
		expect(Actions.allocator.setLiquidityAdapterAndData(ADDR_A, "0x")).toBe(
			enc("setLiquidityAdapterAndData", [ADDR_A, "0x"]),
		);
	});
	it("setMaxRate", () => {
		expect(Actions.allocator.setMaxRate(0n)).toBe(enc("setMaxRate", [0n]));
		expect(Actions.allocator.setMaxRate(1234567n)).toBe(
			enc("setMaxRate", [1234567n]),
		);
	});
});

// ============================================================================
// USER
// ============================================================================

describe("Actions.user — deposit / mint / withdraw / redeem", () => {
	it("deposit", () => {
		expect(Actions.user.deposit(100n, ADDR_A)).toBe(
			enc("deposit", [100n, ADDR_A]),
		);
	});
	it("mint", () => {
		expect(Actions.user.mint(50n, ADDR_A)).toBe(enc("mint", [50n, ADDR_A]));
	});
	it("withdraw", () => {
		expect(Actions.user.withdraw(10n, ADDR_A, ADDR_B)).toBe(
			enc("withdraw", [10n, ADDR_A, ADDR_B]),
		);
	});
	it("redeem", () => {
		expect(Actions.user.redeem(5n, ADDR_A, ADDR_B)).toBe(
			enc("redeem", [5n, ADDR_A, ADDR_B]),
		);
	});
	it("withdraw allows receiver != onBehalf", () => {
		expect(Actions.user.withdraw(1n, ADDR_C, ADDR_D)).toBe(
			enc("withdraw", [1n, ADDR_C, ADDR_D]),
		);
	});
});

describe("Actions.user — ERC20", () => {
	it("transfer", () => {
		expect(Actions.user.transfer(ADDR_A, 1n)).toBe(
			enc("transfer", [ADDR_A, 1n]),
		);
	});
	it("transferFrom", () => {
		expect(Actions.user.transferFrom(ADDR_A, ADDR_B, 2n)).toBe(
			enc("transferFrom", [ADDR_A, ADDR_B, 2n]),
		);
	});
	it("approve", () => {
		expect(Actions.user.approve(ADDR_A, 3n)).toBe(enc("approve", [ADDR_A, 3n]));
	});
	it("approve max uint256", () => {
		const MAX = (1n << 256n) - 1n;
		expect(Actions.user.approve(ADDR_A, MAX)).toBe(
			enc("approve", [ADDR_A, MAX]),
		);
	});
});

describe("Actions.user — permit", () => {
	it("permit", () => {
		const expected = enc("permit", [
			ADDR_A,
			ADDR_B,
			100n,
			1_700_000_000n,
			27,
			SIGNATURE_R,
			SIGNATURE_S,
		]);
		expect(
			Actions.user.permit(
				ADDR_A,
				ADDR_B,
				100n,
				1_700_000_000n,
				27,
				SIGNATURE_R,
				SIGNATURE_S,
			),
		).toBe(expected);
	});
});

describe("Actions.user — misc", () => {
	it("forceDeallocate with empty data", () => {
		expect(Actions.user.forceDeallocate(ADDR_A, "0x", 10n, ADDR_B)).toBe(
			enc("forceDeallocate", [ADDR_A, "0x", 10n, ADDR_B]),
		);
	});
	it("forceDeallocate with payload", () => {
		expect(Actions.user.forceDeallocate(ADDR_A, RAW_DATA, 10n, ADDR_B)).toBe(
			enc("forceDeallocate", [ADDR_A, RAW_DATA, 10n, ADDR_B]),
		);
	});
	it("accrueInterest takes no args", () => {
		expect(Actions.user.accrueInterest()).toBe(enc("accrueInterest", []));
	});
});

// ============================================================================
// Determinism + isolation
// ============================================================================

describe("Actions — determinism", () => {
	it("same input → same calldata", () => {
		expect(Actions.owner.setName("X")).toBe(Actions.owner.setName("X"));
		expect(Actions.curator.addAdapter(ADDR_A)).toBe(
			Actions.curator.addAdapter(ADDR_A),
		);
	});
	it("different input → different calldata", () => {
		expect(Actions.owner.setName("X")).not.toBe(Actions.owner.setName("Y"));
		expect(Actions.curator.addAdapter(ADDR_A)).not.toBe(
			Actions.curator.addAdapter(ADDR_B),
		);
	});
});

describe("Actions — every output is a valid 0x-prefixed hex calldata", () => {
	it("calldata format check on a representative sample", () => {
		const samples: string[] = [
			Actions.owner.setName("X"),
			Actions.curator.addAdapter(ADDR_A),
			Actions.allocator.setMaxRate(0n),
			Actions.user.deposit(1n, ADDR_A),
		];
		for (const cd of samples) {
			expect(cd).toMatch(/^0x[0-9a-f]+$/);
			// At least selector (4 bytes = 8 hex chars + "0x").
			expect(cd.length).toBeGreaterThanOrEqual(10);
		}
	});
});
