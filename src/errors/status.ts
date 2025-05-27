import { HttpErrorInterface } from "./types";

export class StatusError extends Error implements HttpErrorInterface {
  status: number;
  context?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "StatusError";
    this.status = status;
    this.context = context;
  }
}
