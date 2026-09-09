import dynamic from 'next/dynamic';

// Reviewed modules use literal imports so Next.js can build separate bundles.
// Keep module registration here; AppHub does not need app-specific branches.
export const APP_COMPONENTS = Object.freeze({
  immunization: dynamic(() => import('../apps/immunization'), {
    ssr: false, loading: () => <p role="status">Loading app...</p>
  })
});
