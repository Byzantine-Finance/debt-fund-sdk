/**
 * Anvil spawning helper — boots a local fork on a free port for the
 * lifetime of a single test.
 *
 * Requires the `anvil` binary on PATH (install Foundry).
 */

import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

export interface AnvilArgs {
	/** RPC URL to fork from. */
	forkUrl: string;
	/** Block to pin the fork at. Defaults to "latest". */
	forkBlockNumber?: number;
	/** Override the chain ID exposed by the fork (handy for some test scenarios). */
	chainId?: number;
	/** Extra raw CLI args appended to `anvil`. */
	extraArgs?: string[];
}

export interface AnvilHandle {
	rpcUrl: string;
	port: number;
	/** Kill Anvil and resolve once the OS has reaped the process. */
	stop: () => Promise<void>;
}

/** Find a free TCP port by binding to port 0 and reading what the OS gave us. */
function findFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = createServer();
		srv.unref();
		srv.on("error", reject);
		srv.listen(0, () => {
			const addr = srv.address();
			if (typeof addr === "object" && addr) {
				const port = addr.port;
				srv.close(() => resolve(port));
			} else {
				srv.close();
				reject(new Error("Could not allocate a port"));
			}
		});
	});
}

/** Block until the JSON-RPC endpoint responds to `eth_chainId`. */
async function waitForRpc(rpcUrl: string, timeoutMs = 10_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(rpcUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jsonrpc: "2.0",
					method: "eth_chainId",
					id: 1,
				}),
			});
			if (res.ok) return;
		} catch {
			/* not ready yet */
		}
		await sleep(50);
	}
	throw new Error(
		`Anvil at ${rpcUrl} did not become ready within ${timeoutMs}ms`,
	);
}

/**
 * Spawn an Anvil instance forking from `args.forkUrl` on a free local port.
 * The returned `stop()` kills the process.
 */
export async function spawnAnvil(args: AnvilArgs): Promise<AnvilHandle> {
	const port = await findFreePort();

	const cliArgs: string[] = [
		"--port",
		String(port),
		"--silent",
		"--fork-url",
		args.forkUrl,
	];
	if (args.forkBlockNumber !== undefined) {
		cliArgs.push("--fork-block-number", String(args.forkBlockNumber));
	}
	if (args.chainId !== undefined) {
		cliArgs.push("--chain-id", String(args.chainId));
	}
	if (args.extraArgs?.length) cliArgs.push(...args.extraArgs);

	let proc: ChildProcess;
	try {
		proc = spawn("anvil", cliArgs, {
			stdio: ["ignore", "ignore", "pipe"],
		});
	} catch (err) {
		throw new Error(
			`Failed to spawn anvil: ${err}. Is Foundry installed? https://book.getfoundry.sh/getting-started/installation`,
		);
	}

	// Surface unexpected exit reasons (port taken, anvil crash, etc.).
	let earlyError: string | undefined;
	proc.stderr?.on("data", (chunk: Buffer) => {
		earlyError = (earlyError ?? "") + chunk.toString();
	});
	proc.on("exit", (code) => {
		if (code !== null && code !== 0 && !earlyError) {
			earlyError = `anvil exited with code ${code}`;
		}
	});

	const rpcUrl = `http://127.0.0.1:${port}`;
	try {
		await waitForRpc(rpcUrl);
	} catch (err) {
		proc.kill();
		throw new Error(
			`${err instanceof Error ? err.message : err}${earlyError ? ` (anvil stderr: ${earlyError})` : ""}`,
		);
	}

	return {
		rpcUrl,
		port,
		stop: () => {
			if (proc.exitCode !== null || proc.signalCode !== null) {
				return Promise.resolve();
			}
			return new Promise<void>((resolve) => {
				proc.once("exit", () => resolve());
				try {
					proc.kill();
				} catch {
					// Already gone — `exit` may not fire, so unblock manually.
					resolve();
				}
			});
		},
	};
}
