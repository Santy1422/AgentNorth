import jwt from "jsonwebtoken";

export interface TokenPayload {
  userId: string;
  tenantId: string;
}

export function verifyJwt(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
}

export function signJwt(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });
}
