const jwt = require("jsonwebtoken");

const User = require("../models/user");
const asyncHandler = require("./asyncHandler");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  const authorizationHeader = req.headers.authorization;

  if (
    authorizationHeader &&
    authorizationHeader.startsWith("Bearer ")
  ) {
    token = authorizationHeader.split(" ")[1];
  }

  if (!token) {
    res.status(401);

    throw new Error(
      "Authentication required. No access token was provided."
    );
  }

  if (!process.env.JWT_SECRET) {
    res.status(500);

    throw new Error(
      "JWT_SECRET is not configured on the server."
    );
  }

  let decodedToken;

  try {
    decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
  } catch (error) {
    res.status(401);

    if (error.name === "TokenExpiredError") {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    throw new Error(
      "The access token is invalid."
    );
  }

  const userId =
    decodedToken.id ??
    decodedToken.userId ??
    decodedToken._id;

  if (!userId) {
    res.status(401);

    throw new Error(
      "The access token does not contain a valid user identifier."
    );
  }

  const user = await User.findById(userId).select(
    "-password"
  );

  if (!user) {
    res.status(401);

    throw new Error(
      "The account associated with this token no longer exists."
    );
  }

  if (user.isActive === false) {
    res.status(403);

    throw new Error(
      "This account has been disabled."
    );
  }

  req.user = user;

  next();
});

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);

      throw new Error(
        "Authentication is required before authorisation can be checked."
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403);

      throw new Error(
        "You do not have permission to perform this action."
      );
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
};