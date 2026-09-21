import PremiumFeatureListPage from "../components/premium/PremiumFeatureListPage.jsx";

export default function LoyaltyProgrammePage() {
  return (
    <PremiumFeatureListPage
      title="Loyalty Programme"
      endpoint="/loyalty"
      recordsKey="accounts"
    />
  );
}
