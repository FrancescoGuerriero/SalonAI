import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";

const app = express();

// Security middleware
app.use(helmet());

// Logging
app.use(morgan("dev"));

// Parse JSON requests
app.use(express.json());

// Parse cookies
app.use(cookieParser());

// Enable CORS for React frontend
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);


// Health check route
app.get("/", (req, res) => {
  res.json({
    message: "SalonAI Backend API is running 🚀",
  });
});


// API Routes
app.use("/api/auth", authRoutes);

app.use("/api/services", serviceRoutes);


// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});


// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    message: "Internal Server Error",
  });
});


export default app;