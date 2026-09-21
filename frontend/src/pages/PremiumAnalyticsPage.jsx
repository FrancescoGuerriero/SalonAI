import PremiumFeatureListPage from "../components/premium/PremiumFeatureListPage.jsx";

export default function PremiumAnalyticsPage() {
  return (
    <PremiumFeatureListPage
      title="Premium Analytics"
      endpoint="/premium-analytics"
      recordsKey="campaigns"
    />
  );
}
