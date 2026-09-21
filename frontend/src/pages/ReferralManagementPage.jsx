import PremiumFeatureListPage from "../components/premium/PremiumFeatureListPage.jsx";

export default function ReferralManagementPage() {
  return (
    <PremiumFeatureListPage
      title="Referral System"
      endpoint="/referrals"
      recordsKey="referrals"
    />
  );
}
