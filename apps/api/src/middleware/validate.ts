import type { NextFunction, Request, RequestHandler, Response } from "express";
import { type ZodTypeAny } from "zod";

type ValidateSource = "body" | "query" | "params";

const toFieldName = (path: readonly PropertyKey[]): string | undefined => {
  const field = path.map((segment) => String(segment)).join(".");
  return field.length > 0 ? field : undefined;
};

const assignValidatedValue = (
  req: Request,
  source: ValidateSource,
  value: unknown,
): void => {
  if (source === "body") {
    req.body = value;
    return;
  }

  Object.defineProperty(req, source, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

export function validate(schema: ZodTypeAny, source: ValidateSource = "body"): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const input = req[source];
    const result = schema.safeParse(input);
    if (!result.success) {
      const first = result.error.issues[0];
      res.status(400).json({
        success: false,
        error: first?.message ?? "Dados inválidos.",
        field: first ? toFieldName(first.path) : undefined,
      });
      return;
    }

    assignValidatedValue(req, source, result.data);
    next();
  };
}
