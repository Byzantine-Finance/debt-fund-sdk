# Byzantine SDK examples

Runnable examples covering every facet of the v2 SDK — from creating a vault
to configuring it end-to-end in a single multicall.

## How to run

```bash
npx tsx example/<filename>.ts
```

**Prerequisites:**

- A `.env` at the repo root with `RPC_URL` and `MNEMONIC`
- Enough gas on the target chain
- The role required by the example (owner, curator, allocator) — examples
  print a clear error if the running wallet doesn't hold it

## Examples

### 🚀 `multicall-showcase.ts` — flagship demo

Configures a brand-new vault end-to-end (12+ operations: name, symbol,
sentinel, allocator, fees, adapter, penalty, caps, liquidity adapter,
maxRate) in **one** multicall transaction. Shows off the v2 superpower.

### 🏗️ `create-vault-simple.ts` — minimal create

The simplest way to deploy a new vault. Uses the running wallet as the
owner and a random salt. Good as a "hello world".

### 🏛️ `create-vault.ts` — create + full config

Production-grade vault deployment with optional `SETUP_VAULT_CONFIG`
fields. Handles temporary role swaps automatically when the running
wallet doesn't already hold the target roles.

### 💰 `users-deposit.ts` — user lifecycle

Deposit, mint, withdraw, redeem, with proper preview-then-approve flow.
Demonstrates the full ERC4626 surface from the user side.

### 👑 `owners-settings.ts` — owner-side admin

Bundles every requested owner-only change (name, symbol, curator,
sentinels) into a single multicall. Setowner is run last as a separate
tx (after that, the running wallet loses admin power).

### ⚙️ `curators-settings.ts` — curator config

Drives `setupCuratorsSettings` from `example/utils/curator.ts`, which
collects every curator-side change (allocators, fees, recipients,
adapters, force-deallocate penalties, cap up/down, transfer/deposit/
withdraw gates) into a single multicall. Previously this was up to
~15 sequential transactions.

### 💼 `allocators-settings.ts` — allocator ops

Configures the liquidity adapter and `maxRate` in one multicall, then
runs allocate/deallocate/force-deallocate operations as separate txs.

### 🔌 `morpho-adapters.ts` — adapter walkthrough

Find an existing adapter for an underlying vault, deploy one if missing,
and read back its ids + underlying.

### 📊 `set-cap-adapter.ts` — cap update

Sets both the absolute and relative cap for a single adapter id in one
multicall transaction.

## Shared helpers

`example/utils/` contains pieces reused across the examples:

- `toolbox.ts` — env loading, wait helpers, `fullReading()` which
  prints a vault's full state (now including per-id underlying
  liquidity, utilization, and supply APY pulled directly on-chain
  from Morpho V1 / Compound V3 / ERC4626), and `describeActions()`
  which decodes each calldata in a multicall before sending it
  (handy for tracing what's actually in a bundle). Also exports
  `classifyMorphoFlavour()` which labels a Morpho V1 vault id as
  `this` / `this/marketParams` / `collateralToken` by reusing the
  SDK's `idHash` helper for the on-chain encoding.
- `owner.ts`, `curator.ts`, `allocator.ts` — the per-role setup
  functions; each bundles whatever it can into one multicall.
- `depositor.ts` — `checkAndApproveIfNeeded()` for the deposit/mint
  approve flow.
