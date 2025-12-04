/**
 * Debug component to check if server can read env vars at runtime
 * This helps diagnose if the issue is server-side env var access
 */

export function MetaPixelDebug() {
  // This will only run on the server
  if (typeof window !== 'undefined') {
    return null; // Don't render on client
  }

  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  const allNextPublicVars = Object.keys(process.env)
    .filter(key => key.startsWith('NEXT_PUBLIC_'))
    .reduce((acc, key) => {
      acc[key] = process.env[key];
      return acc;
    }, {} as Record<string, string | undefined>);

  // Log to server console (visible in dokku logs)
  console.log('=== Meta Pixel Debug (Server-Side) ===');
  console.log('NEXT_PUBLIC_FB_PIXEL_ID:', pixelId || '(NOT SET)');
  console.log('All NEXT_PUBLIC_* vars:', JSON.stringify(allNextPublicVars, null, 2));
  console.log('process.env keys count:', Object.keys(process.env).length);
  console.log('========================================');

  return null; // This component doesn't render anything
}

