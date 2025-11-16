'use client';

import type {
    CopyFilesInput,
    DeleteFilesInput,
    DownloadFilesInput,
    ListFilesInput,
    ReadFileInput,
    RenameFileInput,
    StatFileInput,
    TerminalCommandInput,
    WriteFileInput,
} from '@onlook/code-provider';
import type { NodeFsBridge } from '@onlook/code-provider';
import type { SandboxFile } from '@onlook/models/src/sandbox';

interface LocalFsReadFileResponse {
    file: SandboxFile;
}

type LocalFsListFilesResponse = {
    files: {
        name: string;
        type: 'file' | 'directory';
        isSymlink: boolean;
    }[];
};

export class LocalFsBridge implements NodeFsBridge {
    private async post<T>(action: string, args: unknown): Promise<T> {
        const response = await fetch('/api/local-fs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, args }),
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(
                `[LocalFsBridge] Request failed: ${response.status} ${response.statusText} ${errorBody}`,
            );
        }

        return (await response.json()) as T;
    }

    async writeFile(args: WriteFileInput['args']): Promise<void> {
        const content =
            typeof args.content === 'string'
                ? args.content
                : new TextDecoder().decode(args.content);

        await this.post('writeFile', {
            ...args,
            content,
        });
    }

    async readFile(args: ReadFileInput['args']) {
        const res = await this.post<LocalFsReadFileResponse>('readFile', args);
        const file: SandboxFile & { toString: () => string } = {
            ...res.file,
            toString: () => {
                return typeof res.file.content === 'string' ? res.file.content : '';
            },
        };
        return { file };
    }

    async listFiles(args: ListFilesInput['args']) {
        return this.post<LocalFsListFilesResponse>('listFiles', args);
    }

    async deleteFiles(args: DeleteFilesInput['args']): Promise<void> {
        await this.post('deleteFiles', args);
    }

    async createDirectory(args: { path: string }): Promise<void> {
        await this.post('createDirectory', args);
    }

    async renameFile(args: RenameFileInput['args']): Promise<void> {
        await this.post('renameFile', args);
    }

    async statFile(args: StatFileInput['args']) {
        return this.post('statFile', args);
    }

    async copyFiles(args: CopyFilesInput['args']): Promise<void> {
        await this.post('copyFiles', args);
    }

    async downloadFiles(_args: DownloadFilesInput['args']) {
        // Not implemented for local filesystem bridge for now.
        return { url: undefined };
    }

    async runCommand(_args: TerminalCommandInput['args']) {
        // Local dev server and commands are expected to be managed outside of the web app.
        return { output: '' };
    }

    async gitStatus() {
        // Git status is not implemented for local filesystem bridge by default.
        return { changedFiles: [] };
    }
}

