import { sanitizeErrorMessage } from "./utils";

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly context?: Record<string, unknown>
  ) {
    super(sanitizeErrorMessage(message));
    this.name = "HttpError";
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, context);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 404, context);
    this.name = "NotFoundError";
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 405, context);
    this.name = "MethodNotAllowedError";
  }
}

export class InternalServerError extends HttpError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 500, context);
    this.name = "InternalServerError";
  }
}
