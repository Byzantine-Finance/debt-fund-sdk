import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, randomBytes } from "ethers";
import {
  finalReading,
  waitHalfSecond,
  RPC_URL,
  MNEMONIC,
} from "./utils-example";

// Example of minimal configuration
// We'll set your address as the owner
// And we'll pick a random salt for the vault creation
const VAULT_ADDRESS = "0x8Ec56ae40cC667BeA76052B85184710e76842233";
const UNDERLYING_VAULT = "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A";
const KNOWN_ADAPTER_ADDRESS = "0x5DC494C1b3f798642932bfc8d998F775857dC34C";

async function main() {
  console.log("Start example to create and configure a vault");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    const isUnderlyingVaultAdapter = await client.isAdapter(
      "morphoVaultV1",
      UNDERLYING_VAULT
    );
    console.log("Is underlying vault an adapter?", isUnderlyingVaultAdapter);

    const isAdapterAdapter = await client.isAdapter(
      "morphoVaultV1",
      KNOWN_ADAPTER_ADDRESS
    );
    console.log("Is adapter an adapter?", isAdapterAdapter);

    const adapterAddress = await client.findAdapter(
      "morphoVaultV1",
      VAULT_ADDRESS,
      UNDERLYING_VAULT
    );
    console.log("Adapter address:", adapterAddress);

    // const adapterAddress = await client.deployMorphoVaultV1Adapter(
    //   VAULT_ADDRESS,
    //   UNDERLYING_VAULT
    // );

    // if (!adapterAddress) {
    //   throw new Error("Adapter address not found");
    // }

    // await finalReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error creating vault simple:", error);
  }
}

main();
