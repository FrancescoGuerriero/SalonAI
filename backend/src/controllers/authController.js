import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        "7d",
    }
  );
}

function serialiseUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    homeAddress: {
      line1: user.homeAddress?.line1 || "",
      line2: user.homeAddress?.line2 || "",
      city: user.homeAddress?.city || "",
      county: user.homeAddress?.county || "",
      postcode: user.homeAddress?.postcode || "",
      country: user.homeAddress?.country || "United Kingdom",
    },
  };
}

function cleanText(value, maximumLength) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

export function normaliseAccountUpdate(body = {}) {
  const address = body.homeAddress && typeof body.homeAddress === "object"
    ? body.homeAddress
    : {};

  const name = cleanText(body.name, 120);
  const phone = cleanText(body.phone, 30);
  const postcode = cleanText(address.postcode, 20).toUpperCase();

  if (!name) {
    const error = new Error("Your name is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    phone,
    homeAddress: {
      line1: cleanText(address.line1, 150),
      line2: cleanText(address.line2, 150),
      city: cleanText(address.city, 100),
      county: cleanText(address.county, 100),
      postcode,
      country: cleanText(address.country || "United Kingdom", 100),
    },
  };
}

/*
|--------------------------------------------------------------------------
| Public Registration (Customers Only)
|--------------------------------------------------------------------------
*/

export async function registerUser(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    const trimmedName = name.trim();
    const normalisedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalisedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account already exists for this email address.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: trimmedName,
      email: normalisedEmail,
      password: hashedPassword,
      role: "customer",
    });

    return res.status(201).json({
      message: "User registered successfully.",
      user: serialiseUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to register the account.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Admin User Creation
|--------------------------------------------------------------------------
*/

export async function createUserByAdmin(req, res) {
  try {
    const {
      name,
      email,
      password,
      role = "customer",
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    const allowedRoles = [
      "customer",
      "admin",
      "manager",
      "receptionist",
      "stylist",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role.",
      });
    }

    const trimmedName = name.trim();
    const normalisedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalisedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account already exists for this email address.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: trimmedName,
      email: normalisedEmail,
      password: hashedPassword,
      role,
    });

    return res.status(201).json({
      message: "User created successfully.",
      user: serialiseUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to create the account.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

export async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const normalisedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalisedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET is not configured.",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: serialiseUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to sign in.",
    });
  }
}

export async function getCurrentAccount(req, res) {
  return res.status(200).json({
    success: true,
    user: serialiseUser(req.user),
  });
}

export async function updateCurrentAccount(req, res, next) {
  try {
    const update = normaliseAccountUpdate(req.body);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Account details updated successfully.",
      user: serialiseUser(user),
    });
  } catch (error) {
    return next(error);
  }
}
