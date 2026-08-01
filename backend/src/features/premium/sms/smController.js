import SmsRule from "./SmsRule.js";

export async function listSmsRules(req, res) {
  res.json({ success: true, rules: await SmsRule.find().sort({ createdAt: -1 }).lean() });
}

export async function createSmsRule(req, res) {
  res.status(201).json({ success: true, rule: await SmsRule.create(req.body) });
}
