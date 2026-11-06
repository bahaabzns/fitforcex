'use client';

import { useGettingStartedContext } from "@/app/components/gettingStarted/GettingStartedProvider";

// The new owner's getting-started checklist. The shared copy lives in GettingStartedProvider (mounted once in the
// coach layout) so the header button, the dashboard card, the arrow guide and the celebration always agree.
export default function useGettingStarted() {
    return useGettingStartedContext();
}
