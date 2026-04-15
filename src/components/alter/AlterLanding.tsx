'use client';

import dynamic from 'next/dynamic';
import { AlterDifferentiation } from './AlterDifferentiation';
import { AlterFooter } from './AlterFooter';
import { AlterHero } from './AlterHero';
import { AlterSiteHeader } from './AlterSiteHeader';
import { AlterHowItWorks } from './AlterHowItWorks';
import { AlterPricingCTA } from './AlterPricingCTA';
import { AlterPrivacy } from './AlterPrivacy';
import { AlterTrustStrip } from './AlterTrustStrip';
import { AlterWhatAlterIs } from './AlterWhatAlterIs';
import { AlterWhoFor } from './AlterWhoFor';
import { AlterWhyNow } from './AlterWhyNow';

const SceneCanvas = dynamic(() => import('./SceneCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-alter-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-alter-primary border-t-transparent" />
    </div>
  ),
});

export function AlterLanding() {
  return (
    <SceneCanvas>
      <AlterSiteHeader />
      <AlterHero />
      <AlterTrustStrip />
      <AlterWhatAlterIs />
      <AlterHowItWorks />
      <AlterWhyNow />
      <AlterPrivacy />
      <AlterWhoFor />
      <AlterDifferentiation />
      <AlterPricingCTA />
      <AlterFooter />
    </SceneCanvas>
  );
}
