import type { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      res.status(400).json({
        success: false,
        error: first?.message ?? "Dados inválidos.",
        field: (first?.path ?? []).join("."),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
