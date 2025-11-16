import {
    Provider,
    ProviderBackgroundCommand,
    ProviderFileWatcher,
    ProviderTask,
    ProviderTerminal,
    type CopyFileOutput,
    type CopyFilesInput,
    type CreateDirectoryInput,
    type CreateDirectoryOutput,
    type CreateProjectInput,
    type CreateProjectOutput,
    type CreateSessionInput,
    type CreateSessionOutput,
    type CreateTerminalInput,
    type CreateTerminalOutput,
    type DeleteFilesInput,
    type DeleteFilesOutput,
    type DownloadFilesInput,
    type DownloadFilesOutput,
    type GetTaskInput,
    type GetTaskOutput,
    type GitStatusInput,
    type GitStatusOutput,
    type InitializeInput,
    type InitializeOutput,
    type ListFilesInput,
    type ListFilesOutput,
    type ListProjectsInput,
    type ListProjectsOutput,
    type PauseProjectInput,
    type PauseProjectOutput,
    type ReadFileInput,
    type ReadFileOutput,
    type RenameFileInput,
    type RenameFileOutput,
    type SetupInput,
    type SetupOutput,
    type StatFileInput,
    type StatFileOutput,
    type StopProjectInput,
    type StopProjectOutput,
    type TerminalBackgroundCommandInput,
    type TerminalBackgroundCommandOutput,
    type TerminalCommandInput,
    type TerminalCommandOutput,
    type WatchEvent,
    type WatchFilesInput,
    type WatchFilesOutput,
    type WriteFileInput,
    type WriteFileOutput,
} from '../../types';

/**
 * Bridge interface that allows NodeFsProvider to delegate actual filesystem and
 * command operations to an environment-specific implementation (e.g. a Next.js
 * API route, tRPC router, or local Node process).
 *
 * This keeps @onlook/code-provider free of direct Node.js or browser APIs.
 */
export interface NodeFsBridge {
    writeFile(args: WriteFileInput['args']): Promise<void>;
    readFile(args: ReadFileInput['args']): Promise<ReadFileOutput>;
    listFiles(args: ListFilesInput['args']): Promise<ListFilesOutput>;
    deleteFiles(args: DeleteFilesInput['args']): Promise<void>;
    createDirectory(args: CreateDirectoryInput['args']): Promise<void>;
    renameFile(args: RenameFileInput['args']): Promise<void>;
    statFile(args: StatFileInput['args']): Promise<StatFileOutput>;
    copyFiles?(args: CopyFilesInput['args']): Promise<void>;
    downloadFiles?(args: DownloadFilesInput['args']): Promise<DownloadFilesOutput>;
    watchFiles?(input: WatchFilesInput): Promise<WatchFilesOutput>;
    runCommand?(args: TerminalCommandInput['args']): Promise<TerminalCommandOutput>;
    gitStatus?(): Promise<GitStatusOutput>;
}

export interface NodeFsProviderOptions {
    bridge?: NodeFsBridge;
}

export class NodeFsProvider extends Provider {
    private readonly options: NodeFsProviderOptions;

    constructor(options: NodeFsProviderOptions) {
        super();
        this.options = options;
    }

    private get bridge(): NodeFsBridge {
        if (!this.options.bridge) {
            throw new Error('NodeFsProvider bridge is not configured');
        }
        return this.options.bridge;
    }

    async initialize(_input: InitializeInput): Promise<InitializeOutput> {
        return {};
    }

    async writeFile(input: WriteFileInput): Promise<WriteFileOutput> {
        await this.bridge.writeFile(input.args);
        return {
            success: true,
        };
    }

    async renameFile(input: RenameFileInput): Promise<RenameFileOutput> {
        await this.bridge.renameFile(input.args);
        return {};
    }

    async statFile(input: StatFileInput): Promise<StatFileOutput> {
        return this.bridge.statFile(input.args);
    }

    async deleteFiles(input: DeleteFilesInput): Promise<DeleteFilesOutput> {
        await this.bridge.deleteFiles(input.args);
        return {};
    }

    async listFiles(input: ListFilesInput): Promise<ListFilesOutput> {
        return this.bridge.listFiles(input.args);
    }

    async readFile(input: ReadFileInput): Promise<ReadFileOutput> {
        return this.bridge.readFile(input.args);
    }

    async downloadFiles(input: DownloadFilesInput): Promise<DownloadFilesOutput> {
        if (!this.bridge.downloadFiles) {
            return { url: undefined };
        }
        return this.bridge.downloadFiles(input.args);
    }

    async copyFiles(input: CopyFilesInput): Promise<CopyFileOutput> {
        if (this.bridge.copyFiles) {
            await this.bridge.copyFiles(input.args);
        }
        return {};
    }

    async createDirectory(input: CreateDirectoryInput): Promise<CreateDirectoryOutput> {
        await this.bridge.createDirectory(input.args);
        return {};
    }

    async watchFiles(input: WatchFilesInput): Promise<WatchFilesOutput> {
        if (!this.bridge.watchFiles) {
            return {
                watcher: new NodeFsFileWatcher(),
            };
        }
        return this.bridge.watchFiles(input);
    }

    async createTerminal(_input: CreateTerminalInput): Promise<CreateTerminalOutput> {
        return {
            terminal: new NodeFsTerminal(),
        };
    }

    async getTask(_input: GetTaskInput): Promise<GetTaskOutput> {
        return {
            task: new NodeFsTask(),
        };
    }

    async runCommand(input: TerminalCommandInput): Promise<TerminalCommandOutput> {
        if (!this.bridge.runCommand) {
            return {
                output: '',
            };
        }
        return this.bridge.runCommand(input.args);
    }

    async runBackgroundCommand(
        _input: TerminalBackgroundCommandInput,
    ): Promise<TerminalBackgroundCommandOutput> {
        return {
            command: new NodeFsCommand(),
        };
    }

    async gitStatus(_input: GitStatusInput): Promise<GitStatusOutput> {
        if (!this.bridge.gitStatus) {
            return {
                changedFiles: [],
            };
        }
        return this.bridge.gitStatus();
    }

    async setup(_input: SetupInput): Promise<SetupOutput> {
        return {};
    }

    async createSession(_input: CreateSessionInput): Promise<CreateSessionOutput> {
        return {};
    }

    async reload(): Promise<boolean> {
        return true;
    }

    async reconnect(): Promise<void> {
        // Intentionally a no-op for now; reconnection semantics are handled by the bridge.
    }

    async ping(): Promise<boolean> {
        return true;
    }

    static async createProject(input: CreateProjectInput): Promise<CreateProjectOutput> {
        return {
            id: input.id,
        };
    }

    static async createProjectFromGit(_input: {
        repoUrl: string;
        branch: string;
    }): Promise<CreateProjectOutput> {
        throw new Error('createProjectFromGit not implemented for NodeFs provider');
    }

    async pauseProject(_input: PauseProjectInput): Promise<PauseProjectOutput> {
        return {};
    }

    async stopProject(_input: StopProjectInput): Promise<StopProjectOutput> {
        return {};
    }

    async listProjects(_input: ListProjectsInput): Promise<ListProjectsOutput> {
        return {};
    }

    async destroy(): Promise<void> {
        // Bridge implementations may hold resources; they can expose their own cleanup if needed.
    }
}

export class NodeFsFileWatcher extends ProviderFileWatcher {
    start(input: WatchFilesInput): Promise<void> {
        return Promise.resolve();
    }

    stop(): Promise<void> {
        return Promise.resolve();
    }

    registerEventCallback(callback: (event: WatchEvent) => Promise<void>): void {
        // TODO: Implement
    }
}

export class NodeFsTerminal extends ProviderTerminal {
    get id(): string {
        return 'unimplemented';
    }

    get name(): string {
        return 'unimplemented';
    }

    open(): Promise<string> {
        return Promise.resolve('');
    }

    write(): Promise<void> {
        return Promise.resolve();
    }

    run(): Promise<void> {
        return Promise.resolve();
    }

    kill(): Promise<void> {
        return Promise.resolve();
    }

    onOutput(callback: (data: string) => void): () => void {
        return () => {};
    }
}

export class NodeFsTask extends ProviderTask {
    get id(): string {
        return 'unimplemented';
    }

    get name(): string {
        return 'unimplemented';
    }

    get command(): string {
        return 'unimplemented';
    }

    open(): Promise<string> {
        return Promise.resolve('');
    }

    run(): Promise<void> {
        return Promise.resolve();
    }

    restart(): Promise<void> {
        return Promise.resolve();
    }

    stop(): Promise<void> {
        return Promise.resolve();
    }

    onOutput(callback: (data: string) => void): () => void {
        return () => {};
    }
}

export class NodeFsCommand extends ProviderBackgroundCommand {
    get name(): string {
        return 'unimplemented';
    }

    get command(): string {
        return 'unimplemented';
    }

    open(): Promise<string> {
        return Promise.resolve('');
    }

    restart(): Promise<void> {
        return Promise.resolve();
    }

    kill(): Promise<void> {
        return Promise.resolve();
    }

    onOutput(callback: (data: string) => void): () => void {
        return () => {};
    }
}
