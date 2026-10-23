import { browser } from 'wxt/browser';
import type { AppDef, ExportFile, Prefs, Template } from '../model/types';
import { createId } from '../model/id';

export type { Prefs };

const DEFAULT_PREFS: Prefs = { mode: 'all', lastTemplateId: null };

async function read<T>(key: string, fallback: T): Promise<T> {
  const stored = await browser.storage.local.get(key);
  return (stored[key] as T | undefined) ?? fallback;
}

async function write(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export function listApps(): Promise<AppDef[]> {
  return read<AppDef[]>('apps', []);
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...items, item];
  return items.map((existing, i) => (i === index ? item : existing));
}

export async function saveApp(app: AppDef): Promise<void> {
  await write('apps', upsert(await listApps(), app));
}

export async function deleteApp(id: string): Promise<void> {
  const [apps, templates] = await Promise.all([listApps(), listTemplates()]);
  await browser.storage.local.set({
    apps: apps.filter((app) => app.id !== id),
    templates: templates.filter((t) => t.appId !== id),
  });
}

export async function listTemplates(appId?: string): Promise<Template[]> {
  const templates = await read<Template[]>('templates', []);
  return appId === undefined ? templates : templates.filter((t) => t.appId === appId);
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  return (await listTemplates()).find((t) => t.id === id);
}

export async function saveTemplate(t: Template): Promise<void> {
  await write('templates', upsert(await listTemplates(), t));
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await listTemplates();
  await write('templates', templates.filter((t) => t.id !== id));
}

/** Writes an app and its complete template list in one go, so the two cannot drift apart; other apps' templates stay. */
export async function saveAppWithTemplates(app: AppDef, templates: readonly Template[]): Promise<void> {
  const [apps, all] = await Promise.all([listApps(), listTemplates()]);
  await browser.storage.local.set({
    apps: upsert(apps, app),
    templates: [...all.filter((t) => t.appId !== app.id), ...templates],
  });
}

/** Expects data already validated by `parseExport`. */
export async function importExport(
  data: ExportFile,
  onConflict: 'overwrite' | 'copy',
): Promise<{ apps: number; templates: number }> {
  let apps = await listApps();
  let templates = await listTemplates();
  const appIdMap = new Map<string, string>();

  for (const app of data.apps) {
    const conflict = apps.some((a) => a.id === app.id);
    if (conflict && onConflict === 'copy') {
      const id = createId();
      appIdMap.set(app.id, id);
      apps = [...apps, { ...app, id }];
    } else {
      apps = upsert(apps, app);
    }
  }

  for (const template of data.templates) {
    const appId = appIdMap.get(template.appId) ?? template.appId;
    const conflict = templates.some((t) => t.id === template.id);
    if (conflict && onConflict === 'copy') {
      templates = [
        ...templates,
        { ...template, appId, id: createId(), name: `${template.name} (Kopie)` },
      ];
    } else {
      templates = upsert(templates, { ...template, appId });
    }
  }

  await browser.storage.local.set({ apps, templates });
  return { apps: data.apps.length, templates: data.templates.length };
}

export async function getPrefs(): Promise<Prefs> {
  return { ...DEFAULT_PREFS, ...(await read<Partial<Prefs>>('prefs', {})) };
}

export async function setPrefs(p: Partial<Prefs>): Promise<void> {
  await write('prefs', { ...(await getPrefs()), ...p });
}
