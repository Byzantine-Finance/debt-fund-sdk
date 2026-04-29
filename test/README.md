# Tests

Three-tier suite, run independently or all together.

| Tier | Folder | Needs | Speed | Network |
| --- | --- | --- | --- | --- |
| Unit | `test/unit/` | nothing | <1s | none |
| Integration · read | `test/integration-read/` | `RPC_URL` | seconds | live RPC, read-only |
| Integration · write | `test/integration-write/` | `RPC_URL` + `MNEMONIC` + `anvil` | ~10s | each test forks via Anvil |

```bash
npm run test                       # unit only (default)
npm run test:unit
npm run test:integration:read
npm run test:integration:write
npm run test:all                   # everything
DEBUG=1 npm run test:integration:write   # per-tx gas / hash / cost logging
```

## Tiers

### Unit (`test/unit/`)

Pure logic — no I/O. Tests calldata builders (`Actions.*`), conversions
(`parseAmount`, `parsePercent`, `parseAnnualRate`), error decoding,
network registry, adapter routing, etc. Uses `_fixtures.ts` for
deterministic addresses (ADDR_A..D, DEAD, ZERO). Always green, always
fast — these run in CI on every PR.

### Integration · read (`test/integration-read/`)

Hits a real RPC (Base by default) read-only. Verifies the SDK against
*production* contracts: factory deployments, network config, a known
populated vault.

Skipped when `RPC_URL` is unset. Uses `TEST_VAULT_ADDRESS` for the
populated-vault checks (read-only — never written to).

### Integration · write (`test/integration-write/`)

Per-test Anvil fork. Each test gets:

- a brand-new Anvil process (`spawnAnvil` finds a free port, kills on teardown)
- a forked chain at `RPC_URL`'s tip
- a fresh wallet derived from Anvil's well-known test mnemonic
  (`test test test ...`), pre-funded with 10 000 ETH on the fork
- a `LocalNonceManager`-wrapped signer (see below)
- a `ByzantineClient` instance

Skipped when `RPC_URL` *or* `MNEMONIC` is unset.

Per-test isolation means parallel execution is safe — no nonce races,
no leftover state. Cost: ~500–1000ms Anvil boot per test.

## Fixtures

Defined in `_test.ts` via `vitest.extend`:

| Fixture | Funds the wallet with… | Plus… |
| --- | --- | --- |
| `anvil` | **10 000 ETH** (via `anvil_setBalance`, for gas) | fresh Anvil + client |
| `freshVault` | same 10 000 ETH | a brand-new Vault V2 (USDC asset) |
| `fundedVault` | same 10 000 ETH **+ 1 USDC** (whale impersonation, for deposits) | same fresh Vault V2 |

So:
- ETH is funded on **every** tier — no test ever runs out of gas.
- USDC (the vault's underlying asset) is funded **only** by `fundedVault`,
  via `anvil_impersonateAccount` on a known whale (`USDC_WHALES`). Use
  this fixture for any test that calls `deposit` / `mint` / `withdraw`.

Use the smallest fixture you need — they nest, so requesting
`fundedVault` automatically provisions Anvil and a fresh vault too.

```ts
import { test } from "../_test";

test("…", async ({ fundedVault: { vault, me, usdcDealt } }) => {
    // vault is freshly deployed, wallet has 1 USDC and 10 000 ETH
});
```

## Why a custom `LocalNonceManager`?

`ethers.NonceManager` only overrides `sendTransaction` and delegates
`populateTransaction` to the inner Wallet. The inner Wallet then calls
`getTransactionCount("pending")` itself and uses that for
`eth_estimateGas`. On Anvil, the pending pool is briefly stale right
after a block mines — so `estimateGas` reuses the just-used nonce and
the chain replies "nonce too low", crashing the whole call before
`sendTransaction` even runs.

`LocalNonceManager` bakes the nonce into the tx *before* delegating, so
the inner Wallet never has to fetch. Live in `src/utils/LocalNonceManager.ts`,
also exported from the SDK so examples (and any user running against
a local fork) can opt in.

## `dealUSDC` (whale impersonation)

The Anvil test wallet has 10 000 fork-ETH but zero USDC. To run
deposit/withdraw tests we impersonate a known USDC whale via
`anvil_impersonateAccount` and transfer 1 USDC to the test wallet.
Whales per chain in `_test.ts` → `USDC_WHALES`.

## `multicall-bundle` — Vault V2 as its own underlying

`multicall-bundle.test.ts` configures a vault end-to-end (owner +
curator + allocator + adapter + caps + liquidity + maxRate) in a
**single** multicall transaction. To wire an `erc4626` adapter we need
*some* ERC4626 vault to point at — and Vault V2 itself **is** ERC4626.
So the test deploys a *second* Vault V2 on the fly and uses it as the
underlying:

```
parent Vault V2 ──[erc4626 adapter]──▶ child Vault V2  (ERC4626 surface)
       ▲
       └── runs the multicall bundle (this is what we're testing)
```

That keeps the test self-contained: no `TEST_UNDERLYING_VAULT` env var,
no external dependency, just two `client.createVault` calls before the
big multicall.

## Env vars

Loaded from `.env` (via `dotenv/config` in `_helpers.ts`):

| Var | Required by | Purpose |
| --- | --- | --- |
| `RPC_URL` | integration-read, integration-write | chain to fork from / read against |
| `MNEMONIC` | integration-write | unused at runtime (Anvil's test mnemonic is used instead), but present-check gates the tier |
| `TEST_VAULT_ADDRESS` | some integration-read tests | a populated vault to read from (read-only) |
| `DEBUG=1` | optional | `logTx()` prints tx hash, block, gas, cost per write |

## Adding a write test

```ts
import { expect } from "vitest";
import { hasRpcAndSigner } from "../_helpers";
import { logTx, test } from "../_test";

test.skipIf(!hasRpcAndSigner())(
    "does the thing",
    async ({ freshVault: { vault, me } }) => {
        const tx = await vault.multicall([
            // …actions…
        ]);
        const receipt = await logTx(tx, "label");
        expect(receipt?.status).toBe(1);
    },
);
```

That's it — the fixture handles Anvil, signer, vault deployment.

## Requirements

- Foundry's `anvil` on `PATH` for write tests
  (https://book.getfoundry.sh/getting-started/installation)
- Node 20+
- `.env` with `RPC_URL` (and `MNEMONIC` for write tests)
