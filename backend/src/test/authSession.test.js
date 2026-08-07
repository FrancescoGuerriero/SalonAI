import assert from "node:assert/strict";
import test from "node:test";

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import {
  REFRESH_COOKIE_NAME,
  createAccessToken,
  createRefreshToken,
  getRefreshCookieOptions,
  readCookie,
} from "../controllers/authController.js";

const testUser = {
  _id:
    "507f1f77bcf86cd799439011",
  role:
    "customer",
};

test(
  "access and refresh tokens use separate signing secrets",
  () => {
    const accessToken =
      createAccessToken(
        testUser
      );
    const refreshToken =
      createRefreshToken(
        testUser
      );

    const accessPayload =
      jwt.verify(
        accessToken,
        env.jwtSecret
      );
    const refreshPayload =
      jwt.verify(
        refreshToken,
        env.jwtRefreshSecret
      );

    assert.equal(
      accessPayload.id,
      testUser._id
    );
    assert.equal(
      accessPayload.role,
      "customer"
    );
    assert.equal(
      accessPayload.tokenType,
      "access"
    );

    assert.equal(
      refreshPayload.id,
      testUser._id
    );
    assert.equal(
      refreshPayload.tokenType,
      "refresh"
    );

    assert.throws(
      () =>
        jwt.verify(
          refreshToken,
          env.jwtSecret
        )
    );
  }
);

test(
  "refresh cookie is HttpOnly and scoped to authentication routes",
  () => {
    const options =
      getRefreshCookieOptions();

    assert.equal(
      options.httpOnly,
      true
    );
    assert.equal(
      options.sameSite,
      "lax"
    );
    assert.equal(
      options.path,
      "/api/auth"
    );
    assert.equal(
      options.secure,
      env.isProduction
    );
    assert.ok(
      options.maxAge >
        0
    );
  }
);

test(
  "refresh cookie can be read from a request cookie header",
  () => {
    const request = {
      headers: {
        cookie:
          `theme=dark; ${REFRESH_COOKIE_NAME}=header.payload.signature; locale=en-GB`,
      },
    };

    assert.equal(
      readCookie(
        request,
        REFRESH_COOKIE_NAME
      ),
      "header.payload.signature"
    );
  }
);

test(
  "missing refresh cookie returns an empty value",
  () => {
    assert.equal(
      readCookie(
        {
          headers: {},
        },
        REFRESH_COOKIE_NAME
      ),
      ""
    );
  }
);
