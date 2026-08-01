import Referral from "./Referral.js";
import { createCode } from "../premiumUtils.js";

export async function createReferral(req, res) {
  const referral = await Referral.create({
    code: createCode("REF"), referrer: req.user._id,
    referredEmail: req.body.referredEmail,
  });
  res.status(201).json({ success: true, referral });
}

export async function getMyReferrals(req, res) {
  res.json({ success: true, referrals: await Referral.find({ referrer: req.user._id }).sort({ createdAt: -1 }).lean() });
}

export async function listReferrals(req, res) {
  const referrals = await Referral.find()
    .populate("referrer referredCustomer", "name email")
    .sort({ createdAt: -1 }).lean();
  res.json({ success: true, referrals });
}

export async function qualifyReferral(req, res) {
  const referral = await Referral.findByIdAndUpdate(
    req.params.referralId,
    {
      status: "qualified", referredCustomer: req.body.referredCustomer,
      qualifyingSourceId: req.body.sourceId, qualifiedAt: new Date(),
    },
    { new: true }
  );
  res.json({ success: true, referral, nextAction: "Award loyalty points using the loyalty endpoint." });
}
