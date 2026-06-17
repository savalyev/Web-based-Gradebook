export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Не авторизован') => new HttpError(401, msg);
export const forbidden = (msg = 'Доступ запрещён') => new HttpError(403, msg);
export const notFound = (msg = 'Не найдено') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
