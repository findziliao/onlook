'use client';

import { observer } from 'mobx-react-lite';

// In the local-only fork, the inline overlay buttons (mini chat / open code)
// are non-essential. We keep a minimal stub here to satisfy imports and
// avoid pulling in any additional backend dependencies.
export const OverlayButtons = observer(() => {
    return null;
});

