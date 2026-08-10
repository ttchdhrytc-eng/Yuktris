// ============================================================
// ResearchPlanner — Plans research requests before execution
// ============================================================

import { providerRouter } from './ProviderRouter';
import { researchValidator } from './ResearchValidator';
import type {
  ResearchPlan,
  ResearchRequestType,
  ResearchContext,
  ResearchCapability,
  ResearchProviderId,
} from '@/types/research-intelligence';

class ResearchPlanner {
  plan(params: {
    companyName: string;
    website: string | null;
    requestType: ResearchRequestType;
  }): ResearchPlan {
    const { companyName, website, requestType } = params;

    const websiteCheck = researchValidator.validateWebsite(website);
    const sanitizedWebsite = websiteCheck.valid ? websiteCheck.sanitized : null;

    const capabilities = providerRouter.getCapabilitiesForRequestType(requestType);
    const providers = providerRouter.selectProviders(capabilities);

    const providerIds = providers.map((p) => p.id) as ResearchProviderId[];

    const context: ResearchContext = {
      companyName,
      website: sanitizedWebsite,
      requestType,
      capabilities,
    };

    return {
      requestId: crypto.randomUUID(),
      companyName,
      website: sanitizedWebsite,
      requestType,
      providers: providerIds,
      capabilities,
      parallel: true,
      maxRetries: 2,
    };
  }

  getContext(plan: ResearchPlan): ResearchContext {
    return {
      companyName: plan.companyName,
      website: plan.website,
      requestType: plan.requestType,
      capabilities: plan.capabilities as ResearchCapability[],
    };
  }
}

export const researchPlanner = new ResearchPlanner();
