import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { AppDef, ExportFile, Template } from '../../src/model/types';
import {
  deleteApp,
  deleteTemplate,
  getPrefs,
  getTemplate,
  importExport,
  listApps,
  listTemplates,
  saveApp,
  saveTemplate,
  setPrefs,
} from '../../src/storage/repository';

const makeApp = (id: string): AppDef => ({ id, name: `App ${id}`, urlPatterns: ['*'] });
const makeTemplate = (id: string, appId: string): Template => ({
  id,
  appId,
  name: `Vorlage ${id}`,
  process: null,
  fields: [],
  lastMissing: [],
});

beforeEach(() => {
  fakeBrowser.reset();
});

describe('repository', () => {
  it('saves apps and replaces by id', async () => {
    await saveApp(makeApp('app1'));
    await saveApp({ ...makeApp('app1'), name: 'Neu' });
    expect(await listApps()).toEqual([{ ...makeApp('app1'), name: 'Neu' }]);
  });

  it('filters templates by app', async () => {
    await saveTemplate(makeTemplate('t1', 'app1'));
    await saveTemplate(makeTemplate('t2', 'app2'));
    expect((await listTemplates('app1')).map((t) => t.id)).toEqual(['t1']);
    expect(await listTemplates()).toHaveLength(2);
    expect((await getTemplate('t2'))?.appId).toBe('app2');
    expect(await getTemplate('nope')).toBeUndefined();
  });

  it('deletes a single template', async () => {
    await saveTemplate(makeTemplate('t1', 'app1'));
    await deleteTemplate('t1');
    expect(await listTemplates()).toEqual([]);
  });

  it('deleteApp removes the templates of that app only', async () => {
    await saveApp(makeApp('app1'));
    await saveApp(makeApp('app2'));
    await saveTemplate(makeTemplate('t1', 'app1'));
    await saveTemplate(makeTemplate('t2', 'app2'));
    await deleteApp('app1');
    expect((await listApps()).map((a) => a.id)).toEqual(['app2']);
    expect((await listTemplates()).map((t) => t.id)).toEqual(['t2']);
  });

  it('replaces conflicting items on import with overwrite', async () => {
    await saveApp(makeApp('app1'));
    await saveTemplate(makeTemplate('t1', 'app1'));
    const data: ExportFile = {
      format: 'form-filler',
      version: 1,
      apps: [{ ...makeApp('app1'), name: 'Importiert' }],
      templates: [{ ...makeTemplate('t1', 'app1'), name: 'Importiert' }],
    };
    expect(await importExport(data, 'overwrite')).toEqual({ apps: 1, templates: 1 });
    expect((await listApps())[0]?.name).toBe('Importiert');
    expect(await listTemplates()).toHaveLength(1);
    expect((await listTemplates())[0]?.name).toBe('Importiert');
  });

  it('copy creates new ids, relinks templates and suffixes the name', async () => {
    await saveApp(makeApp('app1'));
    await saveTemplate(makeTemplate('t1', 'app1'));
    const data: ExportFile = {
      format: 'form-filler',
      version: 1,
      apps: [makeApp('app1')],
      templates: [makeTemplate('t1', 'app1')],
    };
    expect(await importExport(data, 'copy')).toEqual({ apps: 1, templates: 1 });
    const templates = await listTemplates();
    expect(templates).toHaveLength(2);
    const copy = templates.find((t) => t.id !== 't1');
    expect(copy?.name).toBe('Vorlage t1 (Kopie)');
    const apps = await listApps();
    expect(apps).toHaveLength(2);
    const appCopy = apps.find((a) => a.id !== 'app1');
    expect(copy?.appId).toBe(appCopy?.id);
    expect(templates.find((t) => t.id === 't1')?.name).toBe('Vorlage t1');
  });

  it('copy imports non-conflicting items unchanged', async () => {
    const data: ExportFile = {
      format: 'form-filler',
      version: 1,
      apps: [makeApp('a9')],
      templates: [makeTemplate('t9', 'a9')],
    };
    await importExport(data, 'copy');
    expect((await getTemplate('t9'))?.name).toBe('Vorlage t9');
  });

  it('writes apps and templates in a single storage call on import', async () => {
    await saveApp(makeApp('app1'));
    const data: ExportFile = {
      format: 'form-filler',
      version: 1,
      apps: [makeApp('app2')],
      templates: [makeTemplate('t2', 'app2')],
    };
    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await importExport(data, 'overwrite');
    expect(setSpy).toHaveBeenCalledTimes(1);
    const written = setSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(written).sort()).toEqual(['apps', 'templates']);
    setSpy.mockRestore();
  });

  it('returns default prefs and merges partial updates', async () => {
    expect(await getPrefs()).toEqual({ mode: 'all', lastTemplateId: null });
    await setPrefs({ lastTemplateId: 't1' });
    await setPrefs({ mode: 'required' });
    expect(await getPrefs()).toEqual({ mode: 'required', lastTemplateId: 't1' });
  });
});
