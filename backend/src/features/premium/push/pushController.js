import PushSubscription from "./PushSubscription.js";

export async function saveSubscription(req, res) {
  const subscription = await PushSubscription.findOneAndUpdate(
    { endpoint: req.body.endpoint },
    { ...req.body, customer: req.user._id, active: true, lastUsedAt: new Date() },
    { new: true, upsert: true, runValidators: true }
  );
  res.status(201).json({ success: true, subscription });
}

export async function disableSubscription(req, res) {
  await PushSubscription.findOneAndUpdate(
    { endpoint: req.body.endpoint, customer: req.user._id },
    { active: false }
  );
  res.json({ success: true });
}


export async function listSubscriptions(req, res) {
  const subscriptions =
    await PushSubscription.find({
      active: {
        $ne: false,
      },
    })
      .sort({
        updatedAt: -1,
      })
      .lean();

  return res.json({
    success: true,
    subscriptions,
  });
}
