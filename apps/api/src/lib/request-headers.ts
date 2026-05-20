import type { IncomingHttpHeaders } from "http";

export const toHeaders = (headers: IncomingHttpHeaders): Headers => {
  const nextHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      nextHeaders.set(name, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          nextHeaders.append(name, item);
        }
      }
    }
  }

  return nextHeaders;
};