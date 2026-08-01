import LoyaltyAccount from "./LoyaltyAccount.js";
import { domainError } from "../premiumUtils.js";

async function account(customerId) {
  return LoyaltyAccount.findOneAndUpdate(
    { customer: customerId },
    { $setOnInsert: { customer: customerId } },
    { new: true, upsert: true }
  );
}

export async function listLoyaltyAccounts(req, res) {
  const accounts = await LoyaltyAccount.find()
    .populate("customer", "name email")
    .sort({ pointsBalance: -1 }).lean();
  res.json({ success: true, accounts });
}

export async function getMyLoyalty(req, res) {
  res.json({ success: true, account: await account(req.user._id) });
}

export async function awardPoints(req, res) {
  const target = await account(req.params.customerId);
  const points = Math.max(0, Math.floor(Number(req.body.points) || 0));
  target.pointsBalance += points;
  target.lifetimePointsEarned += points;
  target.tier = target.lifetimePointsEarned >= 3000 ? "gold" :
    target.lifetimePointsEarned >= 1000 ? "silver" : "bronze";
  target.transactions.push({
    type: "earn", points, balanceAfter: target.pointsBalance,
    sourceType: req.body.sourceType, sourceId: req.body.sourceId,
    idempotencyKey: req.body.idempotencyKey, description: req.body.description,
  });
  await target.save();
  res.status(201).json({ success: true, account: target });
}

export async function redeemPoints(req, res) {
  const target = await account(req.params.customerId);
  const points = Math.floor(Number(req.body.points) || 0);
  if (points < 100) throw domainError("Minimum redemption is 100 points.", "LOYALTY_MINIMUM", 422);
  if (target.pointsBalance < points) throw domainError("Insufficient points.", "LOYALTY_BALANCE", 409);
  target.pointsBalance -= points;
  target.lifetimePointsRedeemed += points;
  target.transactions.push({ type: "redeem", points: -points, balanceAfter: target.pointsBalance });
  await target.save();
  res.json({ success: true, account: target, value: points * 0.01 });
}
