import { env } from '@/env';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const JSON_HEADERS = {
    'Content-Type': 'application/json',
} as const;

const QWEN_CLI_COMMAND = process.env.QWEN_CLI_COMMAND || 'qwen';
const IS_WINDOWS = process.platform === 'win32';

function findRepositoryRoot(startDir: string): string {
    let currentDir = path.resolve(startDir);
    const fsRoot = path.parse(currentDir).root;

    while (true) {
        const hasGit = fs.existsSync(path.join(currentDir, '.git'));
        const hasBunLock = fs.existsSync(path.join(currentDir, 'bun.lock'));
        const hasPackageJson = fs.existsSync(path.join(currentDir, 'package.json'));

        if (hasGit || hasBunLock || hasPackageJson) {
            return currentDir;
        }

        if (currentDir === fsRoot) {
            break;
        }

        currentDir = path.dirname(currentDir);
    }

    return path.resolve(startDir);
}

const repositoryRoot = findRepositoryRoot(process.cwd());

async function runQwen(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const baseArgs = [prompt];

        const command = IS_WINDOWS ? 'cmd.exe' : QWEN_CLI_COMMAND;
        const cli = QWEN_CLI_COMMAND.includes(' ') ? `"${QWEN_CLI_COMMAND}"` : QWEN_CLI_COMMAND;
        const args = IS_WINDOWS ? ['/c', cli, ...baseArgs] : baseArgs;

        const child = spawn(command, args, {
            cwd: repositoryRoot,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') {
                reject(
                    new Error(
                        `Qwen Code CLI command "${QWEN_CLI_COMMAND}" not found. ` +
                            'Install the Qwen Code CLI globally and ensure it is on your PATH, ' +
                            'or set QWEN_CLI_COMMAND to the full path of the executable.',
                    ),
                );
                return;
            }

            reject(error);
        });

        child.on('close', (code: number | null) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                const message = stderr.trim() || `${QWEN_CLI_COMMAND} exited with code ${code}`;
                reject(new Error(message));
            }
        });
    });
}

export async function POST(request: Request): Promise<Response> {
    if (env.NODE_ENV !== 'development') {
        return new Response(
            JSON.stringify({
                error: 'Qwen Code CLI API is only available in development mode.',
            }),
            {
                status: 503,
                headers: JSON_HEADERS,
            },
        );
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({
                error: 'Invalid JSON body.',
            }),
            {
                status: 400,
                headers: JSON_HEADERS,
            },
        );
    }

    const prompt = typeof body === 'object' && body !== null ? (body as { prompt?: unknown }).prompt : undefined;

    if (typeof prompt !== 'string' || !prompt.trim()) {
        return new Response(
            JSON.stringify({
                error: 'Missing or empty "prompt" field.',
            }),
            {
                status: 400,
                headers: JSON_HEADERS,
            },
        );
    }

    try {
        const answer = await runQwen(prompt);

        return new Response(
            JSON.stringify({
                answer,
            }),
            {
                status: 200,
                headers: JSON_HEADERS,
            },
        );
    } catch (error) {
        console.error('[qwen-cli] Error invoking Qwen Code CLI:', error);

        const message = error instanceof Error ? error.message : 'Failed to invoke Qwen Code CLI.';

        return new Response(
            JSON.stringify({
                error: message,
            }),
            {
                status: 500,
                headers: JSON_HEADERS,
            },
        );
    }
}
