import GiftCard from "./GiftCard.js";
import { createCode, domainError, hashValue } from "../premiumUtils.js";

export async function listGiftCards(req, res) {
  res.json({ success: true, giftCards: await GiftCard.find().sort({ createdAt: -1 }).lean() });
}

export async function issueGiftCard(req, res) {
  const value = Math.round((Number(req.body.value) || 0) * 100) / 100;
  if (value <= 0) throw domainError("Gift-card value must be positive.", "GIFT_CARD_VALUE", 422);
  const code = createCode("SALON");
  const giftCard = await GiftCard.create({
    codeHash: hashValue(code), codeLastFour: code.slice(-4),
    originalValue: value, balance: value,
    recipientName: req.body.recipientName,
    recipientEmail: req.body.recipientEmail,
    expiresAt: req.body.expiresAt,
    transactions: [{ type: "issue", amount: value, balanceAfter: value }],
  });
  res.status(201).json({ success: true, giftCard, code });
}

export async function redeemGiftCard(req, res) {
  const giftCard = await GiftCard.findOne({ codeHash: hashValue(req.body.code) });
  if (!giftCard) throw domainError("Gift card not found.", "GIFT_CARD_NOT_FOUND", 404);
  const amount = Number(req.body.amount) || 0;
  if (giftCard.status !== "active" || amount <= 0 || amount > giftCard.balance)
    throw domainError("Gift card cannot cover this redemption.", "GIFT_CARD_REDEMPTION", 409);
  giftCard.balance = Math.round((giftCard.balance - amount) * 100) / 100;
  if (giftCard.balance === 0) giftCard.status = "redeemed";
  giftCard.transactions.push({ type: "redeem", amount: -amount, balanceAfter: giftCard.balance });
  await giftCard.save();
  res.json({ success: true, giftCard });
}
