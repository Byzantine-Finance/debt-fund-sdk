import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, parseEther, parseUnits } from "ethers";
import {
  finalReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
} from "./utils-example";
import { TimelockFunction } from "../dist/clients/curators";

interface CuratorsSettingsConfig {
  allocator?: string[]; // Might have multiple allocators

  performance_fee?: bigint; // 100% = 1e18, max 50% -> 0.5e18
  management_fee?: bigint; // 100% = 1e18, max 5%/year -> 0.05e18/31_536_000 = 1.3698630136986301e15
  performance_fee_recipient?: string;
  management_fee_recipient?: string;
  max_rate?: bigint; // 100% = 1e18, max 200%/year -> 200e16/31_536_000 = 6.3493150684931506e12

  underlying_vaults?: {
    address: string; // Address of the underlying vault, or the adapter if needs_adapter is false
    type: "Morpho" | "Aave" | "Euler" | "Compound"; // Because we need to select the right adapter
    needs_adapter: boolean; // If true, we will create the adapter and use it, if no, it means the address is already the vault
    relative_cap?: bigint; // 100% = 1e18, max 100% -> 1e18
    absolute_cap?: bigint;
    deallocate_penalty?: bigint; // 100% = 1e18, max 2% -> 0.02e18
  }[];

  timelockFunctionsToIncrease: Partial<Record<TimelockFunction, number>>;
}

//*******************************************************************
//*  This is what you need to change to create a vault              *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const VAULT_ADDRESS = "0xfaEff874FC56Ba84280855a7cd33bce79D8C5a10";

const CURATORS_SETTINGS_CONFIG: CuratorsSettingsConfig = {
  allocator: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],

  performance_fee: parseUnits("0.05", 18), // 5%
  management_fee: parseUnits("0.05", 18), // 5%
  performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  max_rate: parseUnits("200", 18), // 200%

  underlying_vaults: [
    {
      address: "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A", // Spark Morpho vault
      type: "Morpho",
      needs_adapter: true,
      relative_cap: parseUnits("0.5", 18), // 50%
      absolute_cap: parseUnits("800", 6), // 800 USDC
      deallocate_penalty: parseEther("0.02"),
    },
    // {
    //   address: "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738", // Seamless Morpho vault
    //   type: "Morpho",
    //   needs_adapter: true,
    //   relative_cap: parseUnits("0.3", 18), // 30%
    //   absolute_cap: parseUnits("300", 6), // 300 USDC
    //   deallocate_penalty: parseEther("0.02"),
    // },
    // {
    //   address: "0xC768c589647798a6EE01A91FdE98EF2ed046DBD6", // AAVE stata vault
    //   type: "Aave",
    //   needs_adapter: true,
    //   relative_cap: parseUnits("0.2", 18), // 20%
    //   absolute_cap: parseUnits("200", 6), // 200 USDC
    //   deallocate_penalty: parseEther("0.015"),
    // },
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
  console.log("Start example to create and configure a vault");

  try {
    // ****************
    // Setup the test
    // ****************

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    const curator = await client.getCurator(VAULT_ADDRESS);
    if (curator !== userAddress) {
      console.log("Access denied: only the curator can proceed here.");
      throw new Error("Access denied: only the curator can proceed here.");
    }

    const newAllocators = CURATORS_SETTINGS_CONFIG.allocator;

    if (newAllocators && newAllocators.length > 0) {
      for (const allocator of newAllocators) {
        const tx = await client.setIsAllocator(VAULT_ADDRESS, allocator, true);
        await tx.wait();
        await waitHalfSecond();
        console.log(`Allocator ${allocator} set to true`);
      }
    }

    await finalReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error creating vault:", error);
  }
}

main();
