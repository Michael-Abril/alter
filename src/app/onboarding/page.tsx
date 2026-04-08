/**
 * OWNER: Person 4 (Voice/UI) + Person 3 (Orchestration)
 * PURPOSE: Complete onboarding flow — dead simple, no terminal commands
 * DEPENDENCIES: @clerk/nextjs, Canvas API, Gmail OAuth, Claude/ChatGPT scrapers
 * STATUS: LIVE — full working onboarding with real integrations, NO AUTO-ADVANCE
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { CheckCircle2, Loader2, Upload, AlertCircle } from 'lucide-react';

type OnboardingStep = 'welcome' | 'gmail' | 'github' | 'canvas' | 'import' | 'processing' | 'reveal';

interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: string;
}

interface ProcessingStatus {
  stage: 'embedding' | 'profiling' | 'detecting' | 'complete';
  messagesFound: number;
  projectsFound: number;
  progress: number;
}

type ImportSource = 'claude' | 'chatgpt';
type SyncState = 'idle' | 'running' | 'completed' | 'failed' | 'auth_required';

function resolveOnboardingStep(stepParam: string | null): OnboardingStep | null {
  if (!stepParam) return null;
  const normalized = stepParam.toLowerCase();
  const stepMap: Record<string, OnboardingStep> = {
    '1': 'welcome',
    '2': 'gmail',
    '3': 'github',
    '4': 'canvas',
    '5': 'import',
    '6': 'processing',
    '7': 'reveal',
    welcome: 'welcome',
    gmail: 'gmail',
    github: 'github',
    canvas: 'canvas',
    import: 'import',
    processing: 'processing',
    reveal: 'reveal',
  };
  return stepMap[normalized] ?? null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  
  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in?redirect_url=/onboarding');
    }
  }, [isLoaded, isSignedIn, router]);
  
  // Gmail connection state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  
  // GitHub connection state
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [githubError, setGithubError] = useState('');
  
  // Canvas connection state
  const [canvasToken, setCanvasToken] = useState('');
  const [canvasDomain, setCanvasDomain] = useState('babson.instructure.com');
  const [canvasValidating, setCanvasValidating] = useState(false);
  const [canvasConnected, setCanvasConnected] = useState(false);
  const [canvasError, setCanvasError] = useState('');
  
  // Import state - track both Claude and ChatGPT separately
  const [claudeImporting, setClaudeImporting] = useState(false);
  const [claudeStatus, setClaudeStatus] = useState('');
  const [claudeMessages, setClaudeMessages] = useState(0);
  const [chatgptImporting, setChatgptImporting] = useState(false);
  const [chatgptStatus, setChatgptStatus] = useState('');
  const [chatgptMessages, setChatgptMessages] = useState(0);
  const [contextWindowDays, setContextWindowDays] = useState(3);
  const [resettingTestState, setResettingTestState] = useState(false);
  const pollingIntervalRef = useRef<Partial<Record<ImportSource, NodeJS.Timeout>>>({});
  const autoResetDoneRef = useRef(false);
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'embedding' | 'profiling' | 'detecting' | 'complete'>('embedding');
  const [embeddedCount, setEmbeddedCount] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [projectsDetected, setProjectsDetected] = useState(0);
  const [voiceProfileStatus, setVoiceProfileStatus] = useState('');
  
  // Detected projects
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Check if user already has Gmail and GitHub connected
  useEffect(() => {
    checkGmailStatus();
    checkGitHubStatus();
    
    // Check for OAuth callback query params
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get('step');
    const gmailParam = params.get('gmail');
    const githubParam = params.get('github');
    const testResetParam = params.get('testReset');
    const resolvedStep = resolveOnboardingStep(stepParam);

    if (testResetParam === '1' && !autoResetDoneRef.current) {
      autoResetDoneRef.current = true;
      void resetOnboardingTestState(true);
      return;
    }
    
    // Gmail OAuth callback
    if (gmailParam === 'connected') {
      setGmailConnected(true);
      setStep(resolvedStep ?? 'github');
    }
    
    // GitHub OAuth callback
    if (githubParam === 'connected') {
      setGithubConnected(true);
      setStep(resolvedStep ?? 'github');
      fetchGitHubRepos();
    }

    if (resolvedStep && gmailParam !== 'connected' && githubParam !== 'connected') {
      setStep(resolvedStep);
    }
  }, []);

  async function resetOnboardingTestState(silent = false) {
    setResettingTestState(true);
    try {
      const res = await fetch('/api/onboarding/test-reset', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to reset test state');
      }

      // Reset local onboarding view state to mimic fresh first-time user.
      setStep('welcome');
      setGmailConnected(false);
      setGithubConnected(false);
      setGithubRepos([]);
      setSelectedRepo('');
      setGithubError('');
      setCanvasConnected(false);
      setCanvasToken('');
      setCanvasError('');
      setClaudeImporting(false);
      setClaudeStatus('');
      setClaudeMessages(0);
      setChatgptImporting(false);
      setChatgptStatus('');
      setChatgptMessages(0);
      setProcessing(false);
      setProcessingStage('embedding');
      setEmbeddedCount(0);
      setTotalMessages(0);
      setProjectsDetected(0);
      setProjects([]);
      stopPolling();

      if (!silent) {
        alert('Onboarding test state reset. You can now test as a brand-new user.');
      }
    } catch (err: any) {
      console.error('Failed to reset onboarding test state:', err);
      if (!silent) {
        alert(`Reset failed: ${err.message}`);
      }
    } finally {
      setResettingTestState(false);
    }
  }
  
  async function checkGmailStatus() {
    try {
      const res = await fetch('/api/gmail/status');
      const data = await res.json();
      if (data.success && data.data?.connected) {
        setGmailConnected(true);
      }
    } catch (err) {
      console.error('Failed to check Gmail status:', err);
    }
  }
  
  async function connectGmail() {
    setGmailLoading(true);
    try {
      // Try to use Clerk's stored Google token first
      const res = await fetch('/api/gmail/connect', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setGmailConnected(true);
        setGmailLoading(false);
        // Advance to the next step automatically
        setStep('github');
      } else {
        // Fall back to full OAuth redirect — handles Drive + Calendar scopes too
        window.location.href = '/api/gmail/connect?onboarding=true';
      }
    } catch (err) {
      console.error('Failed to connect Gmail:', err);
      setGmailLoading(false);
      window.location.href = '/api/gmail/connect?onboarding=true';
    }
  }
  
  async function checkGitHubStatus() {
    try {
      const res = await fetch('/api/github/status');
      const data = await res.json();
      if (data.success && data.data?.connected) {
        setGithubConnected(true);
        setSelectedRepo(data.data.defaultRepo || '');
      }
    } catch (err) {
      console.error('Failed to check GitHub status:', err);
    }
  }
  
  async function connectGitHub() {
    setGithubLoading(true);
    setGithubError('');
    try {
      window.location.href = '/api/github/connect';
    } catch (err) {
      console.error('Failed to connect GitHub:', err);
      setGithubError('Failed to connect to GitHub. Please try again.');
      setGithubLoading(false);
    }
  }
  
  async function fetchGitHubRepos() {
    try {
      const res = await fetch('/api/github/repos');
      const data = await res.json();
      
      console.log('[onboarding] GitHub repos response:', data);
      
      if (data.success && data.data) {
        setGithubRepos(data.data);
        if (data.data.length === 0) {
          setGithubError('No repositories found. Create a repository on GitHub first, then refresh this page.');
        } else {
          const nightshiftRepo = data.data.find((r: any) => 
            r.name.toLowerCase().includes('nightshift')
          );
          const defaultRepo = nightshiftRepo || data.data[0];
          if (defaultRepo) {
            setSelectedRepo(defaultRepo.fullName);
          }
        }
      } else {
        setGithubError(data.error || 'Failed to load repositories');
      }
    } catch (err: any) {
      console.error('Failed to fetch GitHub repos:', err);
      setGithubError(`Failed to load repositories: ${err.message}`);
    }
  }
  
  async function saveGitHubRepo() {
    if (!selectedRepo) {
      setGithubError('Please select a repository');
      return;
    }
    
    try {
      const [owner, repo] = selectedRepo.split('/');
      const res = await fetch('/api/github/set-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, defaultBranch: 'main' }),
      });
      
      const data = await res.json();
      if (!data.success) {
        setGithubError('Failed to save repository selection');
      }
    } catch (err) {
      console.error('Failed to save GitHub repo:', err);
      setGithubError('Failed to save repository selection');
    }
  }
  
  async function validateCanvas() {
    if (!canvasToken || !canvasDomain) {
      setCanvasError('Please enter both token and domain');
      return;
    }
    
    setCanvasValidating(true);
    setCanvasError('');
    
    try {
      const res = await fetch('/api/canvas/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: canvasToken, domain: canvasDomain }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setCanvasConnected(true);
        setCanvasError('');
      } else {
        setCanvasError(data.error || 'Invalid token or domain');
      }
    } catch (err) {
      setCanvasError('Failed to validate Canvas credentials');
    } finally {
      setCanvasValidating(false);
    }
  }
  
  async function startImport(
    method: ImportSource,
    silent = false,
    options?: { resetProfile?: boolean }
  ) {
    const setImporting = method === 'claude' ? setClaudeImporting : setChatgptImporting;
    const setStatus = method === 'claude' ? setClaudeStatus : setChatgptStatus;
    const setMessages = method === 'claude' ? setClaudeMessages : setChatgptMessages;
    
    stopPolling(method);
    setImporting(true);
    setStatus(silent ? 'Syncing recent context in background...' : 'Starting scraper...');
    setMessages(0);
    
    try {
      // Start the scraper
      const endpoint = method === 'claude' ? '/api/onboarding/import-claude' : '/api/onboarding/import-chatgpt';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: contextWindowDays,
          resetProfile: Boolean(options?.resetProfile),
          // Keep silent prewarm invisible; manual imports open browser like old behavior.
          headless: silent,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setStatus(`Syncing your last ${contextWindowDays} days in the background...`);
        startPollingMessageCount(method);
      } else {
        setStatus('Failed to start scraper');
        setImporting(false);
      }
    } catch (err) {
      console.error('Import failed:', err);
      setStatus('Import failed');
      setImporting(false);
    }
  }
  
  function startPollingMessageCount(method: ImportSource) {
    const setMessages = method === 'claude' ? setClaudeMessages : setChatgptMessages;
    const setStatus = method === 'claude' ? setClaudeStatus : setChatgptStatus;
    const setImporting = method === 'claude' ? setClaudeImporting : setChatgptImporting;

    pollingIntervalRef.current[method] = setInterval(async () => {
      try {
        const res = await fetch(`/api/onboarding/import-status?source=${method}`);
        const data = await res.json();
        
        if (data.success) {
          const syncState = data.data?.state as SyncState;
          const imported = data.data?.importedMessages || 0;
          const message = data.data?.message as string | undefined;
          setMessages(imported);

          if (syncState === 'running') {
            setStatus(message || `Background sync running (${contextWindowDays}d window)...`);
          } else if (syncState === 'completed') {
            stopPolling(method);
            setStatus(message || `✓ Imported ${imported} recent messages`);
            setImporting(false);
          } else if (syncState === 'auth_required') {
            stopPolling(method);
            setStatus(message || 'Sign in to this source once, then retry import.');
            setImporting(false);
          } else if (syncState === 'failed') {
            stopPolling(method);
            setStatus(data.data?.message || 'Import failed');
            setImporting(false);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  }
  
  function stopPolling(method?: ImportSource) {
    if (method) {
      const timer = pollingIntervalRef.current[method];
      if (timer) {
        clearInterval(timer);
        delete pollingIntervalRef.current[method];
      }
      return;
    }
    const claudeTimer = pollingIntervalRef.current.claude;
    const chatgptTimer = pollingIntervalRef.current.chatgpt;
    if (claudeTimer) clearInterval(claudeTimer);
    if (chatgptTimer) clearInterval(chatgptTimer);
    pollingIntervalRef.current = {};
  }

  useEffect(() => {
    return () => stopPolling();
  }, []);
  
  async function handleChatGPTUpload(file: File) {
    setChatgptImporting(true);
    setChatgptStatus('Uploading file...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/onboarding/import-chatgpt', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.success) {
        setChatgptStatus(`✓ Imported ${data.messagesImported || 0} messages`);
        setChatgptMessages(data.messagesImported || 0);
        setChatgptImporting(false);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setChatgptStatus('Upload failed');
      setChatgptImporting(false);
    }
  }
  
  async function startProcessing() {
    setProcessing(true);
    setProcessingStage('embedding');
    setEmbeddedCount(0);
    setProjectsDetected(0);
    
    try {
      // Get total message count
      const statsRes = await fetch(`/api/chat-history/stats?sinceDays=${contextWindowDays}`);
      const statsData = await statsRes.json();
      setTotalMessages(statsData.data?.total || 0);
      
      // Start embedding
      const embedRes = await fetch(`/api/onboarding/embed?sinceDays=${contextWindowDays}`, {
        method: 'POST',
      });
      const embedData = await embedRes.json();
      
      if (embedData.success) {
        setEmbeddedCount(embedData.data?.messagesEmbedded || 0);
        setProcessingStage('profiling');
        setVoiceProfileStatus('Learning your writing style...');

        const voiceRes = await fetch('/api/onboarding/build-profile', { method: 'POST' });
        const voiceData = await voiceRes.json();
        if (voiceData.success) {
          setVoiceProfileStatus('Voice profile created — NightShift will write like you.');
        } else {
          setVoiceProfileStatus('Could not build voice profile yet. Continuing with default style.');
        }

        setProcessingStage('detecting');
        
        // Run project detection
        const detectRes = await fetch(`/api/onboarding/detect-projects?sinceDays=${contextWindowDays}`, {
          method: 'POST',
        });
        const detectData = await detectRes.json();
        
        if (detectData.success) {
          setProjectsDetected(detectData.data?.projectsDetected || 0);
          
          // Fetch detected projects
          const projectsRes = await fetch('/api/projects');
          const projectsData = await projectsRes.json();
          
          if (projectsData.success) {
            setProjects(projectsData.data?.projects || []);
          }
          
          setProcessingStage('complete');
          setProcessing(false);
        }
      }
    } catch (err) {
      console.error('Processing failed:', err);
      setProcessing(false);
    }
  }

  const steps: OnboardingStep[] = ['welcome', 'gmail', 'github', 'canvas', 'import', 'processing', 'reveal'];
  const currentStepIndex = steps.indexOf(step);
  
  // Show loading while checking auth
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-nightshift-bg">
        <Loader2 className="w-8 h-8 animate-spin text-nightshift-accent" />
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-nightshift-bg">
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-end">
          <button
            className="btn-ghost text-xs"
            onClick={() => resetOnboardingTestState(false)}
            disabled={resettingTestState}
          >
            {resettingTestState ? 'Resetting test state...' : 'Reset First-Time Test State'}
          </button>
        </div>
        {/* Progress Bar */}
        <div className="mb-8 flex gap-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStepIndex
                  ? 'bg-nightshift-accent'
                  : 'bg-nightshift-border'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 'welcome' && (
          <div className="card text-center">
            <div className="text-6xl mb-6">🌙</div>
            <h1 className="text-3xl font-bold mb-4">Welcome to NightShift</h1>
            <p className="text-lg text-nightshift-text-secondary mb-8 max-w-md mx-auto">
              NightShift learns how you work and continues your work while you sleep.
            </p>
            <button className="btn-primary w-full max-w-xs mx-auto" onClick={() => setStep('gmail')}>
              Get Started
            </button>
          </div>
        )}

        {/* Step 2: Connect Gmail */}
        {step === 'gmail' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-3">Connect Google</h2>
            <p className="text-nightshift-text-secondary mb-6">
              Enables Gmail drafts, saving documents to Google Drive, and pulling Calendar deadlines into your context.
            </p>
            
            {gmailConnected ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <div>
                  <span className="text-green-500 font-medium">Google Connected</span>
                  <p className="text-xs text-nightshift-text-muted mt-0.5">Gmail, Drive, and Calendar access granted</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-nightshift-bg-light border border-nightshift-border mb-4">
                  <div className="text-sm text-nightshift-text-secondary">
                    <p>Connect your Google account to enable Gmail drafts, Google Drive document saving, and Calendar deadline detection.</p>
                  </div>
                </div>
                <button
                  className="btn-primary w-full mb-3 flex items-center justify-center gap-2"
                  onClick={connectGmail}
                  disabled={gmailLoading}
                >
                  {gmailLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Google'
                  )}
                </button>
              </>
            )}
            
            <div className="flex gap-2 mt-2">
              <button
                className="btn-ghost"
                onClick={() => setStep('welcome')}
              >
                ← Back
              </button>
              <button
                className="btn-ghost flex-1"
                onClick={() => setStep('github')}
              >
                Skip for Now
              </button>
              {gmailConnected && (
                <button
                  className="btn-primary flex-1"
                  onClick={() => setStep('github')}
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Connect GitHub */}
        {step === 'github' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-3">Connect GitHub (Optional)</h2>
            <p className="text-nightshift-text-secondary mb-6">
              Push code continuations as pull requests. If you skip this, code will be saved locally instead.
            </p>
            
            {githubConnected ? (
              <>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <span className="text-green-500 font-medium">GitHub Connected</span>
                </div>
                
                {githubRepos.length > 0 ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Select Repository</label>
                    <select
                      value={selectedRepo}
                      onChange={(e) => setSelectedRepo(e.target.value)}
                      className="w-full px-3 py-2 bg-nightshift-surface border border-nightshift-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nightshift-accent"
                    >
                      {githubRepos.map((repo) => (
                        <option key={repo.id} value={repo.fullName}>
                          {repo.fullName} {repo.private ? '(private)' : '(public)'}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-nightshift-text-secondary mt-2">
                      NightShift will create PRs in this repository
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
                      <AlertCircle className="w-6 h-6 text-yellow-500" />
                      <div className="flex-1 text-sm text-yellow-500">
                        <p className="font-medium">No repositories found</p>
                        <p className="text-xs mt-1">Create a repository on GitHub first</p>
                      </div>
                    </div>
                    <button
                      className="btn-ghost w-full mb-4"
                      onClick={fetchGitHubRepos}
                    >
                      Refresh Repositories
                    </button>
                  </>
                )}
                
                {githubError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 text-sm">{githubError}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  className="btn-primary w-full mb-3 flex items-center justify-center gap-2"
                  onClick={connectGitHub}
                  disabled={githubLoading}
                >
                  {githubLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect GitHub'
                  )}
                </button>
                
                {githubError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 text-sm">{githubError}</span>
                  </div>
                )}
              </>
            )}
            
            <div className="flex gap-2 mt-2">
              <button
                className="btn-ghost"
                onClick={() => setStep('gmail')}
              >
                ← Back
              </button>
              <button
                className="btn-ghost flex-1"
                onClick={() => setStep('canvas')}
              >
                Skip
              </button>
              {githubConnected && selectedRepo && (
                <button
                  className="btn-primary flex-1"
                  onClick={async () => {
                    await saveGitHubRepo();
                    setStep('canvas');
                  }}
                >
                  Confirm & Next →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Connect Canvas */}
        {step === 'canvas' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-3">Connect Canvas (Optional)</h2>
            <p className="text-nightshift-text-secondary mb-6">
              NightShift can track your assignments and deadlines from Canvas LMS.
            </p>
            
            {canvasConnected ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <span className="text-green-500 font-medium">Canvas Connected</span>
              </div>
            ) : (
              <>
                <div className="bg-nightshift-surface p-4 rounded-lg mb-4 text-sm text-nightshift-text-secondary">
                  <p className="font-medium mb-2">How to get your Canvas token:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open Canvas → Account → Settings</li>
                    <li>Scroll to "Approved Integrations"</li>
                    <li>Click "+ New Access Token"</li>
                    <li>Give it a name (e.g., "NightShift") and click "Generate Token"</li>
                    <li>Copy the token and paste it below</li>
                  </ol>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">School Domain</label>
                    <select
                      value={canvasDomain}
                      onChange={(e) => setCanvasDomain(e.target.value)}
                      className="w-full px-3 py-2 bg-nightshift-surface border border-nightshift-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nightshift-accent"
                    >
                      <option value="babson.instructure.com">Babson College</option>
                      <option value="canvas.harvard.edu">Harvard University</option>
                      <option value="canvas.mit.edu">MIT</option>
                      <option value="canvas.stanford.edu">Stanford University</option>
                      <option value="instructure.com">Other (enter below)</option>
                    </select>
                  </div>
                  
                  {canvasDomain === 'instructure.com' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Custom Domain</label>
                      <input
                        type="text"
                        placeholder="yourschool.instructure.com"
                        onChange={(e) => setCanvasDomain(e.target.value)}
                        className="w-full px-3 py-2 bg-nightshift-surface border border-nightshift-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nightshift-accent"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Access Token</label>
                    <input
                      type="password"
                      value={canvasToken}
                      onChange={(e) => setCanvasToken(e.target.value)}
                      placeholder="Paste your Canvas access token here"
                      className="w-full px-3 py-2 bg-nightshift-surface border border-nightshift-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nightshift-accent"
                    />
                  </div>
                </div>
                
                {canvasError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 text-sm">{canvasError}</span>
                  </div>
                )}
                
                <button
                  className="btn-primary w-full mb-3 flex items-center justify-center gap-2"
                  onClick={validateCanvas}
                  disabled={canvasValidating || !canvasToken}
                >
                  {canvasValidating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    'Validate & Connect'
                  )}
                </button>
              </>
            )}
            
            <div className="flex gap-2 mt-2">
              <button
                className="btn-ghost"
                onClick={() => setStep('github')}
              >
                ← Back
              </button>
              <button
                className="btn-ghost flex-1"
                onClick={() => setStep('import')}
              >
                Skip
              </button>
              {canvasConnected && (
                <button
                  className="btn-primary flex-1"
                  onClick={() => setStep('import')}
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Import AI Chat History */}
        {step === 'import' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-3">Import AI Chat History</h2>
            <p className="text-nightshift-text-secondary mb-6">
              NightShift learns from your conversations with AI assistants. You can import from both Claude and ChatGPT.
            </p>
            <div className="mb-4 rounded-lg border border-nightshift-border p-3">
              <label className="mb-2 block text-xs uppercase tracking-wide text-nightshift-text-secondary">
                Context Window
              </label>
              <select
                value={contextWindowDays}
                onChange={(e) => setContextWindowDays(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-nightshift-border bg-nightshift-surface px-3 py-2 text-sm"
              >
                <option value={3}>Last 3 days (default)</option>
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
              </select>
              <p className="mt-2 text-xs text-nightshift-text-secondary">
                Start lightweight, then expand context only when needed.
              </p>
            </div>
            
            <div className="space-y-3 mb-4">
              {/* Claude Import */}
              <div className={`p-4 rounded-lg border transition-colors ${
                claudeMessages > 0 && !claudeImporting ? 'border-green-500/50' :
                claudeStatus.includes('auth') || claudeStatus.includes('Sign in') ? 'border-yellow-500/50' :
                claudeStatus.includes('Failed') || claudeStatus.includes('failed') ? 'border-red-500/50' :
                'border-nightshift-border'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-nightshift-accent/10 flex items-center justify-center">
                    <span className="text-xl">🤖</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Claude</div>
                    <div className="text-xs text-nightshift-text-secondary">
                      Import your Claude conversations
                    </div>
                  </div>
                  {!claudeImporting && (
                    <div className="flex gap-2">
                      <button
                        className="btn-ghost px-4 py-2"
                        onClick={() => startImport('claude')}
                      >
                        {claudeMessages > 0 ? 'Re-import' : 'Import'}
                      </button>
                      <button
                        className="btn-ghost px-3 py-2 text-xs"
                        onClick={() => startImport('claude', false, { resetProfile: true })}
                        title="Clear saved browser session and import fresh"
                      >
                        Reset Session
                      </button>
                    </div>
                  )}
                </div>
                {claudeImporting && (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-nightshift-accent" />
                    <span className="text-nightshift-text-secondary">{claudeStatus}</span>
                  </div>
                )}
                {!claudeImporting && claudeMessages > 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{claudeStatus || `${claudeMessages} messages imported`}</span>
                  </div>
                )}
                {!claudeImporting && claudeMessages === 0 && claudeStatus && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span className="text-nightshift-text-secondary">{claudeStatus}</span>
                  </div>
                )}
              </div>

              {/* ChatGPT Import */}
              <div className={`p-4 rounded-lg border transition-colors ${
                chatgptMessages > 0 && !chatgptImporting ? 'border-green-500/50' :
                chatgptStatus.includes('auth') || chatgptStatus.includes('Sign in') ? 'border-yellow-500/50' :
                chatgptStatus.includes('Failed') || chatgptStatus.includes('failed') ? 'border-red-500/50' :
                'border-nightshift-border'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-nightshift-accent/10 flex items-center justify-center">
                    <span className="text-xl">💬</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">ChatGPT</div>
                    <div className="text-xs text-nightshift-text-secondary">
                      Import your ChatGPT conversations
                    </div>
                  </div>
                  {!chatgptImporting && (
                    <div className="flex gap-2">
                      <button
                        className="btn-ghost px-4 py-2"
                        onClick={() => startImport('chatgpt')}
                      >
                        {chatgptMessages > 0 ? 'Re-import' : 'Import'}
                      </button>
                      <button
                        className="btn-ghost px-3 py-2 text-xs"
                        onClick={() => startImport('chatgpt', false, { resetProfile: true })}
                        title="Clear saved browser session and import fresh"
                      >
                        Reset Session
                      </button>
                    </div>
                  )}
                </div>
                {chatgptImporting && (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-nightshift-accent" />
                    <span className="text-nightshift-text-secondary">{chatgptStatus}</span>
                  </div>
                )}
                {!chatgptImporting && chatgptMessages > 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{chatgptStatus || `${chatgptMessages} messages imported`}</span>
                  </div>
                )}
                {!chatgptImporting && chatgptMessages === 0 && chatgptStatus && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span className="text-nightshift-text-secondary">{chatgptStatus}</span>
                  </div>
                )}
              </div>

              {/* Upload Option */}
              <div className="relative">
                <input
                  type="file"
                  accept=".json,.zip"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleChatGPTUpload(file);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="chatgpt-upload"
                />
                <label
                  htmlFor="chatgpt-upload"
                  className="block w-full p-4 text-left rounded-lg border border-nightshift-border hover:border-nightshift-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-nightshift-accent/10 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-nightshift-accent" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Or Upload Export File</div>
                      <div className="text-xs text-nightshift-text-secondary">
                        Upload ChatGPT or Claude JSON export
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="flex gap-2 mt-2">
              <button
                className="btn-ghost"
                onClick={() => setStep('canvas')}
                disabled={claudeImporting || chatgptImporting}
              >
                ← Back
              </button>
              <button
                className="btn-ghost flex-1"
                onClick={() => setStep('processing')}
                disabled={claudeImporting || chatgptImporting}
              >
                {claudeMessages > 0 || chatgptMessages > 0 ? 'Skip additional imports' : 'Skip'}
              </button>
              {!claudeImporting && !chatgptImporting && (
                <button
                  className="btn-primary flex-1"
                  onClick={() => setStep('processing')}
                >
                  {claudeMessages > 0 || chatgptMessages > 0 ? 'Next →' : 'Continue with existing data →'}
                </button>
              )}
            </div>
            <p className="text-xs text-nightshift-text-muted text-center mt-2">
              If you have previously imported data, you can proceed directly.
            </p>
          </div>
        )}

        {/* Step 6: Processing */}
        {step === 'processing' && (
          <div className="card text-center">
            {!processing && processingStage !== 'complete' ? (
              <>
                <h2 className="text-2xl font-bold mb-3">Ready to Process</h2>
                <p className="text-nightshift-text-secondary mb-6">
                  We'll analyze your conversations and detect your projects. This takes about 30 seconds.
                </p>
                <button
                  className="btn-primary w-full max-w-xs mx-auto"
                  onClick={startProcessing}
                >
                  Start Processing
                </button>
              </>
            ) : processingStage === 'complete' ? (
              <>
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-3">Processing Complete!</h2>
                <p className="text-nightshift-text-secondary mb-6">
                  Embedded {embeddedCount} messages and detected {projectsDetected} projects
                </p>
                <button
                  className="btn-primary w-full max-w-xs mx-auto"
                  onClick={() => setStep('reveal')}
                >
                  See What We Found
                </button>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <Loader2 className="w-16 h-16 animate-spin text-nightshift-accent mx-auto" />
                </div>
                
                <h2 className="text-2xl font-bold mb-3">
                  {processingStage === 'embedding' && 'Embedding your messages...'}
                  {processingStage === 'profiling' && 'Learning your writing style...'}
                  {processingStage === 'detecting' && 'Detecting projects...'}
                </h2>
                
                <p className="text-nightshift-text-secondary mb-6">
                  {processingStage === 'embedding' && `${embeddedCount} of ${totalMessages} messages embedded`}
                  {processingStage === 'profiling' && (voiceProfileStatus || 'Learning your writing style...')}
                  {processingStage === 'detecting' && `Found ${projectsDetected} projects`}
                </p>
              </>
            )}
          </div>
        )}

        {/* Step 7: The Reveal */}
        {step === 'reveal' && (
          <div className="card">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">✨</div>
              <h2 className="text-2xl font-bold mb-2">Here&apos;s what we found you&apos;re working on</h2>
              <p className="text-nightshift-text-secondary">
                NightShift detected {projects.length} active projects from your conversations
              </p>
            </div>
            
            {projects.length > 0 ? (
              <div className="space-y-3 mb-6">
                {projects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className="p-4 rounded-lg border border-nightshift-border bg-nightshift-surface"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-nightshift-text-secondary mt-1">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-nightshift-accent/10 text-nightshift-accent">
                        {project.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-nightshift-bg rounded-full h-1.5">
                        <div
                          className="bg-nightshift-accent h-1.5 rounded-full"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-nightshift-text-secondary">
                        {project.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 mb-6">
                <p className="text-nightshift-text-secondary">
                  No projects detected yet. Start chatting with AI assistants and NightShift will learn what you&apos;re working on!
                </p>
              </div>
            )}
            
            <button
              className="btn-primary w-full"
              onClick={() => router.push('/dashboard')}
            >
              Looks right, let&apos;s go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
