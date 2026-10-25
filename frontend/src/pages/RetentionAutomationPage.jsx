import Stage7CrmOperationsPanel from "../components/retention/Stage7CrmOperationsPanel.jsx";
import Stage7RecoveryJourneySetup from "../components/retention/Stage7RecoveryJourneySetup.jsx";
import RetentionJourneyBuilderPage from "./RetentionJourneyBuilderPage.jsx";

export default function RetentionAutomationPage() {
  return (
    <>
      <div className="bg-slate-50 px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Stage7CrmOperationsPanel />
          <Stage7RecoveryJourneySetup />
        </div>
      </div>
      <RetentionJourneyBuilderPage />
    </>
  );
}
