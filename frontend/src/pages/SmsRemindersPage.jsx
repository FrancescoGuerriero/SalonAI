import PremiumFeatureListPage from "../components/premium/PremiumFeatureListPage.jsx";

export default function SmsRemindersPage() {
  return (
    <PremiumFeatureListPage
      title="SMS Reminders"
      endpoint="/sms/rules"
      recordsKey="rules"
    />
  );
}
