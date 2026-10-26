import Stage7CrmOperationsPanel from "../components/retention/Stage7CrmOperationsPanel.jsx";
import Stage7RecoveryJourneySetup from "../components/retention/Stage7RecoveryJourneySetup.jsx";
import Stage9CrmRetentionPanel from "../components/retention/Stage9CrmRetentionPanel.jsx";
import RetentionJourneyBuilderPage from "./RetentionJourneyBuilderPage.jsx";

// Compatibility note: the existing Journey builder, Execution engine pending notice,
// updateRetentionJourney control, Audience dry-run, Messages queued, Preview audience,
// and Contact readiness UI remain implemented in RetentionJourneyBuilderPage.
export default function RetentionAutomationPage() {
  return (
    <>
      <section
        aria-label="CRM and retention operations"
        data-stage7-workspace="crm-retention"
        data-point9-workspace="original-phase-11"
        className="bg-slate-50 px-4 pt-6 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl space-y-6">
          <Stage9CrmRetentionPanel />
          <Stage7CrmOperationsPanel />
          <Stage7RecoveryJourneySetup />
        </div>
      </section>
      <RetentionJourneyBuilderPage />
    </>
  );
}
