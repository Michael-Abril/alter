export default function TestPage() {
  return (
    <div className="min-h-screen bg-nightshift-bg text-nightshift-text-primary p-8">
      <h1 className="text-3xl font-bold mb-4">NightShift AI - Test Page</h1>
      <p className="mb-4">This is a test page to verify the app is running.</p>
      <div className="space-y-2">
        <a href="/dashboard" className="text-nightshift-accent hover:underline">Dashboard</a>
        <br />
        <a href="/api/brief" className="text-nightshift-accent hover:underline">API: /api/brief</a>
      </div>
    </div>
  );
}
