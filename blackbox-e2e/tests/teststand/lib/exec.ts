import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface RunResult {
	stdout: string;
	stderr: string;
}

export interface RunOptions {
	/** Throw on a non-zero exit code (default true). */
	check?: boolean;
	timeoutMs?: number;
	cwd?: string;
}

/**
 * Run a system binary (mpremote / esptool / gpioget / nmcli / docker …).
 *
 * We shell out to these tools because there is no native TS equivalent — the
 * orchestration itself stays in TypeScript per project convention.
 */
export async function run(bin: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
	const { check = true, timeoutMs = 120_000, cwd } = opts;
	console.log(`$ ${bin} ${args.join(' ')}`);
	try {
		const { stdout, stderr } = await execFileAsync(bin, args, { timeout: timeoutMs, cwd });
		return { stdout, stderr };
	} catch (err: unknown) {
		const e = err as { stdout?: string; stderr?: string; message?: string };
		if (!check) {
			return { stdout: e.stdout ?? '', stderr: e.stderr ?? e.message ?? '' };
		}
		throw new Error(
			`Command failed: ${bin} ${args.join(' ')}\n${e.stderr ?? e.message ?? 'unknown error'}`
		);
	}
}

/**
 * Run a command streaming its output live (for long-running children like the
 * Playwright runner). Resolves with the exit code.
 */
export function spawnStream(
	bin: string,
	args: string[],
	opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<number> {
	console.log(`$ ${bin} ${args.join(' ')}`);
	return new Promise((resolve, reject) => {
		const child = spawn(bin, args, { cwd: opts.cwd, env: opts.env, stdio: 'inherit' });
		child.on('error', reject);
		child.on('close', (code) => resolve(code ?? 1));
	});
}
