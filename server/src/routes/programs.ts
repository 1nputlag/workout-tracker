// Тренувальні програми (FR-04): впорядкований перелік вправ із цільовими підходами й повтореннями. Доступ — лише власнику.
import { Router } from 'express';
import { h, invalidField, notFound, uid, type AuthedRequest, type Deps } from '../http.js';
import { programInput, programPatch } from '../validation/schemas.js';
import { programView } from '../services/views.js';
import type { Exercise, ProgramItemInput, Repo } from '../repo/types.js';

async function visibleMap(repo: Repo, userId: string): Promise<Map<string, Exercise>> {
  return new Map((await repo.listExercises(userId)).map((e) => [e.id, e]));
}

/** Кожна вправа програми має бути доступна користувачу; помилка вказує на конкретний елемент. */
function checkItems(items: ProgramItemInput[], visible: Map<string, Exercise>) {
  items.forEach((i, n) => {
    if (!visible.has(i.exerciseId)) throw invalidField(`items.${n}.exerciseId`, 'Невідома вправа');
  });
}

export function programRoutes({ repo }: Deps) {
  const r = Router();

  const ownProgram = async (req: AuthedRequest) => {
    const p = await repo.getProgram(String(req.params.id));
    if (!p || p.userId !== uid(req)) throw notFound();
    return p;
  };

  r.get('/', h(async (req, res) => {
    const [list, visible] = await Promise.all([repo.listPrograms(uid(req)), visibleMap(repo, uid(req))]);
    res.json(list.map((p) => programView(p, visible)));
  }));

  r.get('/:id', h(async (req, res) => {
    const p = await ownProgram(req);
    res.json(programView(p, await visibleMap(repo, uid(req))));
  }));

  r.post('/', h(async (req, res) => {
    const body = programInput.parse(req.body);
    const visible = await visibleMap(repo, uid(req));
    checkItems(body.items, visible);
    res.status(201).json(programView(await repo.createProgram(uid(req), body), visible));
  }));

  r.patch('/:id', h(async (req, res) => {
    const patch = programPatch.parse(req.body);
    const p = await ownProgram(req);
    const visible = await visibleMap(repo, uid(req));
    if (patch.items) checkItems(patch.items, visible);
    res.json(programView(await repo.updateProgram(p.id, patch), visible));
  }));

  // Тренування, створені за програмою, залишаються в історії (programId стає null)
  r.delete('/:id', h(async (req, res) => {
    const p = await ownProgram(req);
    await repo.deleteProgram(p.id);
    res.status(204).end();
  }));

  return r;
}
