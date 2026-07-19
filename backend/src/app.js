import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import appointmentRoutes from "./routes/appointmentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import stylistRoutes from "./routes/stylistRoutes.js";

const app = express();

const frontendOrigin =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true
  })
);

app.get("/", (req, res) => {
  res.json({
    message:
      "SalonAI Backend API is running."
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/stylists", stylistRoutes);
app.use(
  "/api/appointments",
  appointmentRoutes
);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found."
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(
    error.status || 500
  ).json({
    message:
      error.message ||
      "Internal server error."
  });
});

export default app;