import ZenFS, { configure, InMemory } from '@zenfs/core';

let configPromise: Promise<void> | null = null;

export async function getFS(): Promise<typeof ZenFS> {
    // Use a single promise to ensure configuration only happens once
    configPromise ??= configure({
        mounts: {
            '/': {
                // In the local-only fork we do not need persistent
                // browser storage here; an in-memory backend avoids
                // IndexedDB/DOM dependencies and works in all runtimes.
                backend: InMemory,
            },
        },
    }).catch((err) => {
        // Reset on error so it can be retried
        configPromise = null;
        throw err;
    });

    await configPromise;
    return ZenFS;
}
