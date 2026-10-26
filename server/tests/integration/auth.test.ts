import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { SECRET, registerUser, setup } from './helpers';

describe('API автентифікації (діаграма послідовності 4.9)', () => {
  it('TC-API-01: реєстрація повертає 201, токен і не повертає хеш пароля', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/auth/register').send({ email: 'a@example.com', password: 'correct-horse-1' });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|correct-horse/);
  });

  it('TC-API-02: повторна реєстрація тієї самої пошти (навіть в іншому регістрі) дає 409', async () => {
    const { app } = setup();
    await registerUser(app, 'dup@example.com');
    const res = await request(app).post('/api/auth/register').send({ email: 'DUP@example.com', password: 'correct-horse-1' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it('TC-API-03: коректний вхід повертає токен, у якому закодовано ідентифікатор користувача', async () => {
    const { app } = setup();
    const u = await registerUser(app, 'login@example.com');
    const res = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'correct-horse-1' });
    expect(res.status).toBe(200);
    expect(jwt.verify(res.body.token, SECRET)).toMatchObject({ sub: u.id });
  });

  it('TC-API-04: для невідомої пошти й неправильного пароля повертається однакова відповідь 401', async () => {
    const { app } = setup();
    await registerUser(app, 'known@example.com');
    const wrongPw = await request(app).post('/api/auth/login').send({ email: 'known@example.com', password: 'wrong-password' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password' });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrongPw.body);
  });

  it('TC-API-05: захищений маршрут без токена, з пошкодженим токеном і з токеном іншого ключа дає 401', async () => {
    const { app } = setup();
    expect((await request(app).post('/api/workouts')).status).toBe(401);
    expect((await request(app).post('/api/workouts').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
    const forged = jwt.sign({ sub: 'x' }, 'another-secret');
    expect((await request(app).post('/api/workouts').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  it('TC-API-06: у сховищі пароль зберігається як bcrypt-хеш, а не відкритим текстом', async () => {
    const { app, repo } = setup();
    await registerUser(app, 'hash@example.com');
    const u = await repo.findUserByEmail('hash@example.com');
    expect(u?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(u?.passwordHash).not.toContain('correct-horse-1');
  });

  it('TC-API-07: некоректне тіло реєстрації дає 400 з переліком полів', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'password']);
  });

  it('TC-API-20: службовий маршрут /api/health відповідає без автентифікації', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
