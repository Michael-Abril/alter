/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Post-signup onboarding flow — connect Gmail, set autonomy level, import chat history
 * DEPENDENCIES: @clerk/nextjs
 * STATUS: Scaffold — needs real integration with Gmail OAuth and chat history import
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type OnboardingStep = 'welcome' | 'gmail' | 'autonomy' | 'done';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [autonomyLevel, setAutonomyLevel] = useState(1);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress Bar */}
        <div className="mb-8 flex gap-2">
          {['welcome', 'gmail', 'autonomy', 'done'].map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= ['welcome', 'gmail', 'autonomy', 'done'].indexOf(step)
                  ? 'bg-nightshift-accent'
                  : 'bg-nightshift-border'
              }`}
            />
          ))}
        </div>

        {step === 'welcome' && (
          <div className="card text-center">
            <div className="text-5xl mb-6">🌙</div>
            <h1 className="text-2xl font-bold mb-3">Welcome to NightShift</h1>
            <p className="text-nightshift-text-secondary mb-8">
              Let&apos;s get you set up so NightShift can start learning how you work.
              This takes about 2 minutes.
            </p>
            <button className="btn-primary w-full" onClick={() => setStep('gmail')}>
              Let&apos;s Go
            </button>
          </div>
        )}

        {step === 'gmail' && (
          <div className="card">
            <h2 className="text-xl font-bold mb-2">Connect Your Gmail</h2>
            <p className="text-nightshift-text-secondary mb-6">
              NightShift reads your sent emails to learn your writing style.
              We never share your data.
            </p>
            <button
              className="btn-primary w-full mb-3"
              onClick={() => {
                // TODO: Person 1 — Trigger Gmail OAuth flow
                // For now, skip to next step
                setStep('autonomy');
              }}
            >
              Connect Gmail
            </button>
            <button
              className="btn-ghost w-full"
              onClick={() => setStep('autonomy')}
            >
              Skip for Now
            </button>
          </div>
        )}

        {step === 'autonomy' && (
          <div className="card">
            <h2 className="text-xl font-bold mb-2">Set Your Comfort Level</h2>
            <p className="text-nightshift-text-secondary mb-6">
              How much autonomy do you want to give NightShift? You can change this anytime.
            </p>
            <div className="space-y-3 mb-6">
              {[
                { level: 0, name: 'Observe Only', desc: 'Watch and learn, no actions' },
                { level: 1, name: 'Draft Mode', desc: 'Create drafts, I approve everything' },
                { level: 2, name: 'Smart Auto', desc: 'Auto high-confidence, draft the rest' },
                { level: 3, name: 'Full Auto', desc: 'Handle most things, flag edge cases' },
              ].map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => setAutonomyLevel(opt.level)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    autonomyLevel === opt.level
                      ? 'border-nightshift-accent bg-nightshift-accent/10'
                      : 'border-nightshift-border hover:border-nightshift-text-muted'
                  }`}
                >
                  <span className="font-medium">{opt.name}</span>
                  <span className="ml-2 text-sm text-nightshift-text-secondary">{opt.desc}</span>
                </button>
              ))}
            </div>
            <button
              className="btn-primary w-full"
              onClick={() => {
                // TODO: Person 1 — Save autonomy level to user profile
                console.log('Setting autonomy level:', autonomyLevel);
                setStep('done');
              }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="card text-center">
            <div className="text-5xl mb-6">🚀</div>
            <h2 className="text-2xl font-bold mb-3">You&apos;re All Set!</h2>
            <p className="text-nightshift-text-secondary mb-8">
              NightShift is now learning from your data. Tonight, try handing off
              some tasks and see what happens in the morning.
            </p>
            <button
              className="btn-primary w-full"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
