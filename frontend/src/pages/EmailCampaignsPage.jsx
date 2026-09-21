import PremiumFeatureListPage from "../components/premium/PremiumFeatureListPage.jsx";

export default function EmailCampaignsPage() {
  return (
    <PremiumFeatureListPage
      title="Email Campaigns"
      endpoint="/email-campaigns"
      recordsKey="campaigns"
    />
  );
}
