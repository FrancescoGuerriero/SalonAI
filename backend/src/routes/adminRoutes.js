import express from "express";

import {
  protect,
  adminOnly
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get("/dashboard", (req, res) => {
  res.json({
    message: "Welcome Admin",
    user: req.user
  });
});

export default router;