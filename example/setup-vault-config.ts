import { parseEther, parseUnits } from "ethers";
import { NETWORKS } from "../src/constants/networks";
import type { SetupVaultConfig } from "./utils/vault-config";

/**
 * Vault config shared by `create-vault.ts` (new vault) and
 * `force-config.ts` (re-apply it to a vault that already exists).
 */
export const SETUP_VAULT_CONFIG: SetupVaultConfig = {
	asset: NETWORKS[8453].USDCaddress, // USDC on Base

	deposit_amount: parseUnits("0.5", 6), // 0.5 USDC (USDC has 6 decimals)

	owner_settings: {
		shares_name: `[Test] FYD Byz USD`,
		shares_symbol: "fydByzUSD",
		curator: "0x99a436166706d6DAA00fAcE356dC05eCFf3435a5",
		sentinels: [
			"0x99a436166706d6DAA00fAcE356dC05eCFf3435a5",
			"0xe5b709A14859EdF820347D78E587b1634B0ec771",
		],
	},

	curators_settings: {
		allocators: [
			"0x99a436166706d6DAA00fAcE356dC05eCFf3435a5",
			"0xe5b709A14859EdF820347D78E587b1634B0ec771",
		],

		// performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
		// management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
		// performance_fee: parseUnits("0.05", 18), // 5%
		// management_fee: parseUnits("0.05", 18) / 31536000n, // 5% / year

		underlying_vaults: [
			{
				address: "0xb7f226a02e7a725c2da8e5df4561e0ed5b04e351", // Sandbox USD (SandUSD)
				type: "erc4626Merkl",
				deallocate_penalty: parseEther("0.02"),
				caps_per_id: [
					{
						relative_cap: parseUnits("1", 18), // 100%
						absolute_cap: parseUnits("500000000", 6), // 500M USDC
					},
				],
			},
		],

		gates: {
			receive_shares: "0x0571069D05197A9224F4dcf5Acc70Fe36d360aeE",
			send_shares: "0x81037173c50d1e366b3cf5464Fa6aabDF0775B57",
			receive_assets: "0x1056607Ae3e78CD4AD9560c660F4e6612133FF48",
			send_assets: "0x3b7D3574ebA46F6FC70D22194094A9B1CFB981dF",
		},

		timelockFunctionsToIncrease: {
			// setReceiveAssetsGate: 3 * 24 * 60 * 60, // 3 days
			// setSendAssetsGate: 3 * 24 * 60 * 60, // 3 days
			// setReceiveSharesGate: 3 * 24 * 60 * 60, // 3 days
			// setSendSharesGate: 3 * 24 * 60 * 60, // 3 days
			// addAdapter: 3 * 24 * 60 * 60, // 3 days
			// removeAdapter: 3 * 24 * 60 * 60, // 3 days
		},
	},

	allocator_settings: {
		max_rate: parseUnits("10", 16) / 31536000n, // 10% / year

		setLiquidityAdapterFromUnderlyingVaultAndData: {
			underlyingVault: "0xb7f226a02e7a725c2da8e5df4561e0ed5b04e351",
			liquidityData: "0x",
		},
	},
};
