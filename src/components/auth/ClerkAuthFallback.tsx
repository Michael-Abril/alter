/** Spinner while Clerk auth UI resolves search params / hydrates (avoids hydration mismatch). */
export function ClerkAuthFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nightshift-bg">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-nightshift-border border-t-nightshift-accent"
        aria-hidden
      />
    </div>
  );
}
