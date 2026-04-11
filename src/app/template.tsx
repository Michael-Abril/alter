/**
 * Keeps route transitions on a dark surface (reduces light flashes between pages).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-nightshift-bg">{children}</div>;
}
