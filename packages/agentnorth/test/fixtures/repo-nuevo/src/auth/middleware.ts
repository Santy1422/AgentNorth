import { NextRequest } from "next/server";
import { verifyJwt } from "./jwt";

export function authMiddleware(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("No token");
  return verifyJwt(token);
}
