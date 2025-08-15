import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, parseEther, randomBytes } from "ethers";
import * as dotenv from "dotenv";
import { TimelockFunction } from "../dist/clients/curators";
const {
  setUpTest,
  logTitle,
  logResult,
  assert,
  assertThrows,
  createWallet,
  getWalletBalances,
} = require("../test/utils");
dotenv.config();

const timelocks = [
  "abdicateSubmit",
  "setIsAdapter",
  "decreaseTimelock",
  "increaseAbsoluteCap",
  "increaseRelativeCap",
  "setIsAllocator",
  "setSharesGate",
  "setReceiveAssetsGate",
  "setSendAssetsGate",
  "setPerformanceFee",
  "setPerformanceFeeRecipient",
  "setManagementFee",
  "setManagementFeeRecipient",
  "setMaxRate",
  "setForceDeallocatePenalty",
];

const wait1s = () => new Promise((resolve) => setTimeout(resolve, 1000));

interface SetupVaultConfig {
  owner?: string; // If not provided, we will use the user address
  asset: string;
  salt?: string; // To make the address deterministic
  name?: string;
  symbol?: string;

  curator?: string;
  allocator?: string[]; // Might have multiple allocators
  sentinel?: string[]; // Might have multiple sentinels

  performance_fee?: bigint; // 100% = 1e18, max 50% -> 0.5e18
  management_fee?: bigint; // 100% = 1e18, max 5%/year -> 0.05e18/31_536_000 = 1.3698630136986301e15
  performance_fee_recipient?: string;
  management_fee_recipient?: string;
  max_rate?: bigint; // 100% = 1e18, max 200%/year -> 200e16/31_536_000 = 6.3493150684931506e12

  underlying_vaults?: {
    address: string;
    type: "Morpho" | "Aave" | "Euler" | "Compound"; // Because we need to select the right adapter
    needs_adapter: boolean; // If true, we will create the adapter and use it, if no, it means the address is already the vault
    relative_cap?: number;
    absolute_cap?: number;
    deallocate_penalty?: bigint; // 100% = 1e18, max 2% -> 0.02e18
  }[];

  // Timelock configuration: a mapping from each TimelockFunction to a number (duration in seconds)
  timelock?: Partial<Record<TimelockFunction, number>>;
}

//*******************************************************************
//*  This is what you need to change to create a vault              *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const SETUP_VAULT_CONFIG_MINIMAL_CONFIG: SetupVaultConfig = {
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on base
};

const SETUP_VAULT_CONFIG: SetupVaultConfig = {
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  name: "Byzantine Vault",
  symbol: "BYZ",
  performance_fee: parseEther("0.5"), // 50%
  management_fee: parseEther("0.05") / 31536000n, // 5% / year
  performance_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  management_fee_recipient: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  max_rate: parseEther("0.5") / 31536000n, // 50% / year
};

async function main() {
  console.log("Start example to create and configure a vault");

  try {
    // ****************
    // Setup the test
    // ****************

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC || "").connect(
      provider
    );
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    // Determine the intended owner address for the vault
    // If SETUP_VAULT_CONFIG.owner is not set, use the current user address
    // If the user is not the intended owner, set the user as the owner (for testing flexibility)
    const INTENDED_OWNER = SETUP_VAULT_CONFIG.owner || userAddress;
    const YOU_ARE_OWNER =
      userAddress.toLowerCase() === INTENDED_OWNER.toLowerCase();
    const YOUR_ARE_CURATOR =
      SETUP_VAULT_CONFIG.curator &&
      userAddress.toLowerCase() === SETUP_VAULT_CONFIG.curator.toLowerCase();
    const YOUR_ARE_ALLOCATOR =
      SETUP_VAULT_CONFIG.allocator &&
      SETUP_VAULT_CONFIG.allocator.some(
        (addr) => addr.toLowerCase() === userAddress.toLowerCase()
      );
    const YOUR_ARE_SENTINEL =
      SETUP_VAULT_CONFIG.sentinel &&
      SETUP_VAULT_CONFIG.sentinel.some(
        (addr) => addr.toLowerCase() === userAddress.toLowerCase()
      );
    const NEEDS_TO_ADD_UNDERLYING_VAULT = // Because only curator can add underlying vault
      SETUP_VAULT_CONFIG.underlying_vaults &&
      SETUP_VAULT_CONFIG.underlying_vaults.length > 0;
    const NEEDS_TO_CAP_UNDERLYING_VAULT = // Because only allocator can cap the underlying vault
      SETUP_VAULT_CONFIG.underlying_vaults &&
      SETUP_VAULT_CONFIG.underlying_vaults.some(
        (underlying) => underlying.relative_cap || underlying.absolute_cap
      );
    // Determine if a temporary allocator role is needed (if the current user is not an allocator but needs to cap underlying vaults)
    const NEEDS_TEMPORARY_ALLOCATOR_ROLE =
      !YOUR_ARE_ALLOCATOR && NEEDS_TO_CAP_UNDERLYING_VAULT;

    // Determine if a temporary curator role is needed (if the current user is not a curator but needs to perform curator actions)
    const NEEDS_TEMPORARY_CURATOR_ROLE =
      !YOUR_ARE_CURATOR &&
      (NEEDS_TEMPORARY_ALLOCATOR_ROLE ||
        NEEDS_TO_ADD_UNDERLYING_VAULT ||
        NEEDS_TO_CAP_UNDERLYING_VAULT ||
        SETUP_VAULT_CONFIG.performance_fee ||
        SETUP_VAULT_CONFIG.management_fee ||
        SETUP_VAULT_CONFIG.performance_fee_recipient ||
        SETUP_VAULT_CONFIG.management_fee_recipient ||
        SETUP_VAULT_CONFIG.max_rate);

    // Determine if a temporary owner role is needed (if the current user is not the owner but needs to perform owner actions)
    const NEEDS_TEMPORARY_OWNER_ROLE =
      !YOU_ARE_OWNER &&
      (NEEDS_TEMPORARY_CURATOR_ROLE ||
        SETUP_VAULT_CONFIG.name ||
        SETUP_VAULT_CONFIG.symbol);
    // ****************
    // Create the vault
    // ****************
    const txCreateVault = await client.createVault(
      YOU_ARE_OWNER ? INTENDED_OWNER : userAddress,
      SETUP_VAULT_CONFIG.asset,
      SETUP_VAULT_CONFIG.salt || ethers.hexlify(randomBytes(32))
    );
    await wait1s();
    console.log("Vault creation transaction sent", txCreateVault.hash);
    const receiptCreateVault = await txCreateVault.wait();
    const VAULT_ADDRESS = receiptCreateVault?.logs[0]?.address;

    if (!VAULT_ADDRESS) {
      throw new Error("Vault address not found");
    }

    console.log("Vault created successfully!");
    console.log("📨 Vault address:", VAULT_ADDRESS);

    if (!YOU_ARE_OWNER && NEEDS_TEMPORARY_OWNER_ROLE) {
      console.log(
        "You are not the owner, we will set the owner to the intended owner, but put back the intended owner at the end"
      );
      await client.setOwner(VAULT_ADDRESS, INTENDED_OWNER);
      await wait1s();
    }

    // ****************
    // Handle the name and symbol
    // ****************
    console.log("🔤 Setting name and symbol");
    if (SETUP_VAULT_CONFIG.name && SETUP_VAULT_CONFIG.symbol) {
      await client.setVaultNameAndSymbol(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.name,
        SETUP_VAULT_CONFIG.symbol
      );
    } else if (SETUP_VAULT_CONFIG.name) {
      await client.setVaultName(VAULT_ADDRESS, SETUP_VAULT_CONFIG.name);
    } else if (SETUP_VAULT_CONFIG.symbol) {
      await client.setVaultSymbol(VAULT_ADDRESS, SETUP_VAULT_CONFIG.symbol);
    }
    await wait1s();

    // ****************
    // Handle the fees
    // ****************

    if (!YOUR_ARE_CURATOR) {
      console.log("Setting back the curator to the user");
      await client.setCurator(VAULT_ADDRESS, userAddress);
    }
    await wait1s();

    console.log("💰 Setting fees");

    if (SETUP_VAULT_CONFIG.performance_fee_recipient) {
      await client.instantSetPerformanceFeeRecipient(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.performance_fee_recipient
      );
      await wait1s();
    }
    if (SETUP_VAULT_CONFIG.management_fee_recipient) {
      await client.instantSetManagementFeeRecipient(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.management_fee_recipient
      );
      await wait1s();
    }
    if (SETUP_VAULT_CONFIG.performance_fee) {
      await client.instantSetPerformanceFee(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.performance_fee
      );
      await wait1s();
    }
    if (SETUP_VAULT_CONFIG.management_fee) {
      await client.instantSetManagementFee(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.management_fee
      );
      await wait1s();
    }
    if (SETUP_VAULT_CONFIG.max_rate) {
      await client.instantSetMaxRate(
        VAULT_ADDRESS,
        SETUP_VAULT_CONFIG.max_rate
      );
      await wait1s();
    }

    console.log("🔍 Adding underlying vault");
    if (NEEDS_TO_ADD_UNDERLYING_VAULT) {
      console.log("Adding underlying vault");
      //   await client.addUnderlyingVault(VAULT_ADDRESS, SETUP_VAULT_CONFIG.underlying_vault);

      // ****************
      // Add the underlying vault
      // ****************

      // ****************
      // Add the caps
      // ****************

      // ****************
      // Go back to the original situation
      // ****************

      if (!YOUR_ARE_ALLOCATOR) {
        console.log("Setting back the allocator to the user");
        //   await client.setIsAllocator(VAULT_ADDRESS, false);
      }
      if (!YOUR_ARE_SENTINEL) {
        console.log("Setting back the sentinel to the user");
        await client.setIsSentinel(VAULT_ADDRESS, userAddress, false);
      }
    }

    if (NEEDS_TEMPORARY_CURATOR_ROLE) {
      console.log("Setting back the curator to the user");
      await client.setCurator(
        VAULT_ADDRESS,
        "0x0000000000000000000000000000000000000000"
      );
    }
    await wait1s();

    if (NEEDS_TEMPORARY_OWNER_ROLE) {
      console.log("Setting back the owner to the user");
      await client.setOwner(
        VAULT_ADDRESS,
        "0x0000000000000000000000000000000000000000"
      );
    }

    // ****************
    // Final step: retrieve and display all vault information
    // ****************
    console.log("");
    console.log("*********************************************************");
    console.log("*                                                       *");
    console.log("* Reading the vault                                     *");
    const asset = await client.getAsset(VAULT_ADDRESS);
    const name = await client.getVaultName(VAULT_ADDRESS);
    const symbol = await client.getVaultSymbol(VAULT_ADDRESS);

    const owner = await client.getOwner(VAULT_ADDRESS);
    const curator = await client.getCurator(VAULT_ADDRESS);
    const isSentinel = await client.isSentinel(VAULT_ADDRESS, userAddress);
    // const isAllocator = await client.getIsAdapter(VAULT_ADDRESS, "Morpho");

    const performanceFee = await client.getPerformanceFee(VAULT_ADDRESS);
    const managementFee = await client.getManagementFee(VAULT_ADDRESS);
    const performanceFeeRecipient = await client.getPerformanceFeeRecipient(
      VAULT_ADDRESS
    );
    const managementFeeRecipient = await client.getManagementFeeRecipient(
      VAULT_ADDRESS
    );
    // const maxRate = await client.getMaxRate(VAULT_ADDRESS);

    // const allTimelocks = await Promise.all(
    //   timelocks.map(async (timelock) => {
    //     return {
    //       name: timelock,
    //       timelock: await client.getTimelock(VAULT_ADDRESS, timelock),
    //     };
    //   })
    // );

    console.log("* Asset:", asset);
    console.log("* Name:", name);
    console.log("* Symbol:", symbol);
    console.log("* Owner:", owner);
    console.log("* Curator:", curator);
    console.log("* Is Sentinel:", isSentinel);
    // console.log("* Is Adapter:", isAdapter);
    console.log(
      "* Performance Fee:",
      (Number(performanceFee) / 1e18) * 100,
      "%"
    );
    console.log(
      "* Management Fee:",
      Math.round((Number(managementFee) / 1e18) * 31536000 * 1e5) / 1e5,
      "%/year"
    );
    console.log("* Performance Fee Recipient:", performanceFeeRecipient);
    console.log("* Management Fee Recipient:", managementFeeRecipient);
    // console.log("* Max Rate:", maxRate);
    // allTimelocks.forEach((timelock) => {
    //   console.log(`* Timelock of ${timelock.name}:`, timelock.timelock);
    // });
    console.log("*                                                       *");
    console.log("*********************************************************");
  } catch (error) {
    console.error("Error creating vault:", error);
  }
}

main();
