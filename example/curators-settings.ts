import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, parseEther, parseUnits } from "ethers";
import { fullReading, RPC_URL, MNEMONIC } from "./utils/toolbox";
import { TimelockFunction } from "../src/clients/curators";
import { setupCuratorsSettings } from "./utils/curator";

// Base vault configuration shared by all vault types
interface BaseVaultConfig {
  address: string; // Address of the underlying vault or market
  deallocate_penalty?: bigint; // 100% = 1e18, max 2% -> 0.02e18 (per adapter)

  // New structure for caps per ID
  caps_per_id?: {
    id?: string; // If don't specify, we take the first ID from the adapter
    relative_cap?: bigint; // 100% = 1e18, max 100% -> 1e18
    absolute_cap?: bigint;
  }[];
}

// Vault configuration for non-CompoundV3 types (comet_rewards is optional)
interface NonCompoundV3VaultConfig extends BaseVaultConfig {
  type: "erc4626" | "erc4626Merkl" | "morphoMarketV1";
  comet_rewards?: string; // Optional for non-CompoundV3 adapters
}

// Vault configuration for CompoundV3 type (comet_rewards is required)
interface CompoundV3VaultConfig extends BaseVaultConfig {
  type: "compoundV3";
  comet_rewards: string; // Required for compoundV3 adapters
}

// Union type for all vault configurations
type VaultConfig = NonCompoundV3VaultConfig | CompoundV3VaultConfig;

export interface CuratorsSettingsConfig {
  allocators?: string[]; // Might have multiple allocators

  performance_fee?: bigint; // 100% = 1e18, max 50% -> 0.5e18
  management_fee?: bigint; // 100% = 1e18, max 5%/year -> 0.05e18/31_536_000 = 1.3698630136986301e15
  performance_fee_recipient?: string;
  management_fee_recipient?: string;

  underlying_vaults?: VaultConfig[];

  timelockFunctionsToIncrease?: Partial<Record<TimelockFunction, number>>;
}

//*******************************************************************
//*  This is what you need to change to create a vault              *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const VAULT_ADDRESS = "0x7CEC59FFde9434bD1e68F3527da2Ed6aA840FA73";

const CURATORS_SETTINGS_CONFIG: CuratorsSettingsConfig = {
  allocators: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],

  performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
  management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
  performance_fee: parseUnits("0.03", 18), // 5%
  management_fee: parseUnits("0", 18) / 31536000n, // 5% / year

  underlying_vaults: [
    {
      address: "0xb125E6687d4313864e53df431d5425969c15Eb2F", // Compound base
      comet_rewards: "0x123964802e6ABabBE1Bc9547D72Ef1B69B00A6b1",
      type: "compoundV3",
      deallocate_penalty: parseEther("0.01"),
      caps_per_id: [
        {
          relative_cap: parseUnits("1", 18), // 100%
          absolute_cap: parseUnits("200", 6), // 200 USDC
        },
      ],
    },
    // {
    //   address: "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A", // AAVE stata vault
    //   type: "erc4626",
    //   // deallocate_penalty: parseEther("0.015"),
    //   caps_per_id: [
    //     {
    //       relative_cap: parseUnits("1", 18), // 100%
    //       // absolute_cap: parseUnits("500", 6), // 200 USDC
    //     },
    //   ],
    // },
    // {
    //   address: "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A",
    //   type: "erc4626",
    //   // deallocate_penalty: parseEther("0.02"),
    //   caps_per_id: [
    //     {
    //       relative_cap: parseUnits("1", 18), // 100%
    //       // absolute_cap: parseUnits("550", 6), // 800 USDC
    //     },
    //   ],
    // },
    // {
    //   address: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738", // Seamless Morpho vault
    //   type: "erc4626",
    //   deallocate_penalty: parseEther("0.02"),
    //   caps_per_id: [
    //     {
    //       // id: "0x6feb657053c1e6004f89bb249621bde61a42536e87fdcdf6e5cc01e5f867ff8b", // ID from Adapter 1
    //       relative_cap: parseUnits("0.4", 18), // 30%
    //       absolute_cap: parseUnits("300", 6), // 300 USDC
    //     },
    //   ],
    // },
  ],

  // timelockFunctionsToIncrease: {
  //   setSharesGate: 3600,
  //   setReceiveAssetsGate: 3600,
  //   setSendAssetsGate: 3600,
  //   setPerformanceFee: 3600,
  //   setPerformanceFeeRecipient: 3600,
  //   setManagementFee: 3600,
  //   setManagementFeeRecipient: 3600,
  //   setMaxRate: 3600,
  //   setForceDeallocatePenalty: 3600,
  // },
};

async function main() {
  console.log("Start example to set curator settings of a vault");
  try {
    // ****************
    // Setup the test
    // ****************
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    // await fullReading(client, VAULT_ADDRESS, userAddress);

    await setupCuratorsSettings(
      client,
      VAULT_ADDRESS,
      userAddress,
      CURATORS_SETTINGS_CONFIG
    );

    await fullReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error setting curator settings of a vault:", error);
  } finally {
  }
}

main();
