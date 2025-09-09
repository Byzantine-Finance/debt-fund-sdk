import { ByzantineClient } from "../../src";
import { waitHalfSecond } from "./toolbox";
import { OwnerSettingsConfig } from "../owners-settings";
import { getIdData } from "../../src/clients/curators/Cap";

export async function setupOwnerSettings(
  client: ByzantineClient,
  vaultAddress: string,
  userAddress: string,
  ownerSettings: OwnerSettingsConfig
) {
  console.log("\n\n || 👮‍ Setting owner settings ||");

  try {
    const owner = await client.getOwner(vaultAddress);
    if (owner !== userAddress) {
      console.log("Access denied: only the owner can proceed here.");
      throw new Error("Access denied: only the owner can proceed here.");
    }

    const newName = ownerSettings.shares_name;
    const newSymbol = ownerSettings.shares_symbol;
    const newCurator = ownerSettings.curator;
    const newSentinels = ownerSettings.sentinels;
    const newOwner = ownerSettings.new_owner;

    // First, read the current name and symbol from the vault
    const currentName = await client.getSharesName(vaultAddress);
    const currentSymbol = await client.getSharesSymbol(vaultAddress);

    // Only update if the new values are different from the current ones
    if (newName && newSymbol) {
      if (newName !== currentName || newSymbol !== currentSymbol) {
        await client.setSharesNameAndSymbol(vaultAddress, newName, newSymbol);
        console.log(`📇 Name ${newName} and symbol ${newSymbol} set`);
        await waitHalfSecond();
      } else {
        console.log(
          `📇❌ Name and symbol are already set to ${newName} and ${newSymbol}, no update needed`
        );
      }
    } else if (newName) {
      if (newName !== currentName) {
        await client.setSharesName(vaultAddress, newName);
        console.log(`📇 Name ${newName} set`);
        await waitHalfSecond();
      } else {
        console.log(`📇❌ Name is already set to ${newName}, no update needed`);
      }
    } else if (newSymbol) {
      if (newSymbol !== currentSymbol) {
        await client.setSharesSymbol(vaultAddress, newSymbol);
        console.log(`📇 Symbol ${newSymbol} set`);
        await waitHalfSecond();
      } else {
        console.log(
          `📇❌ Symbol is already set to ${newSymbol}, no update needed`
        );
      }
    }

    if (newCurator) {
      const tx = await client.setCurator(vaultAddress, newCurator);
      await tx.wait();
      await waitHalfSecond();
      console.log(`👷‍ Curator ${newCurator} set`);
    }

    if (newSentinels && newSentinels.length > 0) {
      for (const sentinel of newSentinels) {
        const tx = await client.setIsSentinel(vaultAddress, sentinel, true);
        await tx.wait();
        await waitHalfSecond();
        console.log(`👷‍ Sentinel ${sentinel} set to true`);
      }
    }

    if (newOwner) {
      const tx = await client.setOwner(vaultAddress, newOwner);
      await tx.wait();
      console.log(`👷‍ Owner ${newOwner} set`);
    }
  } catch (error) {
    console.error("Error setting owner settings of a vault:", error);
  }
}
