import PremiumFeatureListPage from "../components/premium/PremiumFeatureListPage.jsx";

export default function PushNotificationsPage() {
  return (
    <PremiumFeatureListPage
      title="Push Notifications"
      endpoint="/push/subscriptions"
      recordsKey="subscriptions"
    />
  );
}
