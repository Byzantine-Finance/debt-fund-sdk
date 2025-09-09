// import { ethers } from "ethers";
// import { fullReading, waitHalfSecond, RPC_URL, MNEMONIC } from "./utils";
// import { ByzantineClient } from "../src/clients/ByzantineClient";

// /**
//  * Example demonstrating how to find an available salt and create a vault
//  */

// interface SaltConfig {
//   prefix?: string; // Address prefix after 0x (e.g., "dede")
//   suffix?: string; // Optional suffix for the salt
// }

// const SALT_CONFIG: SaltConfig = {
//   prefix: "be", // We want the vault address to start with "0xb"
//   suffix: "",
// };

// async function main() {
//   console.log("Start example to create and configure a vault");

//   try {
//     const provider = new ethers.JsonRpcProvider(RPC_URL);
//     const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
//     const client = new ByzantineClient(provider, wallet);

//     const userAddress = await wallet.getAddress();

//     // Example 1: Find salt that generates vault address starting with "0xb"
//     console.log(
//       `Finding salt that generates vault address starting with '0x${SALT_CONFIG.prefix}'...`
//     );
//     const salt = await client.findSalt(
//       userAddress,
//       "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // Asset address
//       SALT_CONFIG.prefix,
//       SALT_CONFIG.suffix
//     );
//     console.log("Found salt:", salt);

//     // Example 2: Create vault with found salt
//     console.log("\nCreating vault with found salt...");
//     const txCreateVault = await client.createVault(
//       userAddress,
//       "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // Asset address
//       salt
//     );
//     console.log("Vault creation transaction sent", txCreateVault.hash);
//     const receiptCreateVault = await txCreateVault.wait();
//     const VAULT_ADDRESS = receiptCreateVault?.logs[0]?.address;
//     if (!VAULT_ADDRESS) {
//       throw new Error("Vault address not found");
//     }

//     console.log(`\nVault created at address: ${VAULT_ADDRESS}`);
//     console.log(`Salt used: ${salt}`);
//     if (
//       SALT_CONFIG.prefix &&
//       VAULT_ADDRESS.toLowerCase().startsWith(
//         `0x${SALT_CONFIG.prefix.toLowerCase()}`
//       )
//     ) {
//       console.log(
//         `✅ Success! Vault address starts with '0x${SALT_CONFIG.prefix}'`
//       );
//     } else {
//       console.log(
//         `❌ Vault address does not start with '0x${SALT_CONFIG.prefix}'`
//       );
//     }

//     await fullReading(client, VAULT_ADDRESS, userAddress);
//   } catch (error) {
//     console.error("Error:", error);
//   }
// }

// // Run the example
// if (require.main === module) {
//   main().catch(console.error);
// }
