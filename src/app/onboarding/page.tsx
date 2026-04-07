/**
 * OWNER: Person 4 (Voice/UI) + Person 3 (Orchestration)
 * PURPOSE: Complete onboarding flow — dead simple, no terminal commands
 * DEPENDENCIES: @clerk/nextjs, Canvas API, Gmail OAuth, Claude/ChatGPT scrapers
 * STATUS: LIVE — full working onboarding with real integrations
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Upload, AlertCircle } from 'lucide-react';

type OnboardingStep = 'welcome' | 'gmail' | 'canvas' | 'import' | 'processing' | 'reveal';

interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: string;
}

interface ProcessingStatus {
  stage: 'embedding' | 'detecting' | 'complete';
  messagesFound: number;
  projectsFound: number;
  progress: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  
  // Gmail connection state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  
  // Canvas connection state
  const [canvasToken, setCanvasToken] = useState('');
  const [canvasDomain, setCanvasDomain] = useState('babson.instructure.com');
  const [canvasValidating, setCanvasValidating] = useState(false);
  const [canvasConnected, setCanvasConnected] = useState(false);
  const [canvasError, setCanvasError] = useState('');
  
  // Import state
  const [importMethod, setImportMethod] = useState<'claude' | 'chatgpt' | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  
  // Processing state
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    stage: 'embedding',
    messagesFound: 0,
    projectsFound: 0,
    progress: 0,
  });
  
  // Detected projects
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Check if user already has Gmail connected
  useEffect(() => {
    checkGmailStatus();
  }, []);
  
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
      const res = await fetch('/api/gmail/connect');
      const data = await res.json();
      if (data.success && data.data?.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.data.authUrl;
      }
    } catch (err) {
      console.error('Failed to connect Gmail:', err);
      setGmailLoading(false);
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
  
  async function startImport(method: 'claude' | 'chatgpt') {
    setImportMethod(method);
    setImporting(true);
    setImportProgress(0);
    
    try {
      if (method === 'claude') {
        // Trigger Claude scraper
        const res = await fetch('/api/onboarding/import-claude', {
          method: 'POST',
        });
        const data = await res.json();
        
        if (data.success) {
          setImportProgress(100);
          setTimeout(() => setStep('processing'), 500);
        }
      } else if (method === 'chatgpt') {
        // Trigger ChatGPT scraper
        const res = await fetch('/api/onboarding/import-chatgpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        
        if (data.success) {
          setImportProgress(100);
          setTimeout(() => setStep('processing'), 500);
        }
      }
    } catch (err) {
      console.error('Import failed:', err);
      setImporting(false);
    }
  }
  
  async function handleChatGPTUpload(file: File) {
    setImportMethod('chatgpt');
    setImporting(true);
    setImportProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/onboarding/import-chatgpt', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.success) {
        setImportProgress(100);
        setTimeout(() => setStep('processing'), 500);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setImporting(false);
    }
  }
  
  // Run processing pipeline
  useEffect(() => {
    if (step === 'processing') {
      runProcessingPipeline();
    }
  }, [step]);
  
  async function runProcessingPipeline() {
    // Stage 1: Embedding
    setProcessingStatus({ stage: 'embedding', messagesFound: 0, projectsFound: 0, progress: 0 });
    
    try {
      // Run embedding pipeline
      const embedRes = await fetch('/api/onboarding/embed', { method: 'POST' });
      const embedData = await embedRes.json();
      
      if (embedData.success) {
        setProcessingStatus(prev => ({
          ...prev,
          messagesFound: embedData.data?.messagesEmbedded || 0,
          progress: 33,
        }));
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Stage 2: Project detection
      setProcessingStatus(prev => ({ ...prev, stage: 'detecting', progress: 66 }));
      
      const detectRes = await fetch('/api/onboarding/detect-projects', { method: 'POST' });
      const detectData = await detectRes.json();
      
      if (detectData.success) {
        setProcessingStatus(prev => ({
          ...prev,
          projectsFound: detectData.data?.projectsDetected || 0,
          progress: 100,
        }));
        
        // Fetch detected projects
        const projectsRes = await fetch('/api/projects');
        const projectsData = await projectsRes.json();
        
        if (projectsData.success) {
          setProjects(projectsData.data?.projects || []);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Stage 3: Complete
      setProcessingStatus(prev => ({ ...prev, stage: 'complete' }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setStep('reveal');
    } catch (err) {
      console.error('Processing failed:', err);
    }
  }

  const steps: OnboardingStep[] = ['welcome', 'gmail', 'canvas', 'import', 'processing', 'reveal'];
  const currentStepIndex = steps.indexOf(step);
  
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-nightshift-bg">
      <div className="w-full max-w-2xl">
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
            <h2 className="text-2xl font-bold mb-3">Connect Gmail</h2>
            <p className="text-nightshift-text-secondary mb-6">
              NightShift learns your writing style from your sent emails to draft replies that sound like you.
            </p>
            
            {gmailConnected ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <span className="text-green-500 font-medium">Gmail Connected</span>
              </div>
            ) : (
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
                  'Connect Gmail'
                )}
              </button>
            )}
            
            <button
              className="btn-ghost w-full"
              onClick={() => setStep('canvas')}
            >
              Skip for Now
            </button>
            
            {gmailConnected && (
              <button
                className="btn-primary w-full mt-4"
                onClick={() => setStep('canvas')}
              >
                Continue
              </button>
            )}
          </div>
        )}

        {/* Step 3: Connect Canvas */}
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
            
            <button
              className="btn-ghost w-full"
              onClick={() => setStep('import')}
            >
              Skip for Now
            </button>
            
            {canvasConnected && (
              <button
                className="btn-primary w-full mt-4"
                onClick={() => setStep('import')}
              >
                Continue
              </button>
            )}
          </div>
        )}

        {/* Step 4: Import AI Chat History */}
        {step === 'import' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-3">Import AI Chat History</h2>
            <p className="text-nightshift-text-secondary mb-6">
              NightShift learns from your conversations with AI assistants to understand what you're working on.
            </p>
            
            {importing ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-nightshift-accent" />
                  <span className="text-nightshift-text-secondary">
                    Importing {importMethod === 'claude' ? 'Claude' : 'ChatGPT'} conversations...
                  </span>
                </div>
                <div className="w-full bg-nightshift-surface rounded-full h-2">
                  <div
                    className="bg-nightshift-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  className="w-full p-4 text-left rounded-lg border border-nightshift-border hover:border-nightshift-accent transition-colors"
                  onClick={() => startImport('claude')}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-nightshift-accent/10 flex items-center justify-center">
                      <span className="text-xl">🤖</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Connect to Claude</div>
                      <div className="text-sm text-nightshift-text-secondary">
                        Import your recent Claude conversations
                      </div>
                    </div>
                  </div>
                </button>
                
                <button
                  className="w-full p-4 text-left rounded-lg border border-nightshift-border hover:border-nightshift-accent transition-colors"
                  onClick={() => startImport('chatgpt')}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-nightshift-accent/10 flex items-center justify-center">
                      <span className="text-xl">💬</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Connect to ChatGPT</div>
                      <div className="text-sm text-nightshift-text-secondary">
                        Import your recent ChatGPT conversations
                      </div>
                    </div>
                  </div>
                </button>
                
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
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-nightshift-accent/10 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-nightshift-accent" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Or Upload Export File</div>
                        <div className="text-sm text-nightshift-text-secondary">
                          Upload ChatGPT or Claude JSON export (fallback)
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
                
                <button
                  className="btn-ghost w-full"
                  onClick={() => setStep('processing')}
                >
                  Skip for Now
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Processing */}
        {step === 'processing' && (
          <div className="card text-center">
            <div className="mb-6">
              <Loader2 className="w-16 h-16 animate-spin text-nightshift-accent mx-auto" />
            </div>
            
            <h2 className="text-2xl font-bold mb-3">
              {processingStatus.stage === 'embedding' && 'Analyzing your conversations...'}
              {processingStatus.stage === 'detecting' && 'Detecting your projects...'}
              {processingStatus.stage === 'complete' && 'Almost done...'}
            </h2>
            
            <p className="text-nightshift-text-secondary mb-6">
              {processingStatus.stage === 'embedding' && `Found ${processingStatus.messagesFound} messages`}
              {processingStatus.stage === 'detecting' && `Found ${processingStatus.projectsFound} projects`}
              {processingStatus.stage === 'complete' && 'Preparing your dashboard'}
            </p>
            
            <div className="w-full bg-nightshift-surface rounded-full h-2 mb-2">
              <div
                className="bg-nightshift-accent h-2 rounded-full transition-all duration-500"
                style={{ width: `${processingStatus.progress}%` }}
              />
            </div>
            <div className="text-sm text-nightshift-text-secondary">
              {processingStatus.progress}% complete
            </div>
          </div>
        )}

        {/* Step 6: The Reveal */}
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
