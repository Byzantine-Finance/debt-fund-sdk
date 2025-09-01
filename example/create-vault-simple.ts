import { ByzantineClient } from "../src/clients/ByzantineClient";
import { ethers, randomBytes } from "ethers";
import { fullReading, RPC_URL, MNEMONIC } from "./utils";

// Example of minimal configuration
// We'll set your address as the owner
// And we'll pick a random salt for the vault creation
const SETUP_VAULT_CONFIG = {
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on base
};

async function main() {
  console.log("Start example to create and configure a vault");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const userAddress = await wallet.getAddress();

    const txCreateVault = await client.createVault(
      userAddress,
      SETUP_VAULT_CONFIG.asset,
      ethers.hexlify(randomBytes(32))
    );
    await txCreateVault.wait();

    console.log("Vault creation transaction sent", txCreateVault.hash);
    const VAULT_ADDRESS = txCreateVault.vaultAddress;

    if (!VAULT_ADDRESS) {
      throw new Error("Vault address not found");
    }

    await fullReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error creating vault simple:", error);
  }
}

main();
