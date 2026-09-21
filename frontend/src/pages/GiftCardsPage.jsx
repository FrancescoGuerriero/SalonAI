import PremiumFeatureListPage from "../components/premium/PremiumFeatureListPage.jsx";

export default function GiftCardsPage() {
  return (
    <PremiumFeatureListPage
      title="Gift Cards"
      endpoint="/gift-cards"
      recordsKey="giftCards"
    />
  );
}
