# Byzantine Debt Fund SDK — Agent Conventions

Project conventions an agent (Claude Code, Cursor, Codex, …) should follow
when modifying this repo. Rules are listed because they are **important
and non-obvious** — anything already enforced by the type system or
expressible as "follow the surrounding code" is intentionally omitted.

## Architecture

- **Per-vault operations live on the `Vault` class.** `ByzantineClient` is
  a factory only: `createVault`, `deployAdapter`, `findAdapter`, network
  helpers, signer management. Don't add per-vault read/write methods to
  `ByzantineClient`.
- **Vault method names match the contract.** `vault.owner()`, not
  `vault.getOwner()`. `vault.totalAssets()`, not `vault.getTotalAssets()`.
  ERC20 methods follow the standard (`balanceOf`, `allowance`).

## Curator setters — submit / execute / instant triplet

Every timelocked curator setter is exposed as **three** methods. Always add
all three when introducing a new timelocked action:

```ts
await vault.submitX(...);     // schedule
await vault.X(...);           // execute (matches the contract function name)
await vault.instantX(...);    // submit + execute via multicall (timelock = 0 only)
```

`instantX` should be a one-line wrapper: `multicall([Actions.curator.instantX(...)])`.

## Multicall + `Actions`

- For any new admin operation, expose a calldata builder under
  `Actions.{owner,curator,allocator,user}` in `src/actions.ts`. The class
  method on `Vault` then becomes a thin wrapper.
- Don't write new ad-hoc `instantX` helpers that re-encode `[submit, set]`
  inline — derive them from `Actions.role.X(...)` so the encoding lives in
  one place.
- `vault.multicall([...])` accepts `(string | string[])[]` — `instantX`
  builders return the `string[]` tuple and `flattenActions` handles the
  rest. Don't change this contract.

### Multicall ordering rules

Order matters inside a single multicall. Bundles that follow these rules
work; bundles that don't will revert:

1. **Role swaps come before the actions that depend on them.**
   `setCurator(me)` must be emitted before any `Actions.curator.instantX`
   if the running wallet isn't already curator.
2. **Role restores come after the role-scoped actions.**
   `setCurator(realCurator)` and `setOwner(realOwner)` go at the very end
   (and `setOwner` last of all — anything after it would run as the new
   owner).
3. **Timelock-bumping actions come AFTER any `instant*` that assumes the
   relevant timelock is 0.** An `instantIncreaseTimelock` followed by an
   `instantX` for the same selector reverts the `instantX`'s execute leg
   because `executableAt > block.timestamp`.
4. **Fee recipient before fee value.** The contract requires
   `recipient != 0` before `fee != 0`.

## Conversions

Bigint ↔ human strings live in `src/utils/conversions.ts` as
`formatX` / `parseX` pairs. **Bigint-only**, no `Number` arithmetic. Three
shapes only:

- `formatAmount` / `parseAmount` — token amounts (decimals)
- `formatPercent` / `parsePercent` — WAD percentages (1e18 = 100 %)
- `formatAnnualRate` / `parseAnnualRate` — WAD-per-second ↔ annual %

Don't introduce new helpers in another shape. If you need a new conversion,
add it to this module following the same naming and bigint-only rule.

## Adapter contracts

- Adapter and adapter-factory `ethers.Contract` instances are built through
  the helpers in `src/clients/adapters/_contracts.ts`
  (`getAdapterContract`, `getAdapterFactoryContract`). Don't construct
  adapter contracts via `new Contract(...)` elsewhere.
- The 4 supported adapter types are exhaustive: `erc4626`, `erc4626Merkl`,
  `compoundV3`, `morphoMarketV1`. New types require a coordinated update of
  the union, the ABI map, and the `_contracts.ts` switch.

## Networks

- Only Ethereum (chain `1`) and Base (chain `8453`) are supported. Don't
  add `// coming soon` placeholders.
- Vault V2 protocol addresses come from the [Morpho docs](https://docs.morpho.org/get-started/resources/addresses/);
  keep that link as a comment near the values. ERC4626Merkl and CompoundV3
  factories are Byzantine deployments — label them as such.
- The SDK names map to Morpho contracts as:
  `erc4626AdapterFactory` = `MorphoVaultV1AdapterFactory`,
  `morphoMarketV1AdapterFactory` = `MorphoMarketV1AdapterV2Factory`.

## Error handling

Custom errors are decoded automatically via `Interface.parseError` in
`formatContractError`. Don't reintroduce a manual selector → name mapping
file — the contract's own ABI is the source of truth.

## Tests

- Three-tier vitest suite under `test/`:
  - `test/unit/` — pure, no RPC, default `npm test`.
  - `test/integration-read/` — RPC only.
  - `test/integration-write/` — full e2e (RPC + signer + funds).
- Shared setup helpers in `test/_setup.ts`: `setupReadOnly`,
  `setupSigner`, `setupWithFreshVault`. Don't duplicate the
  `provider / wallet / client / me` boilerplate in test files.
- Shared fixtures (`ADDR_A..D`, `DEAD_ADDRESS`, `ID_DATA_ZERO`,
  `RAW_DATA`, signature `r/s`) live in `test/_fixtures.ts`. Don't redefine
  these in individual test files.
- Test naming convention: `provider`, `wallet`, `client`, `me`
  (running address), `vault`, `ctx` (return value of a setup helper).
- 🚨 `TEST_VAULT_ADDRESS` is **read-only**. Write-side tests must always
  use `setupWithFreshVault()` and operate on a freshly-deployed vault —
  they must never target a user-supplied address.

## Examples

The set under `example/` is meant to be **runnable demos**, not
documentation. The flagship is `multicall-showcase.ts` (full vault setup
in one transaction). When adding a feature, prefer extending an existing
example over creating a new one unless the feature is genuinely separate.

## Style

- Tabs for indentation (matches the existing codebase).
- Avoid `any` in new code; prefer `unknown` + narrowing or explicit types.
- Don't add JSDoc that just restates the function name. Comments earn
  their place by explaining *why* or surfacing a hidden constraint.
