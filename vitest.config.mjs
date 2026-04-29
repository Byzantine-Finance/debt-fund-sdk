import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Each integration-write test spawns its own Anvil + creates a vault
		// — comfortable headroom on slow machines.
		testTimeout: 60_000,
		include: [
			"test/unit/**/*.test.ts",
			"test/integration-read/**/*.test.ts",
			"test/integration-write/**/*.test.ts",
		],
	},
});
