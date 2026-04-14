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

export function AlterLanding() {
  return (
    <div className="min-h-screen bg-alter-bg text-alter-text antialiased">
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
    </div>
  );
}
