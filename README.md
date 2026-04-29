# Debt Fund SDK

TypeScript SDK for interacting with the **Byzantine Debt Fund** ecosystem — a wrapper around the [Morpho Vault V2](https://docs.morpho.org/get-started/resources/addresses/) protocol. Create vaults, configure them, deposit/withdraw, and bundle dozens of admin operations into a single transaction via the on-chain `multicall`.

## What's new in v2

The SDK has been rewritten around three primitives:

1. **`Vault` class** — every per-vault operation lives here, with method names matching the contract (`vault.owner()`, `vault.totalAssets()`, `vault.addAdapter(...)`).
2. **`Actions` namespace** — pure calldata builders grouped by role (`Actions.owner.*`, `Actions.curator.*`, `Actions.allocator.*`, `Actions.user.*`).
3. **`vault.multicall([...])`** — bundle any number of actions into a single atomic transaction. Setting up a brand-new vault now takes 1 tx instead of 12+.

Breaking change vs v1: every `client.X(vaultAddress, ...)` call became `vault.X(...)` (where `vault = client.vault(addr)`), and several methods were renamed to match the contract directly (e.g. `getOwner` → `owner()`, `addAdapterAfterTimelock` → `addAdapter`).

## Supported networks

- **Ethereum Mainnet** (chain ID `1`)
- **Base Mainnet** (chain ID `8453`) — please use small amounts only

Vault V2 protocol addresses come from the [official Morpho documentation](https://docs.morpho.org/get-started/resources/addresses/). The ERC4626Merkl and CompoundV3 adapter factories are Byzantine-deployed.

## Installation

```bash
npm install @byzantine/debt-fund-sdk
```

## Setup

Create a `.env`:

```shell
RPC_URL=https://base-mainnet.infura.io/v3/your_api_key_here
MNEMONIC=your_wallet_mnemonic
```

Initialize:

```ts
import { ByzantineClient } from "@byzantine/debt-fund-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(provider);
const client = new ByzantineClient(provider, wallet);
```

## Quick start — create + configure a vault in 1 multicall

```ts
import {
  Actions,
  ByzantineClient,
  idData,
  parseAnnualRate,
  parsePercent,
} from "@byzantine/debt-fund-sdk";
import { ethers, parseUnits } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(provider);
const client = new ByzantineClient(provider, wallet);
const me = await wallet.getAddress();

// 1. Deploy the vault (separate tx — factory is its own contract).
const cfg = await client.getNetworkConfig();
const create = await client.createVault(
  me,
  cfg.USDCaddress,                          // pre-resolved per the active chain
  ethers.hexlify(ethers.randomBytes(32)),
);
await create.wait();
const vault = create.vault;

// 2. Deploy an adapter (also its own factory contract).
const deploy = await client.deployAdapter(
  "erc4626",
  vault.address,
  "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738", // some ERC4626 vault
);
await deploy.wait();
const adapter = deploy.adapterAddress;

// 3. Bundle all configuration into ONE tx.
await vault.multicall([
  Actions.owner.setName("Byzantine USDC"),
  Actions.owner.setSymbol("byzUSDC"),
  Actions.curator.instantSetIsAllocator(me, true),
  Actions.curator.instantSetPerformanceFeeRecipient(me),
  Actions.curator.instantSetPerformanceFee(parsePercent("5")),    // 5 %
  Actions.curator.instantSetManagementFee(parseAnnualRate("1")),  // 1 %/year
  Actions.curator.instantAddAdapter(adapter),
  Actions.curator.instantIncreaseAbsoluteCap(idData("this", adapter), parseUnits("1000", 6)),
  Actions.curator.instantIncreaseRelativeCap(idData("this", adapter), parsePercent("100")),
  Actions.allocator.setLiquidityAdapterAndData(adapter, "0x"),
  Actions.allocator.setMaxRate(parseAnnualRate("200")),
]);
```

## Core concepts

### `Vault` instance

`client.vault(address)` returns a `Vault` — the single object you call for any per-vault operation.

```ts
const vault = client.vault("0x...");

// Reads — names match the contract
await vault.totalAssets();
await vault.owner();
await vault.balanceOf(user);
await vault.previewDeposit(parseUnits("100", 6));

// Writes
await vault.deposit(parseUnits("100", 6), user);
await vault.withdraw(parseUnits("50", 6), user, user);
```

### Three-tier timelock pattern (curator functions)

Most curator setters are timelocked. Each comes as a triplet:

| Verb | Method | Description |
|---|---|---|
| Schedule | `submitX(...)` | Starts the timelock |
| Execute | `X(...)` (matches contract) | Runs after the delay |
| Instant | `instantX(...)` | `submit` + `execute` in one multicall (only if `timelock(X) === 0`) |

```ts
// e.g. addAdapter — three valid flows
await vault.submitAddAdapter(adapter);          // schedule
// ... wait for timelock ...
await vault.addAdapter(adapter);                // execute (= old "addAdapterAfterTimelock")

// or, if timelock is 0:
await vault.instantAddAdapter(adapter);         // both, in one tx
```

### `Actions` namespace + `multicall`

Each `Actions.role.X(...)` returns the encoded calldata for that operation. Pass any number to `vault.multicall([...])`.

```ts
import { Actions } from "@byzantine/debt-fund-sdk";

// Bulk-update caps for 10 markets in one tx
await vault.multicall(
  markets.map(m => Actions.curator.instantIncreaseAbsoluteCap(m.idData, m.cap)),
);

// Atomic config rotation
await vault.multicall([
  Actions.curator.revoke(oldData),
  Actions.curator.submit(Actions.curator.increaseAbsoluteCap(id, newCap)),
]);
```

The `instantX` actions return `string[]` (the `[submit, execute]` pair). `multicall` flattens automatically — you can mix single calldatas and instant pairs freely.

### Conversion helpers

The SDK exposes lossless `format`/`parse` pairs (bigint ↔ human strings) for the three encodings the contract uses:

```ts
import {
  formatAmount, parseAmount,           // tokens (decimals)
  formatPercent, parsePercent,         // WAD (1e18 = 100 %)
  formatAnnualRate, parseAnnualRate,   // WAD/sec ↔ annual %
} from "@byzantine/debt-fund-sdk";

parseAmount("1.5", 6);                  // 1_500_000n
formatPercent(5n * 10n ** 16n);         // "5"
parseAnnualRate("5");                   // ≈ 1_585_489_599n  (per second WAD)
```

All four implementations are bigint-only — `parseX(formatX(v)) === v` for representable inputs.

## API reference

### Vault factory & adapter factories

```ts
// Create a vault — returns the tx augmented with `vaultAddress` and a ready Vault.
const { vault, vaultAddress } = await client.createVault(owner, asset, salt);

// Deploy an adapter — `cometRewards` only required for compoundV3.
await client.deployAdapter(type, parentVault, underlying, cometRewards?);

// Find an existing adapter (any type if `type` omitted).
await client.findAdapter(parentVault, underlying, { type?, cometRewards? });

// Adapter introspection
await client.isAdapter(type, address);
await client.getAdapterType(address);                // returns the AdapterType
await client.getAdapterFactoryAddress(address);
await client.getIdsERC4626(address);
await client.getIdsERC4626Merkl(address);
await client.getIdsCompoundV3(address);
await client.getIdsMarketV1(address, marketParams);
await client.getUnderlyingERC4626(address);
await client.getUnderlyingERC4626Merkl(address);
await client.getUnderlyingCompoundV3(address);
await client.getUnderlyingMarketV1(address);
await client.getMarketParamsListLength(address);
await client.getMarketParamsList(address, index);

// Network
await client.getNetworkConfig();
await client.getChainId();
await client.getVaultFactoryContract();
client.useSigner(newSigner);
```

### Reads (`vault.X()`)

All reads match the contract function names directly.

```ts
// State
await vault.asset();
await vault.decimals();
await vault.name();
await vault.symbol();
await vault.totalAssets();
await vault.totalSupply();
await vault.virtualShares();
await vault.maxRate();
await vault.lastUpdate();

// Roles
await vault.owner();
await vault.curator();
await vault.isSentinel(account);
await vault.isAllocator(account);

// ERC20 (shares)
await vault.balanceOf(account);
await vault.allowance(owner, spender);

// Previews
await vault.previewDeposit(assets);
await vault.previewMint(shares);
await vault.previewWithdraw(assets);
await vault.previewRedeem(shares);
await vault.convertToShares(assets);
await vault.convertToAssets(shares);

// Adapters
await vault.adaptersLength();
await vault.adapter(index);                 // adapters[index]
await vault.isAdapter(account);
await vault.adapterRegistry();

// Caps & allocations
await vault.absoluteCap(id);
await vault.relativeCap(id);
await vault.allocation(id);

// Gates
await vault.receiveSharesGate();
await vault.sendSharesGate();
await vault.receiveAssetsGate();
await vault.sendAssetsGate();

// Fees
await vault.performanceFee();
await vault.performanceFeeRecipient();
await vault.managementFee();
await vault.managementFeeRecipient();
await vault.forceDeallocatePenalty(adapter);

// Liquidity adapter
await vault.liquidityAdapter();
await vault.liquidityData();

// Timelock
await vault.timelock(fnName);                // bigint seconds
await vault.executableAt(data);              // unix timestamp
await vault.abdicated(fnName);

// Asset-side helpers
await vault.assetBalance(account);
await vault.assetAllowance(owner);
await vault.idleBalance();                   // asset balance held idle by the vault
vault.idData("this", adapterAddress);        // helper for cap idData
```

### Owner writes (instant — no timelock)

```ts
await vault.setName(newName);
await vault.setSymbol(newSymbol);
await vault.setNameAndSymbol(newName, newSymbol);   // multicall convenience
await vault.setOwner(newOwner);
await vault.setCurator(newCurator);
await vault.setIsSentinel(account, true);
```

### Curator writes — every timelocked setter is exposed as a triplet

For each timelocked operation, the SDK provides three methods, in this order:

- **`submitX(...)`** — schedule the call (starts the timelock)
- **`X(...)`** — execute after the delay (name matches the contract)
- **`instantX(...)`** — `submit` + `execute` in one multicall (only valid when `timelock(X) === 0`)

```ts
// Adapters
await vault.submitAddAdapter(addr);
await vault.addAdapter(addr);
await vault.instantAddAdapter(addr);

await vault.submitRemoveAdapter(addr);
await vault.removeAdapter(addr);
await vault.instantRemoveAdapter(addr);

// Caps — increases are timelocked
await vault.submitIncreaseAbsoluteCap(idData, cap);
await vault.increaseAbsoluteCap(idData, cap);
await vault.instantIncreaseAbsoluteCap(idData, cap);

await vault.submitIncreaseRelativeCap(idData, cap);
await vault.increaseRelativeCap(idData, cap);
await vault.instantIncreaseRelativeCap(idData, cap);

// Cap decreases are direct (curator OR sentinel, no timelock)
await vault.decreaseAbsoluteCap(idData, cap);
await vault.decreaseRelativeCap(idData, cap);

// Allocator role
await vault.submitSetIsAllocator(addr, true);
await vault.setIsAllocator(addr, true);
await vault.instantSetIsAllocator(addr, true);

// Gates — 4 gates × 3 verbs each
await vault.submitSetReceiveSharesGate(g);
await vault.setReceiveSharesGate(g);
await vault.instantSetReceiveSharesGate(g);

await vault.submitSetSendSharesGate(g);
await vault.setSendSharesGate(g);
await vault.instantSetSendSharesGate(g);

await vault.submitSetReceiveAssetsGate(g);
await vault.setReceiveAssetsGate(g);
await vault.instantSetReceiveAssetsGate(g);

await vault.submitSetSendAssetsGate(g);
await vault.setSendAssetsGate(g);
await vault.instantSetSendAssetsGate(g);

// Adapter registry
await vault.submitSetAdapterRegistry(reg);
await vault.setAdapterRegistry(reg);
await vault.instantSetAdapterRegistry(reg);

// Fees
await vault.submitSetPerformanceFee(f);
await vault.setPerformanceFee(f);
await vault.instantSetPerformanceFee(f);

await vault.submitSetManagementFee(f);
await vault.setManagementFee(f);
await vault.instantSetManagementFee(f);

await vault.submitSetPerformanceFeeRecipient(r);
await vault.setPerformanceFeeRecipient(r);
await vault.instantSetPerformanceFeeRecipient(r);

await vault.submitSetManagementFeeRecipient(r);
await vault.setManagementFeeRecipient(r);
await vault.instantSetManagementFeeRecipient(r);

await vault.submitSetForceDeallocatePenalty(adapter, penalty);
await vault.setForceDeallocatePenalty(adapter, penalty);
await vault.instantSetForceDeallocatePenalty(adapter, penalty);

// Timelock management
await vault.submitIncreaseTimelock(fn, duration);
await vault.increaseTimelock(fn, duration);
await vault.instantIncreaseTimelock(fn, duration);

await vault.submitDecreaseTimelock(fn, duration);
await vault.decreaseTimelock(fn, duration);
await vault.instantDecreaseTimelock(fn, duration);

await vault.submitAbdicate(fn);
await vault.abdicate(fn);
// (no instant — abdication is permanent)

// Generic timelock primitives
await vault.submit(rawCalldata);   // schedule any pre-encoded call
await vault.revoke(rawCalldata);   // cancel a pending submission
```

### Allocator writes

```ts
await vault.allocate(adapter, data, assets);
await vault.deallocate(adapter, data, assets);
await vault.setLiquidityAdapterAndData(adapter, data);
await vault.setMaxRate(rate);
```

### User writes

```ts
await vault.deposit(assets, onBehalf);
await vault.mint(shares, onBehalf);
await vault.withdraw(assets, receiver, onBehalf);
await vault.redeem(shares, receiver, onBehalf);
await vault.transfer(to, shares);
await vault.transferFrom(from, to, shares);
await vault.approve(spender, shares);
await vault.permit(owner, spender, shares, deadline, v, r, s);
await vault.forceDeallocate(adapter, data, assets, onBehalf);
await vault.accrueInterest();
await vault.approveAsset(amount);   // approves the vault to spend the underlying
```

## Adapter types

| Adapter type | Use for | Example underlyings |
|---|---|---|
| `erc4626` | Any ERC4626 vault (Morpho V1 vaults, Spark, Aave stata, …) | [Morpho Earn](https://app.morpho.org/base/earn), [Spark deployments](https://docs.spark.fi/dev/deployments/), [Aave stata](https://search.onaave.com/?q=stata%20USDC) |
| `erc4626Merkl` | ERC4626 vault with automated Merkl rewards claiming | Same as `erc4626` if the protocol distributes rewards via Merkl |
| `compoundV3` | Compound V3 markets (Comet) — requires `cometRewards` | [Compound markets](https://docs.compound.finance/#protocol-contracts) |
| `morphoMarketV1` | Morpho V1 peer-to-peer lending markets | [Morpho Markets](https://app.morpho.org/markets) |

## Network addresses

`vaultV2Factory`, `morphoRegistry`, `erc4626AdapterFactory` (= `MorphoVaultV1AdapterFactory`)
and `morphoMarketV1AdapterFactory` (= `MorphoMarketV1AdapterV2Factory`) come from the
[official Morpho documentation](https://docs.morpho.org/get-started/resources/addresses/).
`erc4626MerklAdapterFactory` and `compoundV3AdapterFactory` are Byzantine-deployed.

### Ethereum Mainnet (chain `1`)

| Contract | Address |
|---|---|
| `vaultV2Factory` | `0xA1D94F746dEfa1928926b84fB2596c06926C0405` |
| `morphoRegistry` | `0x3696c5eAe4a7Ffd04Ea163564571E9CD8Ed9364e` |
| `erc4626AdapterFactory` | `0xD1B8E2dee25c2b89DCD2f98448a7ce87d6F63394` |
| `morphoMarketV1AdapterFactory` | `0x32BB1c0D48D8b1B3363e86eeB9A0300BAd61ccc1` |
| `erc4626MerklAdapterFactory` | `0x576136011496367C7FEF780445349060646C7cC1` |
| `compoundV3AdapterFactory` | `0x60a91D7F17046FB1B1C9360E1C5D68b7E94E5959` |

### Base Mainnet (chain `8453`)

| Contract | Address |
|---|---|
| `vaultV2Factory` | `0x4501125508079A99ebBebCE205DeC9593C2b5857` |
| `morphoRegistry` | `0x5C2531Cbd2cf112Cf687da3Cd536708aDd7DB10a` |
| `erc4626AdapterFactory` | `0xF42D9c36b34c9c2CF3Bc30eD2a52a90eEB604642` |
| `morphoMarketV1AdapterFactory` | `0x9a1B378C43BA535cDB89934230F0D3890c51C0EB` |
| `erc4626MerklAdapterFactory` | `0xdF311B93f922867A686abA9b233Fd7C65d66f83d` |
| `compoundV3AdapterFactory` | `0xA4dF9668EE53A896BdF40A7AeAC1364129F3c168` |

## Examples

A full set of runnable examples lives under [`example/`](./example):

| File | What it shows |
|---|---|
| `multicall-showcase.ts` | Full vault setup (12+ ops) in **one transaction** |
| `create-vault-simple.ts` | Minimal vault creation |
| `create-vault.ts` | End-to-end create + configure with role swaps |
| `users-deposit.ts` | Deposit / mint / withdraw / redeem |
| `owners-settings.ts` | Owner-side admin (name, symbol, sentinels, …) |
| `curators-settings.ts` | Curator-side config (allocators, fees, adapters, caps) |
| `allocators-settings.ts` | Allocator ops (allocate, deallocate, force-deallocate) |
| `morpho-adapters.ts` | Adapter deployment + introspection |
| `set-cap-adapter.ts` | Set absolute + relative caps in one tx |

Run any example with:

```bash
npx tsx example/<filename>.ts
```

## Testing

The SDK ships with three test tiers, all driven by [vitest](https://vitest.dev):

```bash
npm test                         # unit tests only — no RPC, ~1s
npm run test:integration:read    # read-only RPC checks — needs RPC_URL
npm run test:integration:write   # full e2e — needs RPC_URL + MNEMONIC + funds
npm run test:all                 # everything
npm run test:watch               # vitest in watch mode
```

`integration-read` uses `TEST_VAULT_ADDRESS` if set to inspect a specific vault; otherwise vault-state tests are skipped. A live Vault V2 you can point it at:

```shell
TEST_VAULT_ADDRESS=0x30cacd22f178c9e57b0b010e1f9432881aa530c4   # Base Mainnet — READ-ONLY
```

> ⚠️ The address above is **read-only**. Write-side integration tests always
> deploy a **fresh** vault via the test setup helpers and operate on that
> vault — they never touch `TEST_VAULT_ADDRESS`.

## License

ISC
