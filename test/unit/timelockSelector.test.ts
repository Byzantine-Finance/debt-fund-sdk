import { Interface } from "ethers";
import { describe, expect, it } from "vitest";
import { type TimelockFunction, timelockSelector } from "../../src/actions";
import { VAULT_ABI } from "../../src/constants";

const I = new Interface(VAULT_ABI);

const ALL: TimelockFunction[] = [
	"abdicate",
	"addAdapter",
	"removeAdapter",
	"increaseTimelock",
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

describe("timelockSelector", () => {
	it("returns 4-byte selectors", () => {
		for (const fn of ALL) {
			const sel = timelockSelector(fn);
			expect(sel).toMatch(/^0x[0-9a-f]{8}$/);
		}
	});

	it("matches the actual contract function selectors", () => {
		for (const fn of ALL) {
			const sel = timelockSelector(fn);
			const fragment = I.getFunction(fn);
			expect(fragment).not.toBeNull();
			// `fragment.selector` matches `bytes4(keccak256(signature))` per ethers v6.
			expect(sel).toBe(fragment?.selector);
		}
	});

	it("known anchor: addAdapter == 0x60d54d41", () => {
		expect(timelockSelector("addAdapter")).toBe("0x60d54d41");
	});
});
