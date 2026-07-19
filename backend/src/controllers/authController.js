import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import User from "../models/user.js";

function createToken(userId) {
  return jwt.sign(
    {
      id: userId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function serialiseUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email
  };
}

export async function registerUser(
  req,
  res,
  next
) {
  try {
    const {
      name,
      email,
      password
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Name, email and password are required."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must contain at least six characters."
      });
    }

    const normalisedEmail =
      email.trim().toLowerCase();

    const existingUser =
      await User.findOne({
        email: normalisedEmail
      });

    if (existingUser) {
      return res.status(409).json({
        message:
          "An account already exists for this email address."
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalisedEmail,
      password: hashedPassword
    });

    return res.status(201).json({
      message:
        "User registered successfully.",
      user: serialiseUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function loginUser(
  req,
  res,
  next
) {
  try {
    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required."
      });
    }

    const normalisedEmail =
      email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalisedEmail
    });

    if (!user) {
      return res.status(401).json({
        message:
          "Invalid email or password."
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatches) {
      return res.status(401).json({
        message:
          "Invalid email or password."
      });
    }

    const token = createToken(user._id);

    return res.json({
      message: "Login successful.",
      token,
      user: serialiseUser(user)
    });
  } catch (error) {
    next(error);
  }
}