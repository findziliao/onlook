import { env } from '@/env';
import type {
    CopyFilesInput,
    DeleteFilesInput,
    ListFilesInput,
    ReadFileInput,
    RenameFileInput,
    StatFileInput,
    WriteFileInput,
} from '@onlook/code-provider';
import type { SandboxFile } from '@onlook/models/src/sandbox';
import path from 'node:path';
import fs from 'node:fs/promises';
import { z } from 'zod';

const requestSchema = z.object({
    action: z.enum([
        'readFile',
        'writeFile',
        'listFiles',
        'deleteFiles',
        'createDirectory',
        'renameFile',
        'statFile',
        'copyFiles',
    ]),
    args: z.record(z.unknown()).optional(),
});

function getBaseDir(): string {
    const baseDir = env.LOCAL_FS_ROOT;
    if (!baseDir) {
        throw new Error('LOCAL_FS_ROOT is not configured');
    }
    return path.resolve(baseDir);
}

function resolveSafePath(relativePath: string): string {
    const baseDir = getBaseDir();
    const normalized = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    const fullPath = path.resolve(baseDir, normalized);

    if (!fullPath.startsWith(baseDir)) {
        throw new Error('Access outside of LOCAL_FS_ROOT is not allowed');
    }

    return fullPath;
}

export async function POST(request: Request): Promise<Response> {
    try {
        const json = await request.json();
        const { action, args } = requestSchema.parse(json);

        switch (action) {
            case 'readFile':
                return new Response(JSON.stringify(await handleReadFile(args as ReadFileInput['args'])), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            case 'writeFile':
                await handleWriteFile(args as WriteFileInput['args']);
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            case 'listFiles':
                return new Response(JSON.stringify(await handleListFiles(args as ListFilesInput['args'])), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            case 'deleteFiles':
                await handleDeleteFiles(args as DeleteFilesInput['args']);
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            case 'createDirectory':
                await handleCreateDirectory(args as { path: string });
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            case 'renameFile':
                await handleRenameFile(args as RenameFileInput['args']);
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            case 'statFile':
                return new Response(JSON.stringify(await handleStatFile(args as StatFileInput['args'])), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            case 'copyFiles':
                await handleCopyFiles(args as CopyFilesInput['args']);
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            default:
                return new Response(JSON.stringify({ error: 'Unsupported action' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
        }
    } catch (error) {
        console.error('[local-fs] Error handling request:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

async function handleReadFile(args: ReadFileInput['args']): Promise<{ file: SandboxFile }> {
    const fullPath = resolveSafePath(args.path);
    const buffer = await fs.readFile(fullPath);
    const content = buffer.toString('utf8');

    const file: SandboxFile = {
        path: args.path,
        type: 'text',
        content,
    };

    return { file };
}

async function handleWriteFile(args: WriteFileInput['args']): Promise<void> {
    const fullPath = resolveSafePath(args.path);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });

    if (typeof args.content === 'string') {
        await fs.writeFile(fullPath, args.content, 'utf8');
    } else {
        const buffer = Buffer.from(args.content as Uint8Array);
        await fs.writeFile(fullPath, buffer);
    }
}

async function handleListFiles(args: ListFilesInput['args']) {
    const dirPath = resolveSafePath(args.path);

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return {
        files: entries.map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            isSymlink: entry.isSymbolicLink(),
        })),
    };
}

async function handleDeleteFiles(args: DeleteFilesInput['args']): Promise<void> {
    const fullPath = resolveSafePath(args.path);
    await fs.rm(fullPath, { recursive: args.recursive ?? false, force: true });
}

async function handleCreateDirectory(args: { path: string }): Promise<void> {
    const fullPath = resolveSafePath(args.path);
    await fs.mkdir(fullPath, { recursive: true });
}

async function handleRenameFile(args: RenameFileInput['args']): Promise<void> {
    const fromPath = resolveSafePath(args.oldPath);
    const toPath = resolveSafePath(args.newPath);
    const toDir = path.dirname(toPath);
    await fs.mkdir(toDir, { recursive: true });
    await fs.rename(fromPath, toPath);
}

async function handleStatFile(args: StatFileInput['args']) {
    const fullPath = resolveSafePath(args.path);
    const stats = await fs.stat(fullPath);

    return {
        type: stats.isDirectory() ? 'directory' : 'file',
        isSymlink: false,
        size: stats.size,
        mtime: stats.mtimeMs,
        ctime: stats.ctimeMs,
        atime: stats.atimeMs,
    };
}

async function handleCopyFiles(args: CopyFilesInput['args']): Promise<void> {
    const sourcePath = resolveSafePath(args.sourcePath);
    const targetPath = resolveSafePath(args.targetPath);

    const stat = await fs.stat(sourcePath);

    if (stat.isDirectory()) {
        await copyDirectoryRecursive(sourcePath, targetPath, !!args.overwrite);
    } else {
        await copyFile(sourcePath, targetPath, !!args.overwrite);
    }
}

async function copyDirectoryRecursive(sourceDir: string, targetDir: string, overwrite: boolean) {
    await fs.mkdir(targetDir, { recursive: true });
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            await copyDirectoryRecursive(sourcePath, targetPath, overwrite);
        } else if (entry.isFile()) {
            await copyFile(sourcePath, targetPath, overwrite);
        }
    }
}

async function copyFile(sourcePath: string, targetPath: string, overwrite: boolean) {
    const targetDir = path.dirname(targetPath);
    await fs.mkdir(targetDir, { recursive: true });

    if (!overwrite) {
        try {
            await fs.access(targetPath);
            // Target exists and overwrite is false; skip copy.
            return;
        } catch {
            // Target does not exist; continue.
        }
    }

    const buffer = await fs.readFile(sourcePath);
    await fs.writeFile(targetPath, buffer);
}

