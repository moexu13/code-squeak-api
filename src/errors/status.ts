export class StatusError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StatusError";
    this.status = status;
  }
}
