import LoyaltyAccount from "../loyalty/LoyaltyAccount.js";
import GiftCard from "../giftCards/GiftCard.js";
import Referral from "../referrals/Referral.js";
import Notification from "../notifications/Notification.js";
import EmailCampaign from "../emailCampaigns/EmailCampaign.js";
import RetentionJourney from "../automation/RetentionJourney.js";

export async function getPremiumAnalytics(req, res) {
  const [loyaltyAccounts, giftCards, referrals, notifications, campaigns, journeys] =
    await Promise.all([
      LoyaltyAccount.countDocuments(),
      GiftCard.aggregate([{ $group: { _id: null, issued: { $sum: "$originalValue" }, liability: { $sum: "$balance" }, count: { $sum: 1 } } }]),
      Referral.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Notification.aggregate([{ $group: { _id: { channel: "$channel", status: "$status" }, count: { $sum: 1 } } }]),
      EmailCampaign.find().select("name status metrics").lean(),
      RetentionJourney.countDocuments({ enabled: true }),
    ]);

  res.json({
    success: true,
    generatedAt: new Date().toISOString(),
    loyalty: { accounts: loyaltyAccounts },
    giftCards: giftCards[0] || { issued: 0, liability: 0, count: 0 },
    referrals,
    notifications,
    campaigns,
    activeJourneys: journeys,
  });
}
