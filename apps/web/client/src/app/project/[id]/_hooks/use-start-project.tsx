'use client';

import { useEditorEngine } from '@/components/store/editor';
import { useEffect, useState } from 'react';
import { useTabActive } from '../_hooks/use-tab-active';

export const useStartProject = () => {
    const editorEngine = useEditorEngine();
    const sandbox = editorEngine.activeSandbox;
    const [error, setError] = useState<string | null>(null);
    const { tabState } = useTabActive();
    const [isSandboxReady, setIsSandboxReady] = useState(false);
    const [isCanvasReady, setIsCanvasReady] = useState(false);

    useEffect(() => {
        if (!sandbox.session.isConnecting) {
            setIsSandboxReady(true);
        }
    }, [sandbox.session.isConnecting]);

    useEffect(() => {
        if (tabState === 'reactivated') {
            // In local mode, reconnect is a no-op for NodeFsProvider.
            sandbox.session.reconnect(editorEngine.projectId);
        }
    }, [tabState, sandbox.session, editorEngine.projectId]);

    useEffect(() => {
        // In pure local mode, initialize a default canvas/frame layout
        // once the sandbox is connected. Frames/content are discovered
        // from the local filesystem by the editor engine itself.
        if (isSandboxReady && !isCanvasReady) {
            try {
                // Ensure canvas has sensible defaults; frames will be
                // created by other parts of the editor as needed.
                editorEngine.canvas.clear();
                setIsCanvasReady(true);
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : 'Failed to initialize local project';
                setError(message);
            }
        }
    }, [editorEngine.canvas, isSandboxReady, isCanvasReady]);

    return { isProjectReady: isSandboxReady && isCanvasReady, error };
}
