// Сервіс автентифікації (діаграма послідовності 4.9) і профіль користувача (FR-02).
import { Router, type NextFunction, type Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { h, uid, type AuthedRequest, type Deps } from '../http.js';
import { loginInput, profilePatch, registerInput } from '../validation/schemas.js';
import { userView } from '../services/views.js';

export type AuthOptions = Deps & { jwtSecret: string; bcryptCost: number };

/** Проміжний шар перевірки токена: Authorization: Bearer <JWT>. Сесії на сервері не зберігаються (NFR-05). */
export function authMiddleware(jwtSecret: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    try {
      const p = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
      req.userId = String(p.sub);
      next();
    } catch { res.status(401).json({ error: 'unauthorized' }); }
  };
}

export function authRoutes({ repo, jwtSecret, bcryptCost }: AuthOptions) {
  const r = Router();
  const sign = (userId: string) => jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '7d' });

  r.post('/register', h(async (req, res) => {
    const body = registerInput.parse(req.body);
    if (await repo.findUserByEmail(body.email)) return res.status(409).json({ error: 'email_taken' });
    const user = await repo.createUser({
      email: body.email,
      displayName: body.displayName ?? body.email.split('@')[0],
      passwordHash: await bcrypt.hash(body.password, bcryptCost),
    });
    res.status(201).json({ token: sign(user.id), user: userView(user) });
  }));

  r.post('/login', h(async (req, res) => {
    const body = loginInput.parse(req.body);
    const user = await repo.findUserByEmail(body.email);
    // Однакова відповідь для невідомої пошти й неправильного пароля — не розкриваємо, чи зареєстровано пошту
    const ok = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
    if (!user || !ok) return res.status(401).json({ error: 'invalid_credentials' });
    res.json({ token: sign(user.id), user: userView(user) });
  }));

  return r;
}

export function profileRoutes({ repo }: Deps) {
  const r = Router();

  // Токен дійсний, але користувача вже немає (наприклад, видалено) — відповідаємо як на недійсний токен
  r.get('/', h(async (req, res) => {
    const u = await repo.findUserById(uid(req));
    if (!u) return res.status(401).json({ error: 'unauthorized' });
    res.json(userView(u));
  }));

  r.patch('/', h(async (req, res) => {
    const patch = profilePatch.parse(req.body);
    if (!(await repo.findUserById(uid(req)))) return res.status(401).json({ error: 'unauthorized' });
    res.json(userView(await repo.updateUser(uid(req), patch)));
  }));

  return r;
}
