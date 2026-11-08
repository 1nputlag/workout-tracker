// Спільні засоби HTTP-шару: тип автентифікованого запиту, помилка з кодом відповіді, обгортка асинхронних обробників.
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Repo } from './repo/types.js';

export type AuthedRequest = Request & { userId?: string };
export type Deps = { repo: Repo };

/** Помилка, яку єдиний обробник перетворює на відповідь { error, details? } з указаним статусом. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, public details?: { path: string; message: string }[]) {
    super(code);
  }
}

export const notFound = () => new HttpError(404, 'not_found');
export const invalidField = (path: string, message: string) => new HttpError(400, 'validation_error', [{ path, message }]);

/** Express 4 не перехоплює відхилені проміси — передаємо помилку в next() самі. */
export const h = (fn: (req: AuthedRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => { fn(req as AuthedRequest, res).catch(next); };

/** Ідентифікатор поточного користувача (маршрут захищений проміжним шаром auth). */
export const uid = (req: AuthedRequest): string => req.userId!;
