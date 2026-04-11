/**
 * OWNER: Person 4 (Voice/UI) + Person 3 (Orchestration)
 * PURPOSE: Complete onboarding flow — dead simple, no terminal commands
 * DEPENDENCIES: @clerk/nextjs, Canvas API, Gmail OAuth, Claude/ChatGPT scrapers
 * STATUS: LIVE — full working onboarding with real integrations
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { CheckCircle2, Loader2, Upload, AlertCircle, Circle, Bot, MessageSquare } from 'lucide-react';
import { AlterLogo } from '@/components/brand/AlterLogo';

type OnboardingStep = 'welcome' | 'gmail' | 'github' | 'canvas' | 'import' | 'processing' | 'reveal';

interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: string;
}

type ParallelTaskStatus = 'pending' | 'running' | 'done' | 'failed';

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
  const [canvasDomain, setCanvasDomain] = useState('');
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
  /** One post-OAuth server snapshot (Gmail + Calendar + Canvas) so users who click through fast still get data. */
  const integrationPrefetchDoneRef = useRef(false);
  /** Timestamp of last successful snapshot so processing can skip a duplicate run. */
  const lastSnapshotTimeRef = useRef(0);

  /** Demo: skip scrapers and use messages already in the DB */
  type ImportStrategy = 'none' | 'scraper' | 'existing';
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('none');
  const [dbMessageTotal, setDbMessageTotal] = useState(0);
  const [processingSummaryLine, setProcessingSummaryLine] = useState('');
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processingDone, setProcessingDone] = useState(false);
  const [embeddedCount, setEmbeddedCount] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [projectsDetected, setProjectsDetected] = useState(0);
  const [voiceProfileStatus, setVoiceProfileStatus] = useState('');
  const [embedStatus, setEmbedStatus] = useState<ParallelTaskStatus>('pending');
  const [profileStatus, setProfileStatus] = useState<ParallelTaskStatus>('pending');
  const [detectStatus, setDetectStatus] = useState<ParallelTaskStatus>('pending');
  const processingStartedRef = useRef(false);
  
  // Detected projects
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Check if user already has Gmail and GitHub connected
  useEffect(() => {
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

    checkGmailStatus();
    checkGitHubStatus();
    checkMessageCounts();
    
    // Gmail OAuth callback — stay on Gmail; user clicks Next when ready
    if (gmailParam === 'connected') {
      setGmailConnected(true);
      setStep(resolvedStep ?? 'gmail');
      if (!integrationPrefetchDoneRef.current) {
        integrationPrefetchDoneRef.current = true;
        lastSnapshotTimeRef.current = Date.now();
        void fetch('/api/onboarding/integration-snapshot', { method: 'POST' }).catch(() => {});
      }
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
      setProcessingDone(false);
      setEmbedStatus('pending');
      setProfileStatus('pending');
      setDetectStatus('pending');
      setEmbeddedCount(0);
      setTotalMessages(0);
      setProjectsDetected(0);
      setProjects([]);
      setImportStrategy('none');
      setDbMessageTotal(0);
      setProcessingSummaryLine('');
      processingStartedRef.current = false;
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
        lastSnapshotTimeRef.current = Date.now();
        void fetch('/api/onboarding/integration-snapshot', { method: 'POST' }).catch(() => {});
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

  async function checkMessageCounts() {
    try {
      const [claudeRes, chatgptRes] = await Promise.all([
        fetch('/api/onboarding/import-status?source=claude'),
        fetch('/api/onboarding/import-status?source=chatgpt'),
      ]);
      const [claudeData, chatgptData] = await Promise.all([
        claudeRes.json(),
        chatgptRes.json(),
      ]);
      if (claudeData.success) {
        const count = claudeData.data?.importedMessages || 0;
        if (count > 0) {
          setClaudeMessages(count);
          setClaudeStatus(`${count} Claude messages ready`);
        }
      }
      if (chatgptData.success) {
        const count = chatgptData.data?.importedMessages || 0;
        if (count > 0) {
          setChatgptMessages(count);
          setChatgptStatus(`${count} ChatGPT messages ready`);
        }
      }
    } catch (err) {
      console.error('Failed to check message counts:', err);
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
        lastSnapshotTimeRef.current = Date.now();
        void fetch('/api/onboarding/integration-snapshot', { method: 'POST' }).catch(() => {});
      } else {
        setCanvasError(data.error || 'Invalid token or domain');
      }
    } catch (err) {
      setCanvasError('Failed to validate Canvas credentials');
    } finally {
      setCanvasValidating(false);
    }
  }
  
  function chooseUseExistingData() {
    stopPolling();
    setClaudeImporting(false);
    setChatgptImporting(false);
    setImportStrategy('existing');
    setClaudeStatus('');
    setChatgptStatus('');
    void fetch('/api/chat-history/stats')
      .then(async (res) => res.json())
      .then((j) => {
        const n = j.success ? (j.data?.total as number) ?? 0 : 0;
        setDbMessageTotal(n);
        setClaudeMessages(0);
        setChatgptMessages(0);
        setClaudeStatus(
          n > 0
            ? `Using ${n} messages already in Alter — no scraper run.`
            : 'No messages in the database yet. Import or add data before processing.'
        );
      })
      .catch(() => {
        setClaudeStatus('Could not load message counts. You can still continue to processing.');
      });
  }

  async function startImport(
    method: ImportSource,
    silent = false,
    options?: { resetProfile?: boolean }
  ) {
    setImportStrategy('scraper');
    const setImporting = method === 'claude' ? setClaudeImporting : setChatgptImporting;
    const setStatus = method === 'claude' ? setClaudeStatus : setChatgptStatus;
    const setMessages = method === 'claude' ? setClaudeMessages : setChatgptMessages;

    stopPolling(method);
    setImporting(true);
    setStatus(silent ? 'Syncing recent context in background...' : 'Starting scraper...');
    setMessages(0);
    
    try {
      const endpoint = method === 'claude' ? '/api/onboarding/import-claude' : '/api/onboarding/import-chatgpt';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: contextWindowDays,
          resetProfile: Boolean(options?.resetProfile),
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
            setStatus(imported > 0
              ? `Importing... ${imported} messages so far`
              : (message || `Background sync running (${contextWindowDays}d window)...`));
          } else if (syncState === 'completed') {
            stopPolling(method);
            setStatus(message || `✓ Imported ${imported} messages`);
            setImporting(false);
          } else if (syncState === 'auth_required') {
            stopPolling(method);
            setStatus(message || 'Sign in to this source once, then retry import.');
            setImporting(false);
          } else if (syncState === 'failed') {
            stopPolling(method);
            setStatus(data.data?.message || 'Import failed. Please retry.');
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

  /** Fresh processing step when arriving from import (clears a prior "complete" in the same session). */
  const goToProcessingStep = () => {
    setProcessing(false);
    setProcessingDone(false);
    setProcessingSummaryLine('');
    setEmbedStatus('pending');
    setProfileStatus('pending');
    setDetectStatus('pending');
    processingStartedRef.current = false;
    setStep('processing');
  };

  useEffect(() => {
    if (step !== 'processing') return;
    if (processingStartedRef.current || processingDone) return;
    processingStartedRef.current = true;
    void startProcessing();
  }, [step]);
  
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
    setProcessingDone(false);
    setEmbeddedCount(0);
    setProjectsDetected(0);
    setProcessingSummaryLine('');
    setEmbedStatus('running');
    setProfileStatus('running');
    setDetectStatus('running');

    const lookbackDays = importStrategy === 'existing' ? 365 : contextWindowDays;
    let integrationSyncHint = '';

    try {
      // ── Snapshot: skip if one already ran recently (OAuth callback or Canvas validate) ──
      const snapshotAge = Date.now() - (lastSnapshotTimeRef.current || 0);
      if (snapshotAge > 90_000) {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 25000);
        try {
          const snapRes = await fetch('/api/onboarding/integration-snapshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gmailSinceDays: 14, calendarDaysAhead: 21 }),
            signal: ac.signal,
          });
          if (snapRes.ok) {
            const snapJson = await snapRes.json();
            const d = snapJson?.data as Record<string, { ok?: boolean; skipped?: boolean; newEmails?: number; synced?: number; ingested?: number }> | undefined;
            if (d && typeof d === 'object') {
              const parts = (['gmail', 'calendar', 'canvas'] as const)
                .map((key) => {
                  const block = d[key];
                  if (!block || block.skipped) return null;
                  if (!block.ok) return null;
                  if (key === 'gmail' && typeof block.newEmails === 'number')
                    return `Gmail +${block.newEmails}`;
                  if (key === 'calendar' && typeof block.synced === 'number')
                    return `Calendar ${block.synced} events`;
                  if (key === 'canvas' && typeof block.ingested === 'number')
                    return `Canvas +${block.ingested}`;
                  return null;
                })
                .filter(Boolean) as string[];
              if (parts.length) integrationSyncHint = `Synced ${parts.join(' · ')}. `;
            }
          }
          lastSnapshotTimeRef.current = Date.now();
        } catch {
          /* non-fatal */
        } finally {
          clearTimeout(t);
        }
      } else {
        integrationSyncHint = 'Integrations synced earlier. ';
      }

      // ── Parallel: embed + profile + detect ──
      const embedQuery =
        importStrategy === 'existing'
          ? 'fullHistory=1'
          : `sinceDays=${contextWindowDays}`;

      const embedPromise = fetch(`/api/onboarding/embed?${embedQuery}`, { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          const ok = Boolean(data.success);
          setEmbedStatus(ok ? 'done' : 'failed');
          if (ok) setEmbeddedCount(data.data?.messagesEmbedded || 0);
          return { ok, data };
        })
        .catch(() => { setEmbedStatus('failed'); return { ok: false, data: null }; });

      const profilePromise = fetch('/api/onboarding/build-profile', { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          const ok = Boolean(data.success);
          setProfileStatus(ok ? 'done' : 'failed');
          setVoiceProfileStatus(
            ok
              ? 'Voice profile created — Alter will write like you.'
              : 'Could not build voice profile yet. Continuing with default style.'
          );
          return { ok, data };
        })
        .catch(() => { setProfileStatus('failed'); return { ok: false, data: null }; });

      const detectPromise = fetch(`/api/onboarding/detect-projects?sinceDays=${lookbackDays}`, { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          const ok = Boolean(data.success);
          setDetectStatus(ok ? 'done' : 'failed');
          if (ok) {
            const n = (data.data?.projectsDetected as number) ?? 0;
            setProjectsDetected(n);
          }
          return { ok, data };
        })
        .catch(() => { setDetectStatus('failed'); return { ok: false, data: null }; });

      const [embedResult, profileResult] = await Promise.all([
        embedPromise,
        profilePromise,
        detectPromise,
      ]);

      // ── Final fetch: projects list + stats (parallel) ──
      const [projectsData, statsData] = await Promise.all([
        fetch('/api/projects').then((r) => r.json()),
        fetch('/api/chat-history/stats').then((r) => r.json()),
      ]);

      const list = projectsData.success ? (projectsData.data?.projects as Project[]) ?? [] : [];
      setProjects(list);

      const finalTotal = statsData.success ? (statsData.data?.total as number) ?? 0 : 0;
      setTotalMessages(finalTotal);
      setDbMessageTotal(finalTotal);

      setProcessingSummaryLine(
        `${integrationSyncHint}Found ${finalTotal} messages, detected ${list.length} projects, ${
          profileResult.ok ? 'built voice profile.' : 'voice profile not saved yet.'
        }`
      );

      setProcessingDone(true);
      setProcessing(false);
    } catch (err) {
      console.error('Processing failed:', err);
      setProcessing(false);
    }
  }

  async function finishOnboarding() {
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        console.error('[onboarding] complete failed', data);
      }
    } catch (e) {
      console.error('[onboarding] complete', e);
    }
    router.replace('/dashboard');
  }

  function TaskRow({ label, status, detail }: { label: string; status: ParallelTaskStatus; detail?: string }) {
    return (
      <div className="flex items-center gap-3">
        {status === 'done' && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />}
        {status === 'running' && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-nightshift-accent" />}
        {status === 'pending' && <Circle className="h-5 w-5 shrink-0 text-nightshift-border" />}
        {status === 'failed' && <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />}
        <div className="flex-1">
          <span className={status === 'done' ? 'text-green-500' : status === 'failed' ? 'text-red-500' : 'text-nightshift-text-primary'}>
            {label}
          </span>
          {detail && status === 'done' && (
            <span className="ml-2 text-xs text-nightshift-text-muted">{detail}</span>
          )}
        </div>
      </div>
    );
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
            <div className="mb-6 flex justify-center">
              <AlterLogo className="h-20 w-20" />
            </div>
            <h1 className="mb-4 font-display text-3xl font-bold">Welcome to Alter</h1>
            <p className="mx-auto mb-8 max-w-md text-lg leading-relaxed text-nightshift-text-secondary">
              A digital twin of how you think and write — so Alter can act for you with your judgment, not generic
              defaults.
            </p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto w-full sm:flex-row sm:max-w-lg">
              <button type="button" className="btn-primary flex-1" onClick={() => setStep('gmail')}>
                Next →
              </button>
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={() => setStep('import')}
              >
                Skip to import
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Connect Gmail */}
        {step === 'gmail' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-3">Connect Google</h2>
            <p className="text-nightshift-text-secondary mb-6">
              One connection pulls Gmail, Calendar, and (on the processing step) Canvas together into your context — we
              sync in parallel and keep ranges short so setup stays quick.
            </p>
            
            {gmailConnected ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <div>
                  <span className="text-green-500 font-medium">Google Connected</span>
                  <p className="text-xs text-nightshift-text-muted mt-0.5">
                    Gmail + Calendar sync runs in the background; Drive stays available for saving docs.
                  </p>
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
            
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => setStep('welcome')}>
                ← Back
              </button>
              <button type="button" className="btn-ghost min-w-[120px] flex-1" onClick={() => setStep('github')}>
                Skip
              </button>
              <button type="button" className="btn-primary min-w-[120px] flex-1" onClick={() => setStep('github')}>
                Next →
              </button>
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
                      Alter will create PRs in this repository
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
            
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => setStep('gmail')}>
                ← Back
              </button>
              <button type="button" className="btn-ghost min-w-[120px] flex-1" onClick={() => setStep('canvas')}>
                Skip
              </button>
              <button
                type="button"
                className="btn-primary min-w-[120px] flex-1"
                onClick={async () => {
                  if (githubConnected && selectedRepo) {
                    await saveGitHubRepo();
                  }
                  setStep('canvas');
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Connect Canvas */}
        {step === 'canvas' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-3">Connect Canvas (Optional)</h2>
            <p className="text-nightshift-text-secondary mb-6">
              Alter can track your assignments and deadlines from Canvas LMS.
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
                    <li>Give it a name (e.g., &quot;Alter&quot;) and click &quot;Generate Token&quot;</li>
                    <li>Copy the token and paste it below</li>
                  </ol>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Canvas Domain</label>
                    <input
                      type="text"
                      value={canvasDomain}
                      onChange={(e) => setCanvasDomain(e.target.value)}
                      placeholder="yourschool.instructure.com"
                      className="w-full px-3 py-2 bg-nightshift-surface border border-nightshift-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nightshift-accent"
                    />
                    <p className="text-xs text-nightshift-text-muted mt-1">
                      Enter your school's Canvas domain (e.g., canvas.harvard.edu)
                    </p>
                  </div>
                  
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
            
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => setStep('github')}>
                ← Back
              </button>
              <button type="button" className="btn-ghost min-w-[120px] flex-1" onClick={() => setStep('import')}>
                Skip
              </button>
              <button type="button" className="btn-primary min-w-[120px] flex-1" onClick={() => setStep('import')}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Import AI Chat History */}
        {step === 'import' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-3">Import AI Chat History</h2>
            <p className="text-nightshift-text-secondary mb-6">
              Alter learns from your conversations with AI assistants. You can import from both Claude and ChatGPT.
            </p>
            <div className="mb-4 rounded-lg border border-nightshift-border p-3">
              <label className="mb-2 block text-xs uppercase tracking-wide text-nightshift-text-secondary">
                Context Window (live scraper)
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
                Used when you run the Claude or ChatGPT browser import below.
              </p>
            </div>

            <div className="mb-4 rounded-lg border border-nightshift-accent/40 bg-nightshift-accent/5 p-4">
              <h3 className="mb-1 text-sm font-semibold text-nightshift-text-primary">Demo: use existing data</h3>
              <p className="mb-3 text-xs text-nightshift-text-secondary">
                Skip the live scraper and use whatever chat messages are already in this account. Best for
                demos when the database is already loaded.
              </p>
              <button
                type="button"
                className="btn-primary w-full py-2"
                onClick={() => chooseUseExistingData()}
                disabled={claudeImporting || chatgptImporting}
              >
                Use existing data
              </button>
              {importStrategy === 'existing' && dbMessageTotal > 0 && (
                <p className="mt-2 text-center text-xs text-green-400">
                  Ready — {dbMessageTotal} message{dbMessageTotal === 1 ? '' : 's'} in the database.
                </p>
              )}
            </div>

            <div className="mb-4 space-y-3">
              {/* Claude Import */}
              <div className={`p-4 rounded-lg border transition-colors ${
                claudeMessages > 0 && !claudeImporting ? 'border-green-500/50' :
                claudeStatus.includes('auth') || claudeStatus.includes('Sign in') ? 'border-yellow-500/50' :
                claudeStatus.includes('Failed') || claudeStatus.includes('failed') ? 'border-red-500/50' :
                'border-nightshift-border'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-nightshift-border bg-nightshift-bg-light">
                    <Bot className="h-5 w-5 text-nightshift-highlight" strokeWidth={1.75} aria-hidden />
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
                        onClick={() => void startImport('claude')}
                      >
                        {claudeMessages > 0 ? 'Re-import' : 'Import'}
                      </button>
                      <button
                        className="btn-ghost px-3 py-2 text-xs"
                        onClick={() => void startImport('claude', false, { resetProfile: true })}
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-nightshift-border bg-nightshift-bg-light">
                    <MessageSquare className="h-5 w-5 text-nightshift-highlight" strokeWidth={1.75} aria-hidden />
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
                        onClick={() => void startImport('chatgpt')}
                      >
                        {chatgptMessages > 0 ? 'Re-import' : 'Import'}
                      </button>
                      <button
                        className="btn-ghost px-3 py-2 text-xs"
                        onClick={() => void startImport('chatgpt', false, { resetProfile: true })}
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
            
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => setStep('canvas')}>
                ← Back
              </button>
              <button type="button" className="btn-ghost min-w-[120px] flex-1" onClick={goToProcessingStep}>
                Skip
              </button>
              <button type="button" className="btn-primary min-w-[120px] flex-1" onClick={goToProcessingStep}>
                Next →
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-nightshift-text-muted">
              Next / Skip always continue — use &quot;Use existing data&quot; to skip the scraper for a quick demo.
            </p>
          </div>
        )}

        {/* Step 6: Processing (auto-starts, parallel tasks) */}
        {step === 'processing' && (
          <div className="card text-center">
            {processingDone ? (
              <>
                <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
                <h2 className="mb-3 text-2xl font-bold">Processing complete</h2>
                <p className="mx-auto mb-6 max-w-lg text-nightshift-text-secondary">
                  {processingSummaryLine ||
                    `Embedded ${embeddedCount} message(s) in this run. Open the next step for your project list.`}
                </p>
                <div className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row">
                  <button type="button" className="btn-ghost flex-1" onClick={() => setStep('import')}>
                    ← Back
                  </button>
                  <button type="button" className="btn-ghost flex-1" onClick={() => setStep('reveal')}>
                    Skip
                  </button>
                  <button type="button" className="btn-primary flex-1" onClick={() => setStep('reveal')}>
                    Next →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <Loader2 className="mx-auto h-16 w-16 animate-spin text-nightshift-accent" />
                </div>

                <h2 className="mb-3 text-2xl font-bold">Analyzing your data</h2>
                <p className="mb-6 text-nightshift-text-secondary">
                  Running three tasks in parallel — this takes about 10 seconds.
                </p>

                <div className="mx-auto max-w-sm space-y-3 text-left">
                  <TaskRow label="Embedding messages" status={embedStatus} detail={embeddedCount > 0 ? `${embeddedCount} embedded` : undefined} />
                  <TaskRow label="Building voice profile" status={profileStatus} detail={voiceProfileStatus || undefined} />
                  <TaskRow label="Detecting projects" status={detectStatus} detail={projectsDetected > 0 ? `${projectsDetected} found` : undefined} />
                </div>
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
                Alter detected {projects.length} active projects from your conversations
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
                  No projects detected yet. Start chatting with AI assistants and Alter will learn what you&apos;re working on!
                </p>
              </div>
            )}
            
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-ghost flex-1" onClick={() => setStep('processing')}>
                ← Back
              </button>
              <button type="button" className="btn-ghost flex-1" onClick={() => void finishOnboarding()}>
                Skip
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => void finishOnboarding()}>
                Looks right, let&apos;s go
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
