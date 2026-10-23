import { describe, expect, it } from 'vitest';
import { buildExport, parseExport } from '../../src/model/schema';
import type { AppDef, Template } from '../../src/model/types';

const app: AppDef = { id: 'app1', name: 'Demo', urlPatterns: ['https://example.com/*'] };
const template: Template = {
  id: 't1',
  appId: 'app1',
  name: 'Registrierung',
  process: { name: 'Onboarding', step: 1 },
  fields: [
    {
      id: 'f1',
      label: 'Firma',
      locator: { kind: 'text', name: 'company' },
      config: { type: 'companyName' },
      slot: null,
      required: true,
      appendRunId: false,
    },
    {
      id: 'f2',
      label: 'Alter',
      locator: { kind: 'text', inputType: 'number' },
      config: { type: 'number', min: 1, max: 9 },
      slot: '1',
      required: false,
      appendRunId: true,
    },
  ],
  lastMissing: ['f2'],
};

describe('parseExport', () => {
  it('accepts and keeps locator.scope, and accepts locators without it', () => {
    const first = template.fields[0];
    if (!first) throw new Error('fixture');
    const scoped: Template = { ...template, fields: [{ ...first, locator: { ...first.locator, scope: ['iframe:delivery', 'wc-input#po'] } }] };
    const result = parseExport(buildExport([app], [scoped]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.templates[0]?.fields[0]?.locator.scope).toEqual(['iframe:delivery', 'wc-input#po']);
    expect(parseExport(buildExport([app], [template])).ok).toBe(true);
  });

  it('round-trips the output of buildExport', () => {
    const result = parseExport(buildExport([app], [template]));
    expect(result).toEqual({
      ok: true,
      data: { format: 'form-filler', version: 1, apps: [app], templates: [template] },
    });
  });

  it('rejects text that is not JSON', () => {
    const result = parseExport('nicht json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('kein gültiges JSON');
  });

  it('rejects a wrong format marker and names the field', () => {
    const json = JSON.stringify({ format: 'other', version: 1, apps: [], templates: [] });
    const result = parseExport(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('format');
  });

  it('rejects an unsupported version and names the field', () => {
    const json = JSON.stringify({ format: 'form-filler', version: 2, apps: [], templates: [] });
    const result = parseExport(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('version');
  });

  it('rejects a template without fields', () => {
    const broken: Partial<Template> = { ...template };
    delete broken.fields;
    const json = JSON.stringify({ format: 'form-filler', version: 1, apps: [app], templates: [broken] });
    const result = parseExport(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('fields');
  });

  it('accepts source markers on apps and templates and drops them on export', () => {
    const sourced: AppDef = { ...app, source: { url: 'https://team.example.com/templates.json', appId: null } };
    const synced: Template = { ...template, source: { templateId: 'src-1', fingerprint: 'fp' } };
    const json = JSON.stringify({ format: 'form-filler', version: 1, apps: [sourced], templates: [synced] });
    const result = parseExport(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.apps[0]?.source).toEqual({ url: 'https://team.example.com/templates.json', appId: null });
      expect(result.data.templates[0]?.source).toEqual({ templateId: 'src-1', fingerprint: 'fp' });
    }
    const exported = JSON.parse(buildExport([sourced], [synced])) as { apps: unknown[]; templates: unknown[] };
    expect(exported.apps[0]).toEqual(app);
    expect(exported.apps[0]).not.toHaveProperty('source');
    expect(exported.templates[0]).toEqual(template);
    expect(exported.templates[0]).not.toHaveProperty('source');
  });

  it('rejects an unknown data type config', () => {
    const bad = { ...template, fields: [{ ...template.fields[0], config: { type: 'bogus' } }] };
    const json = JSON.stringify({ format: 'form-filler', version: 1, apps: [app], templates: [bad] });
    expect(parseExport(json).ok).toBe(false);
  });
});
