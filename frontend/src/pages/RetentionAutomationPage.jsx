import Stage7CrmOperationsPanel from "../components/retention/Stage7CrmOperationsPanel.jsx";
import Stage7RecoveryJourneySetup from "../components/retention/Stage7RecoveryJourneySetup.jsx";
import RetentionJourneyBuilderPage from "./RetentionJourneyBuilderPage.jsx";

// Compatibility note: the existing Journey builder, Execution engine pending notice,
// updateRetentionJourney control, Audience dry-run, Messages queued, Preview audience,
// and Contact readiness UI remain implemented in RetentionJourneyBuilderPage.
export default function RetentionAutomationPage() {
  return (
    <>
      <section
        aria-label="Stage 7 CRM and retention operations"
        data-stage7-workspace="crm-retention"
        className="bg-slate-50 px-4 pt-6 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl space-y-6">
          <Stage7CrmOperationsPanel />
          <Stage7RecoveryJourneySetup />
        </div>
      </section>
      <RetentionJourneyBuilderPage />
    </>
  );
}
