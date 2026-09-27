import type { RequestHandler } from "express";
import {
  ACCESS_JWT_SECRET,
  REFRESH_TOKEN_TTL,
  SALT_ROUNDS,
  ACCESS_TOKEN_TTL,
} from "#config";
import { RefreshToken, User } from "#models";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import "#db";

type TokenResult = {
  accessToken: string;
  refreshToken: string;
  cookieOptions: {
    httpOnly: boolean;
    sameSite: "none" | "lax";
    secure: boolean;
    maxAge: number;
  };
};

function createCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    secure: isProduction,
    maxAge: REFRESH_TOKEN_TTL * 1000,
  };
}

async function createTokens(
  _id: string,
  roles: string[],
): Promise<TokenResult> {
  // the return type in this case is not needed since TS can infer all the returned types
  // but I did it here to know how it would look like
  // async function createTokens(_id:string, roles:string[]) {

  const payload = { roles: roles };
  const secret = ACCESS_JWT_SECRET;
  const tokenOptions = {
    expiresIn: ACCESS_TOKEN_TTL,
    subject: _id.toString(),
  };

  const accessToken = jwt.sign(payload, secret, tokenOptions);

  const refreshToken = randomUUID();

  await RefreshToken.create({
    token: refreshToken,
    userId: _id,
  });

  const cookieOptions = createCookieOptions();

  return { accessToken, refreshToken, cookieOptions };
}

export const register: RequestHandler = async (req, res) => {
  const {
    body: { email, password},
  } = req;

  const user = await User.findOne({ email: email });
  if (user) {
    throw new Error("User allready exists.", { cause: { status: 409 } });
  }

  const hashedPW = await bcrypt.hash(password, SALT_ROUNDS);

  const newUser = await User.create({
    email: email,
    password: hashedPW,
  });

  const { accessToken, refreshToken, cookieOptions } = await createTokens(
    newUser._id.toString(),
    newUser.roles,
  );

  res
    .status(201)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json({ accessToken });
};

export const login: RequestHandler = async (req, res) => {
  const {
    body: { email, password },
  } = req;

  const user = await User.findOne({ email: email }).select("+password");
  if (!user) {
    throw new Error("Invalid credentials", { cause: { status: 401 } });
  }
  // Compare the hashed password to the password the user provided
  // Throw an error if the passwords don't match
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new Error("Invalid credentials", { cause: { status: 401 } });
  }

  await RefreshToken.deleteMany({ userId: user._id });

  const { accessToken, refreshToken, cookieOptions } = await createTokens(
    user._id.toString(),
    user.roles,
  );

  res
    .status(200)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json({ accessToken });
};

export const refresh: RequestHandler = async (req, res) => {
  const { refreshToken: oldRefreshToken } = req.cookies;
  if (!oldRefreshToken) {
    throw new Error("Refresh Token Not Found", { cause: { status: 401 } });
  }

  const foundRefreshToken = await RefreshToken.findOne({
    token: oldRefreshToken,
  });
  if (!foundRefreshToken) {
    throw new Error("Refresh Token Not Found", { cause: { status: 401 } });
  }

  await RefreshToken.deleteMany({ userId: foundRefreshToken.userId });

  const user = await User.findById(foundRefreshToken.userId);
  if (!user) {
    throw new Error("User Not Found", { cause: { status: 401 } });
  }

  const { accessToken, refreshToken, cookieOptions } = await createTokens(
    user._id.toString(),
    user.roles,
  );

  res
    .status(200)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json({ accessToken });
};

export const logout: RequestHandler = async (req, res) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }

  res.clearCookie("refreshToken", createCookieOptions());
  res.status(200).json({ message: "Successfully logged out" });
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.header("authorization");

    const accessToken =
      authHeader?.startsWith("Bearer ") && authHeader.split(" ")[1];
    console.log("AccessToken", accessToken);

    if (!accessToken)
      throw new Error("Access token is required.", { cause: { status: 401 } });

    const decoded = jwt.verify(
      accessToken,
      ACCESS_JWT_SECRET,
    ) as jwt.JwtPayload;
    if (!decoded.sub)
      throw new Error("Invalid or expired access token.", {
        cause: { status: 403 },
      });

    const user = await User.findById(decoded.sub).lean();

    if (!user) throw new Error("User not found", { cause: { status: 404 } });

    // send generic success message and user info in response body
    res.status(200).json({ message: "Valid token", user });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(
        new Error("Expired access token", {
          cause: { status: 401, code: "ACCESS_TOKEN_EXPIRED" },
        }),
      );
    } else if (
      error instanceof Error &&
      error.cause &&
      typeof error.cause === "object" &&
      "status" in error.cause
    ) {
      next(error); // re-throw as-is, preserving whatever status/cause it already carried
    } else {
      next(new Error("Invalid access token.", { cause: { status: 401 } }));
    }
  }
};
