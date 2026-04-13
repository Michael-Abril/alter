/** Spinner while Clerk chunk loads — keep compact so it nests under the page header. */
export function ClerkAuthFallback() {
  return (
    <div className="flex justify-center py-10" role="status" aria-label="Loading sign-in">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-nightshift-border border-t-nightshift-accent"
        aria-hidden
      />
    </div>
  );
}
