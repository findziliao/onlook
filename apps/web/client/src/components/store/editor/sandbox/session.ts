import { CodeProvider, createCodeProviderClient, type Provider } from '@onlook/code-provider';
import { LocalFsBridge } from '@/services/local-fs/bridge';
import type { Branch } from '@onlook/models';
import { makeAutoObservable } from 'mobx';
import type { ErrorManager } from '../error';
import { CLISessionImpl, CLISessionType, type CLISession, type TerminalSession } from './terminal';

export class SessionManager {
    provider: Provider | null = null;
    isConnecting = false;
    terminalSessions = new Map<string, CLISession>();
    activeTerminalSessionId = 'cli';

    constructor(
        private readonly branch: Branch,
        private readonly errorManager: ErrorManager
    ) {
        makeAutoObservable(this);
    }

    /**
     * Legacy entrypoint kept for compatibility with existing call sites.
     * In the local-only fork we ignore sandbox identifiers and delegate
     * to the NodeFs-based local session.
     */
    async start(_sandboxId: string, _userId?: string): Promise<void> {
        await this.startLocal();
    }

    async restartDevServer(): Promise<boolean> {
        if (!this.provider) {
            console.error('No provider found in restartDevServer');
            return false;
        }
        const { task } = await this.provider.getTask({
            args: {
                id: 'dev',
            },
        });
        if (task) {
            await task.restart();
            return true;
        }
        return false;
    }

    async readDevServerLogs(): Promise<string> {
        const result = await this.provider?.getTask({ args: { id: 'dev' } });
        if (result) {
            return await result.task.open();
        }
        return 'Dev server not found';
    }

    getTerminalSession(id: string) {
        return this.terminalSessions.get(id) as TerminalSession | undefined;
    }

    async createTerminalSessions(provider: Provider) {
        const task = new CLISessionImpl(
            'server',
            CLISessionType.TASK,
            provider,
            this.errorManager,
        );
        this.terminalSessions.set(task.id, task);
        const terminal = new CLISessionImpl(
            'terminal',
            CLISessionType.TERMINAL,
            provider,
            this.errorManager,
        );

        this.terminalSessions.set(terminal.id, terminal);
        this.activeTerminalSessionId = task.id;

        // Initialize the sessions after creation
        try {
            await Promise.all([
                task.initTask(),
                terminal.initTerminal()
            ]);
        } catch (error) {
            console.error('Failed to initialize terminal sessions:', error);
        }
    }

    async disposeTerminal(id: string) {
        const terminal = this.terminalSessions.get(id) as TerminalSession | undefined;
        if (terminal) {
            if (terminal.type === CLISessionType.TERMINAL) {
                await terminal.terminal?.kill();
                if (terminal.xterm) {
                    terminal.xterm.dispose();
                }
            }
            this.terminalSessions.delete(id);
        }
    }

    async hibernate(_sandboxId: string) {
        // No-op in local-only mode; there is no remote sandbox to hibernate.
    }

    async reconnect(_sandboxId?: string, _userId?: string) {
        try {
            if (!this.provider) {
                // If there is no active provider, attempt to start a fresh local session.
                await this.startLocal();
                return;
            }

            // Check if the session is still connected
            const isConnected = await this.ping();
            if (isConnected) {
                return;
            }

            // Attempt soft reconnect
            await this.provider?.reconnect();

            const isConnectedAfterReconnect = await this.ping();
            if (isConnectedAfterReconnect) {
                return;
            }

            await this.restartProvider();
        } catch (error) {
            console.error('Failed to reconnect to sandbox', error);
                this.isConnecting = false;
        }
    }

    /**
     * Local-only session initializer using the NodeFs provider.
     * This does not contact CodeSandbox and instead talks to the
     * `/api/local-fs` endpoint via LocalFsBridge.
     *
     * Call this instead of `start` when running in a pure local-editing mode.
     */
    async startLocal(): Promise<void> {
        if (this.isConnecting || this.provider) {
            return;
        }

        this.isConnecting = true;

        try {
            const bridge = new LocalFsBridge();
            const provider = await createCodeProviderClient(CodeProvider.NodeFs, {
                providerOptions: {
                    nodefs: { bridge },
                },
            });

            this.provider = provider;
            await this.createTerminalSessions(provider);
        } catch (error) {
            console.error('Failed to start local NodeFs session:', error);
            this.provider = null;
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    async restartProvider() {
        if (this.provider) {
            await this.provider.destroy();
            this.provider = null;
        }
        await this.startLocal();
    }

    async ping() {
        if (!this.provider) return false;
        try {
            await this.provider.runCommand({ args: { command: 'echo "ping"' } });
            return true;
        } catch (error) {
            console.error('Failed to connect to sandbox', error);
            return false;
        }
    }

    async runCommand(
        command: string,
        streamCallback?: (output: string) => void,
        ignoreError: boolean = false,
    ): Promise<{
        output: string;
        success: boolean;
        error: string | null;
    }> {
        try {
            if (!this.provider) {
                throw new Error('No provider found in runCommand');
            }

            // Append error suppression if ignoreError is true
            const finalCommand = ignoreError ? `${command} 2>/dev/null || true` : command;

            streamCallback?.(finalCommand + '\n');
            const { output } = await this.provider.runCommand({ args: { command: finalCommand } });
            streamCallback?.(output);
            return {
                output,
                success: true,
                error: null,
            };
        } catch (error) {
            console.error('Error running command:', error);
            return {
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }

    async clear() {
        // probably need to be moved in `Provider.destroy()`
        this.terminalSessions.forEach((terminal) => {
            if (terminal.type === CLISessionType.TERMINAL) {
                terminal.terminal?.kill();
                if (terminal.xterm) {
                    terminal.xterm.dispose();
                }
            }
        });
        if (this.provider) {
            await this.provider.destroy();
        }
        this.provider = null;
        this.isConnecting = false;
        this.terminalSessions.clear();
    }
}
