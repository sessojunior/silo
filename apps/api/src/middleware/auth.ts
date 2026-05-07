import type { Request, Response, NextFunction } from "express";
import { auth, type AuthUser } from "../auth/setup";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });

    if (!session?.user) {
      res.status(401).json({ success: false, error: "Usuário não autenticado." });
      return;
    }

    req.user = session.user;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Usuário não autenticado." });
  }
}
