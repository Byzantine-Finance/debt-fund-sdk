import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Each integration test that mutates chain state can take several
		// seconds (createVault + multicall + receipt waits).
		testTimeout: 60_000,
		// RPC-bound tests share rate limits and chain state — sequential
		// execution avoids flakiness without meaningful speedup loss.
		fileParallelism: false,
		include: [
			"test/unit/**/*.test.ts",
			"test/integration-read/**/*.test.ts",
			"test/integration-write/**/*.test.ts",
		],
	},
});
