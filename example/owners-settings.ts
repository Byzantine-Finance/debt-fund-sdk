import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers } from "ethers";
import {
  finalReading,
  RPC_URL,
  MNEMONIC,
  waitHalfSecond,
} from "./utils-example";

interface OwnerSettingsConfig {
  name?: string;
  symbol?: string;
  curator?: string;
  sentinels?: string[]; // Might have multiple sentinels
  new_owner?: string; // This will replace you (at the end of the script)
}

//*******************************************************************
//*  This is what you need to change to create a vault              *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const VAULT_ADDRESS = "0xfaEff874FC56Ba84280855a7cd33bce79D8C5a10";

const OWNER_SETTINGS_CONFIG: OwnerSettingsConfig = {
  name: "Byzantine Vault",
  symbol: "BYZ",
  curator: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  sentinels: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],
  // new_owner: "0xe5b709A14859EdF820347D78E587b1634B0ec771", // Uncomment if you want to set a new onwer at the end of the script
};

async function main() {
  console.log("Start example to set owner settings of a vault");

  try {
    // ****************
    // Setup the test
    // ****************

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    const owner = await client.getOwner(VAULT_ADDRESS);
    if (owner !== userAddress) {
      console.log("Access denied: only the owner can proceed here.");
      throw new Error("Access denied: only the owner can proceed here.");
    }

    const newName = OWNER_SETTINGS_CONFIG.name;
    const newSymbol = OWNER_SETTINGS_CONFIG.symbol;
    const newCurator = OWNER_SETTINGS_CONFIG.curator;
    const newSentinels = OWNER_SETTINGS_CONFIG.sentinels;
    const newOwner = OWNER_SETTINGS_CONFIG.new_owner;

    if (newName && newSymbol) {
      await client.setSharesNameAndSymbol(VAULT_ADDRESS, newName, newSymbol);
      console.log(`Name ${newName} and symbol ${newSymbol} set`);
    } else if (newName) {
      await client.setSharesName(VAULT_ADDRESS, newName);
      console.log(`Name ${newName} set`);
    } else if (newSymbol) {
      await client.setSharesSymbol(VAULT_ADDRESS, newSymbol);
      console.log(`Symbol ${newSymbol} set`);
    }
    await waitHalfSecond();

    if (newCurator) {
      const tx = await client.setCurator(VAULT_ADDRESS, newCurator);
      await tx.wait();
      await waitHalfSecond();
      console.log(`Curator ${newCurator} set`);
    }

    if (newSentinels && newSentinels.length > 0) {
      for (const sentinel of newSentinels) {
        const tx = await client.setIsSentinel(VAULT_ADDRESS, sentinel, true);
        await tx.wait();
        await waitHalfSecond();
        console.log(`Sentinel ${sentinel} set to true`);
      }
    }

    if (newOwner) {
      const tx = await client.setOwner(VAULT_ADDRESS, newOwner);
      await tx.wait();
      console.log(`Owner ${newOwner} set`);
    }

    await finalReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error setting owner settings of a vault:", error);
  }
}

main();
