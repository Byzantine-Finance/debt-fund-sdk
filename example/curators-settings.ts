import { ByzantineClient } from "../src/clients/ByzantineClient";
import { AbiCoder, ethers, parseEther, parseUnits } from "ethers";
import {
  fullReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
} from "./utils/toolbox";
import { TimelockFunction } from "../src/clients/curators";
import { AdapterType } from "../src/clients/adapters";
import { setupCuratorsSettings } from "./utils/curator";

export interface CuratorsSettingsConfig {
  allocator?: string[]; // Might have multiple allocators

  performance_fee?: bigint; // 100% = 1e18, max 50% -> 0.5e18
  management_fee?: bigint; // 100% = 1e18, max 5%/year -> 0.05e18/31_536_000 = 1.3698630136986301e15
  performance_fee_recipient?: string;
  management_fee_recipient?: string;
  max_rate?: bigint; // 100% = 1e18, max 200%/year -> 200e16/31_536_000 = 6.3493150684931506e12

  underlying_vaults?: {
    address: string; // Address of the underlying vault or market
    comet_rewards?: string; // Comet rewards address (only required for compoundV3 adapters)
    type: AdapterType; // "erc4626" | "erc4626Merkl" | "compoundV3" | "morphoMarketV1"
    deallocate_penalty?: bigint; // 100% = 1e18, max 2% -> 0.02e18 (per adapter)

    // New structure for caps per ID
    caps_per_id?: {
      id?: string; // If don't specify, we take the first ID from the adapter
      relative_cap?: bigint; // 100% = 1e18, max 100% -> 1e18
      absolute_cap?: bigint;
    }[];
  }[];

  timelockFunctionsToIncrease?: Partial<Record<TimelockFunction, number>>;
}

//*******************************************************************
//*  This is what you need to change to create a vault              *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const VAULT_ADDRESS = "0xFC7BbD89c0b8279cDB465869E38Fb9A8e63C516d";

const CURATORS_SETTINGS_CONFIG: CuratorsSettingsConfig = {
  allocator: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],

  performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
  management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // You need to set the address of the recipient before setting the fee
  performance_fee: parseUnits("0.05", 18), // 5%
  management_fee: parseUnits("0.05", 18) / 31536000n, // 5% / year
  max_rate: parseUnits("2", 18) / 31536000n, // 200% / year

  underlying_vaults: [
    {
      address: "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A", // Spark Morpho vault
      type: "erc4626",
      deallocate_penalty: parseEther("0.02"),
      caps_per_id: [
        {
          relative_cap: parseUnits("1", 18), // 100%
          absolute_cap: parseUnits("200", 6), // 800 USDC
        },
      ],
    },
    {
      address: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738", // Seamless Morpho vault
      type: "erc4626",
      deallocate_penalty: parseEther("0.02"),
      caps_per_id: [
        {
          // id: "0x6feb657053c1e6004f89bb249621bde61a42536e87fdcdf6e5cc01e5f867ff8b", // ID from Adapter 1
          relative_cap: parseUnits("0.4", 18), // 30%
          absolute_cap: parseUnits("300", 6), // 300 USDC
        },
      ],
    },
  ],

  timelockFunctionsToIncrease: {
    setSharesGate: 3600,
    setReceiveAssetsGate: 3600,
    setSendAssetsGate: 3600,
    setPerformanceFee: 3600,
    setPerformanceFeeRecipient: 3600,
    setManagementFee: 3600,
    setManagementFeeRecipient: 3600,
    setMaxRate: 3600,
    setForceDeallocatePenalty: 3600,
  },
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

    await fullReading(client, VAULT_ADDRESS, userAddress);

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
