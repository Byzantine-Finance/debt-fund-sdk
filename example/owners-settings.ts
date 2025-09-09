import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers } from "ethers";
import { fullReading, RPC_URL, MNEMONIC } from "./utils/toolbox";
import { setupOwnerSettings } from "./utils/owner";

export interface OwnerSettingsConfig {
  shares_name?: string;
  shares_symbol?: string;
  curator?: string;
  sentinels?: string[]; // Might have multiple sentinels
  new_owner?: string; // This will replace you (at the end of the script)
}

//*******************************************************************
//*  This is what you need to change to create a vault              *
//*  Have a look to the interface above to see what you can change  *
//*  And the code below will adapt based on your configuration      *
//*******************************************************************

const VAULT_ADDRESS = "0x623a8cd8cdb724edb8664a566ca54325fd284b60";

const OWNER_SETTINGS_CONFIG: OwnerSettingsConfig = {
  shares_name: "Byzantine Vault",
  shares_symbol: "BYZ",
  // curator: "0xe5b709A14859EdF820347D78E587b1634B0ec771",
  // sentinels: ["0xe5b709A14859EdF820347D78E587b1634B0ec771"],
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

    await setupOwnerSettings(
      client,
      VAULT_ADDRESS,
      userAddress,
      OWNER_SETTINGS_CONFIG
    );

    await fullReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error setting owner settings of a vault:", error);
  }
}

main();
