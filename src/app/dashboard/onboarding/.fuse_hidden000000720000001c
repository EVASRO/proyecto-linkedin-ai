import { redirect } from 'next/navigation';
import { getOnboardingState } from './actions';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default async function OnboardingPage() {
  const state = await getOnboardingState();
  if (state.completed) redirect('/dashboard');
  return (
    <OnboardingWizard
      initialStep={state.step || 1}
      initialWorkspaceName={state.workspaceName ?? ''}
    />
  );
}
