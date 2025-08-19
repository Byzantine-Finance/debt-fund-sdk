import { ByzantineClient } from "../src/clients/ByzantineClient";
import { AbiCoder, ethers, keccak256, parseUnits } from "ethers";
import {
  finalReading,
  waitHalfSecond,
  RPC_URL,
  MNEMONIC,
} from "./utils-example";
import { getIdData } from "../src/clients/curators/Cap";

// This is what you need to set in order to set cap for an adapter
const VAULT_ADDRESS = "0x9F940434cABB9d8c1b9C9a4A042a846c093A85e7";
const CAPS_CONFIG = {
  id: "0x6feb657053c1e6004f89bb249621bde61a42536e87fdcdf6e5cc01e5f867ff8b",
  relativeCap: parseUnits("0.32", 18),
  absoluteCap: parseUnits("300", 6),
};

async function main() {
  console.log("Start example to set cap for an adapter");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);
    const client = new ByzantineClient(provider, wallet);

    const idData = getIdData("this", [CAPS_CONFIG.id]);
    console.log("ID Data:", idData);

    const adapterId = keccak256(idData);
    console.log("Adapter ID:", adapterId);

    const tx = await client.instantIncreaseRelativeCap(
      VAULT_ADDRESS,
      idData,
      CAPS_CONFIG.relativeCap
    );
    await tx.wait();

    const txGet = await client.getRelativeCap(VAULT_ADDRESS, adapterId);
    console.log("Relative cap:", txGet);

    // await finalReading(client, VAULT_ADDRESS, userAddress);
  } catch (error) {
    console.error("Error setting cap for an adapter:", error);
  }
}

main();
