import { APP, CAPTIONS, DATASETS, FIELDS, type Field } from './data'

/* Static markup of every layer in its initial state. Scenes only move, show and hide what is
   already here; nothing is created at runtime, so every frame is a pure function of the
   timeline position. Class names follow the extension's own components so colours, radii and
   wording match (entrypoints/popup/App.vue, src/recorder/*.vue, src/manage/TemplateTable.vue). */

export const BROWSER = { left: 240, top: 60, width: 1440, height: 810, chrome: 64 } as const
export const POPUP = { width: 360, right: 20, top: 70 } as const
export const POPOVER_WIDTH = 304
export const CAPTION_POS = { left: 96, bottom: 64 } as const

const PRIMARY = 'rounded-sm bg-brand px-3.5 py-1.5 font-medium whitespace-nowrap text-on-brand'
const SECONDARY = 'rounded-sm border border-line px-3 py-1.5 font-medium text-text'
const TEXT_INPUT = 'rounded-sm border border-muted bg-surface px-2 py-1.5 text-sm text-text'
const LABEL = 'block text-xs font-medium text-muted'
/** Token values GSAP needs as concrete colours when it animates the manage-page switches. */
export const SWITCH_COLORS = { trackOn: '#94aefe', trackOff: '#3d3c45', knobOn: '#121116', knobOff: '#e5e5e9' } as const
export const SWITCH_TRAVEL = 16

/** Track + knob, so a scene can slide the knob and recolour the track instead of swapping classes. */
function switchMarkup(on: boolean, dataEl?: string): string {
  const track = on ? SWITCH_COLORS.trackOn : SWITCH_COLORS.trackOff
  const knob = on ? SWITCH_COLORS.knobOn : SWITCH_COLORS.knobOff
  return `<span${dataEl ? ` data-el="${dataEl}"` : ''} class="relative inline-block h-5 w-9 rounded-full" style="background-color:${track}"><span data-el="knob" class="absolute top-0.5 left-0.5 size-4 rounded-full" style="background-color:${knob};transform:translateX(${on ? SWITCH_TRAVEL : 0}px)"></span></span>`
}

const SIGNET_PATHS =
  '<path d="M4.73176 28.0413C7.25665 28.0413 9.30348 25.9831 9.30348 23.4442C9.30348 20.9053 7.25665 18.8472 4.73176 18.8472C2.20686 18.8472 0.160034 20.9053 0.160034 23.4442C0.160034 25.9831 2.20686 28.0413 4.73176 28.0413Z"/>' +
  '<path d="M43.5883 28.0413C46.1132 28.0413 48.16 25.9831 48.16 23.4442C48.16 20.9053 46.1132 18.8472 43.5883 18.8472C41.0634 18.8472 39.0166 20.9053 39.0166 23.4442C39.0166 25.9831 41.0634 28.0413 43.5883 28.0413Z"/>' +
  '<path d="M25.7604 0H34.8607C36.1452 0 37.1879 1.04845 37.1879 2.34009V27.5811H25.7592V0H25.7604Z"/>' +
  '<path d="M13.99 0H0.570934C0.34389 0 0.160034 0.184875 0.160034 0.413176C0.160034 0.630311 0.327849 0.810223 0.543787 0.825112C0.614122 0.830075 0.681988 0.836279 0.737515 0.842483C2.33422 1.03852 4.51582 2.09318 5.77196 5.38618C8.05721 10.4845 15.5126 27.1046 15.5126 27.1046C15.7866 27.694 16.6059 27.7312 16.9317 27.1704L22.4486 16.7591C22.5189 16.6263 22.5226 16.4687 22.4584 16.3335L15.1289 0.727091C14.9203 0.284136 14.4774 0.0012408 13.99 0.0012408V0Z"/>'

const GEAR_PATH =
  'M7.84 1.8A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.8l.3 1.5c.47.2.91.45 1.31.76l1.45-.49a1 1 0 0 1 1.19.45l1.18 2.04a1 1 0 0 1-.2 1.25l-1.15 1.01a6 6 0 0 1 0 1.52l1.15 1.01a1 1 0 0 1 .2 1.25l-1.18 2.04a1 1 0 0 1-1.19.45l-1.45-.49c-.4.31-.84.57-1.31.76l-.3 1.5a1 1 0 0 1-.98.8H8.82a1 1 0 0 1-.98-.8l-.3-1.5a6 6 0 0 1-1.31-.76l-1.45.49a1 1 0 0 1-1.19-.45L2.41 13.1a1 1 0 0 1 .2-1.25l1.15-1.01a6 6 0 0 1 0-1.52L2.61 8.3a1 1 0 0 1-.2-1.25l1.18-2.04a1 1 0 0 1 1.19-.45l1.45.49c.4-.31.84-.56 1.31-.76l.3-1.5ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'

function signet(cls: string): string {
  return `<svg aria-hidden="true" viewBox="0 0 49 29" fill="currentColor" class="${cls}">${SIGNET_PATHS}</svg>`
}

/** The extension icon (assets/icon/icon.svg). `animated` wraps the level so the intro can raise it. */
function icon(size: number, prefix: string, animated = false): string {
  const liquid =
    '<path d="M16 68C30 60 44 60 58 66S88 74 112 62V90H16Z" fill="url(#' + prefix + '-liquid)"/>' +
    '<circle cx="42" cy="78" r="3.2" fill="#fff" fill-opacity=".75"/><circle cx="80" cy="74" r="2.4" fill="#fff" fill-opacity=".6"/>'
  return `<svg width="${size}" height="${size}" viewBox="0 0 128 128" aria-hidden="true" class="block">
    <defs>
      <linearGradient id="${prefix}-tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3649D4"/><stop offset=".55" stop-color="#1D00AD"/><stop offset="1" stop-color="#170092"/></linearGradient>
      <linearGradient id="${prefix}-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${prefix}-liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#77D9D8"/><stop offset="1" stop-color="#14B8B8"/></linearGradient>
      <clipPath id="${prefix}-field"><rect x="16" y="38" width="96" height="52" rx="14"/></clipPath>
    </defs>
    <rect width="128" height="128" rx="30" fill="url(#${prefix}-tile)"/>
    <rect x="1.5" y="1.5" width="125" height="125" rx="28.5" fill="none" stroke="url(#${prefix}-edge)" stroke-width="3"/>
    <g clip-path="url(#${prefix}-field)">
      <rect x="16" y="38" width="96" height="52" fill="#0B005F" fill-opacity=".55"/>
      ${animated ? `<g data-el="icon-liquid">${liquid}</g>` : liquid}
    </g>
    <rect x="16" y="38" width="96" height="52" rx="14" fill="none" stroke="#fff" stroke-width="7"/>
    <rect x="32" y="49" width="5" height="22" rx="2.5" fill="#fff"/>
  </svg>`
}

function formField(f: Field): string {
  return `<div class="min-w-0">
    <label class="mb-1.5 block text-[14px] font-medium text-[#4a5160]">${f.label}${f.required ? ' *' : ''}</label>
    <div data-field="${f.key}" class="relative flex h-11 items-center rounded-md border border-[#c9ced8] bg-[#fff] px-3.5 text-[18px] text-[#1f2430]">
      <span data-el="value" class="truncate"><span data-el="value-main"></span><span data-el="runid" class="text-brand-2"></span></span><span data-el="caret" class="ml-0.5 inline-block h-[22px] w-[2px] bg-[#1f2430]" style="opacity:0"></span>
      ${f.kind === 'select' ? '<span aria-hidden="true" class="ml-auto text-[#5f6775]">▾</span>' : ''}
    </div>
  </div>`
}

function capturedBox(f: Field): string {
  return `<div data-captured="${f.key}" class="pointer-events-none absolute rounded-md border-2 border-success outline-1 outline-bg" style="opacity:0">
    <span class="absolute -top-5 right-0 rounded-sm bg-success px-1.5 text-xs leading-5 font-medium whitespace-nowrap text-on-status">${f.typeLabel}</span>
  </div>`
}

function popupHeader(appName: string | null): string {
  const sub = appName ? '<span class="mt-0.5 block text-xs text-muted">An der Adresse erkannt</span>' : ''
  return `<header class="flex items-center gap-3 px-4.5 pt-4.5 pb-3.5">
    ${signet('h-[18px] w-[30px] shrink-0 text-text')}
    <h1 class="min-w-0"><span class="block truncate font-display text-xl leading-tight font-bold tracking-[-0.01em]">${appName ?? 'Form Filler'}</span>${sub}</h1>
    <span class="ml-auto grid size-8 shrink-0 place-items-center rounded-sm text-text"><svg aria-hidden="true" viewBox="0 0 20 20" class="size-4" fill="currentColor"><path fill-rule="evenodd" d="${GEAR_PATH}" clip-rule="evenodd"/></svg></span>
  </header>`
}

function popup(): string {
  return `<div data-el="popup" class="absolute grid gap-0 rounded-xl border border-line bg-bg text-sm text-text shadow-[0_30px_60px_rgb(0_0_0_/_0.55)]" style="width:${POPUP.width}px;right:${POPUP.right}px;top:${POPUP.top}px;opacity:0">
    <div data-el="popup-noapp">
      ${popupHeader(null)}
      <main class="grid gap-3.5 px-4.5 pt-1 pb-4.5">
        <p class="text-muted">Für diese Seite ist keine App hinterlegt.</p>
        <div class="grid gap-2">
          <h2 class="font-display text-base font-semibold">Neue App für diese Seite</h2>
          <label class="font-medium">Name</label>
          <div class="${TEXT_INPUT} flex h-8 items-center"><span data-el="newapp-name"></span><span data-el="newapp-caret" class="ml-0.5 inline-block h-4 w-[2px] bg-text" style="opacity:0"></span></div>
          <label class="font-medium">URL-Muster</label>
          <div class="${TEXT_INPUT} flex h-8 items-center font-mono text-xs">${APP.pattern}</div>
          <p class="text-xs text-muted">* steht für beliebige Zeichen. Der Browser fragt danach nach der Berechtigung für diese Adresse.</p>
          <span data-el="newapp-submit" class="${PRIMARY} justify-self-start">App anlegen</span>
        </div>
      </main>
    </div>
    <div data-el="popup-app" style="display:none">
      ${popupHeader(APP.name)}
      <main class="grid gap-3.5 px-4.5 pt-1 pb-4.5">
        <div role="radiogroup" aria-label="Umfang" class="grid grid-flow-col auto-cols-fr rounded-full border border-border-subtle bg-surface p-[3px]">
          <span class="rounded-full bg-brand px-2 py-1.5 text-center text-[13px] font-medium text-on-brand ring-1 ring-brand-fg ring-inset">Alle</span>
          <span class="rounded-full px-2 py-1.5 text-center text-[13px] font-medium text-muted">Nur Pflicht</span>
        </div>
        <section>
          <h2 class="mb-2 text-xs font-medium text-muted">Vorlagen</h2>
          <div data-el="template-row" class="rounded-xl border border-border-subtle bg-surface py-2.5 pr-2.5 pl-3.5" style="display:none">
            <div class="flex items-center gap-2">
              <div class="min-w-0 flex-1"><div class="truncate font-medium">${APP.template}</div></div>
              <span data-el="fill-button" class="${PRIMARY}">Füllen</span>
              <span class="rounded-sm px-2 py-1.5 text-base leading-none text-muted" aria-hidden="true">⋯</span>
            </div>
          </div>
          <p data-el="no-templates" class="text-muted">Noch keine Vorlagen für diese App.</p>
        </section>
        <div>
          <span data-el="new-template" class="block w-full rounded-xl border border-dashed border-brand-fg px-3 py-2.5 text-center font-medium text-brand-fg">+ Neue Vorlage</span>
          <div data-el="new-template-form" class="mt-2 grid gap-2" style="display:none">
            <label class="font-medium">Name der Vorlage</label>
            <div class="${TEXT_INPUT} flex h-8 items-center"><span data-el="newtpl-name"></span><span data-el="newtpl-caret" class="ml-0.5 inline-block h-4 w-[2px] bg-text" style="opacity:0"></span></div>
            <div class="flex gap-2"><span data-el="newtpl-submit" class="${PRIMARY}">Anlegen und Felder aufnehmen</span><span class="${SECONDARY}">Abbrechen</span></div>
          </div>
        </div>
        <div data-el="status" class="flex items-start gap-2.5 rounded-xl border border-border-subtle px-3 py-2.5" style="display:none">
          <span data-el="status-dot" aria-hidden="true" class="mt-1.5 size-2.5 shrink-0 rounded-full bg-success"></span>
          <p data-el="status-text" class="min-w-0 flex-1"></p>
        </div>
      </main>
    </div>
  </div>`
}

function permission(): string {
  return `<div data-el="permission" class="absolute w-[400px] rounded-xl border border-line bg-surface p-4 text-sm text-text shadow-[0_30px_60px_rgb(0_0_0_/_0.55)]" style="right:${POPUP.right + 24}px;top:${POPUP.top}px;opacity:0">
    <p class="font-medium">„Form Filler“ möchte zusätzliche Berechtigungen:</p>
    <p class="mt-1 text-muted">Daten auf portal.example.com lesen und ändern</p>
    <div class="mt-3 flex justify-end gap-2"><span class="${SECONDARY}">Ablehnen</span><span data-el="allow" class="${PRIMARY}">Zulassen</span></div>
  </div>`
}

function popover(): string {
  return `<div data-el="popover" class="absolute flex w-76 flex-col rounded-2xl border border-border-subtle bg-bg text-sm text-text shadow-xl" style="left:72px;top:380px;opacity:0">
    <div class="border-b border-border-subtle px-3.5 pt-3 pb-2.5">
      <h2 data-el="popover-title" class="font-display text-base font-semibold break-words">Feld „Firma“</h2>
    </div>
    <div class="space-y-3 px-3.5 py-3">
      <div><label class="${LABEL}">Datentyp</label><div data-el="popover-type" class="mt-1 flex items-center justify-between rounded-sm border border-muted bg-surface px-2 py-1.5 text-sm">Firmenname<span class="text-muted">▾</span></div></div>
      <div data-el="popover-slot"><label class="${LABEL}">Gehört zu Person</label><div class="mt-1 flex items-center justify-between rounded-sm border border-muted bg-surface px-2 py-1.5 text-sm">Person 1<span class="text-muted">▾</span></div></div>
      <div class="space-y-1.5">
        <div class="flex flex-wrap gap-1.5">
          <span data-el="chip-required" class="inline-flex items-center gap-1.5 rounded-full border border-brand-fg px-2.5 py-1 text-brand-fg">✓ Pflichtfeld</span>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1">Kennung anhängen</span>
        </div>
        <p class="text-xs text-muted">Pflichtfeld auf der Seite erkannt.</p>
        <p class="text-xs text-muted">Hängt die Kennung des Testlaufs an den Wert an.</p>
      </div>
    </div>
    <div class="flex items-center justify-end gap-2 border-t border-border-subtle px-3.5 py-2.5">
      <span class="${SECONDARY}">Abbrechen</span><span data-el="popover-accept" class="${PRIMARY}">Übernehmen</span>
    </div>
  </div>`
}

function bar(): string {
  return `<div data-el="bar" class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-x-3.5 rounded-3xl border border-border-subtle bg-bg py-2 pr-2 pl-4 text-[13px] whitespace-nowrap text-text shadow-xl" style="opacity:0">
    <span data-el="saved" class="py-1.5 pr-2.5" style="display:none"><span aria-hidden="true" class="text-success">✓</span> Vorlage gespeichert</span>
    <span data-el="bar-live" class="contents">
      <span class="flex items-center gap-2.5"><span data-el="rec-dot" aria-hidden="true" class="size-2.5 shrink-0 rounded-full bg-error"></span><span><b class="font-medium">Aufnahme</b> · <span data-el="bar-count">0 Felder</span></span></span>
      <span class="text-muted">Esc beendet</span>
      <span class="flex gap-1.5"><span class="rounded-sm border border-line px-3 py-1.5 font-medium">Beenden</span><span data-el="bar-save" class="rounded-sm bg-brand px-3 py-1.5 font-medium text-on-brand">Speichern</span></span>
    </span>
  </div>`
}

const MANAGE_ROWS: readonly { key: Field['key']; slot: string }[] = [
  { key: 'company', slot: '–' }, { key: 'email', slot: 'Person 1' }, { key: 'salutation', slot: 'Person 1' },
  { key: 'firstName', slot: 'Person 1' }, { key: 'phone', slot: 'Person 1' }, { key: 'customerNo', slot: '–' },
]

function manage(): string {
  const rows = MANAGE_ROWS.map(({ key, slot }) => {
    const f = FIELDS.find((x) => x.key === key)!
    return `<tr data-row="${f.key}" class="relative border-b border-line bg-bg align-middle">
      <td class="px-3 py-1.5 whitespace-nowrap"><span class="mr-1 inline-flex size-7 items-center justify-center rounded-sm text-muted select-none" aria-hidden="true">⋮⋮</span></td>
      <td class="px-2 py-1.5 font-medium">${f.label}</td>
      <td class="px-2 py-1.5 text-muted">${f.typeLabel}</td>
      <td class="px-2 py-1.5 text-muted">${slot}</td>
      <td class="px-2 py-1.5 text-center">${switchMarkup(f.required, 'switch-required')}</td>
      <td class="px-2 py-1.5 text-center">${switchMarkup(f.key === 'customerNo')}</td>
    </tr>`
  }).join('')
  return `<div data-el="manage" class="absolute inset-x-0 bottom-0 bg-bg text-text" style="top:${BROWSER.chrome}px;opacity:0">
    <header class="border-b border-line"><div class="flex items-center justify-between gap-3 px-8 py-4">
      <h1 class="font-display text-2xl font-bold tracking-[-0.01em]">Vorlagen verwalten</h1>
      <div class="flex gap-2"><span data-el="export" class="${SECONDARY}">Alles exportieren</span><span class="${SECONDARY}">Importieren …</span></div>
    </div></header>
    <main class="px-8 py-6">
      <div class="mb-4 flex items-baseline gap-3"><h2 class="font-display text-xl font-semibold">${APP.template}</h2><span class="text-sm text-muted">${APP.name} · 12 Felder</span><span data-el="export-one" class="${SECONDARY} ml-auto text-sm">Exportieren</span></div>
      <table class="w-full border-collapse text-sm">
        <thead><tr class="border-b border-line text-left text-xs font-medium text-muted">
          <th class="w-24 px-3 py-2"><span class="sr-only">Reihenfolge</span></th><th class="px-2 py-2">Feld</th><th class="px-2 py-2">Datentyp</th><th class="px-2 py-2">Slot</th><th class="px-2 py-2 text-center">Pflicht</th><th class="px-2 py-2 text-center">Kennung</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </main>
    <div data-el="export-doc" class="absolute flex size-14 items-center justify-center rounded-lg border border-line bg-surface font-mono text-xs text-brand-fg" style="right:120px;top:120px;opacity:0">{ }</div>
  </div>`
}

function browser(): string {
  return `<div data-el="browser" class="absolute overflow-hidden rounded-2xl bg-[#f4f5f7] shadow-[0_40px_80px_rgb(0_0_0_/_0.5)]" style="left:${BROWSER.left}px;top:${BROWSER.top}px;width:${BROWSER.width}px;height:${BROWSER.height}px">
    <div class="flex items-center gap-3.5 bg-surface px-5" style="height:${BROWSER.chrome}px">
      <span class="flex gap-2"><i class="block size-3.5 rounded-full bg-line"></i><i class="block size-3.5 rounded-full bg-line"></i><i class="block size-3.5 rounded-full bg-line"></i></span>
      <span data-el="url" class="h-9 flex-1 rounded-full bg-bg px-4.5 text-[17px] leading-9 text-muted">${APP.url.replace('https://', '')}</span>
      <span class="flex items-center gap-3.5">
        <i class="block size-6 rounded-md bg-line"></i>
        <span data-el="toolbar-icon" class="relative block size-6">${icon(24, 'tb')}<span data-el="badge" class="absolute -top-2 -right-2 rounded-full bg-success px-1.5 text-[12px] leading-[18px] font-bold text-on-status" style="opacity:0">✓</span></span>
        <i class="block size-6 rounded-md bg-line"></i>
      </span>
    </div>
    <div data-el="page" class="absolute inset-x-0 bottom-0 px-[72px] py-12 text-[#1f2430]" style="top:${BROWSER.chrome}px">
      <h1 class="font-display text-[30px] leading-tight font-semibold">${APP.title}</h1>
      <p class="mt-1.5 mb-7 text-[17px] text-[#5f6775]">${APP.subtitle}</p>
      <div class="grid max-w-[1100px] grid-cols-2 gap-x-9 gap-y-4">${FIELDS.map(formField).join('')}</div>
    </div>
    <div data-el="sweep" class="pointer-events-none absolute -top-[200px] -bottom-[200px] w-[220px] rotate-[20deg] bg-linear-to-r from-transparent via-[#fff]/12 to-transparent" style="left:-300px;opacity:0"></div>
    <div data-el="veil" class="absolute inset-x-0 bottom-0 bg-bg/55" style="top:${BROWSER.chrome}px;opacity:0"></div>
    ${FIELDS.map(capturedBox).join('')}
    <div data-el="pending" class="pointer-events-none absolute rounded-md border-2 border-brand-fg outline-1 outline-bg" style="opacity:0"></div>
    ${manage()}
    ${popup()}
    ${permission()}
    ${popover()}
    ${bar()}
  </div>`
}

function intro(): string {
  return `<div data-el="intro" class="absolute inset-0 grid place-items-center text-center">
    <div>
      <div data-el="icon" class="mx-auto w-[220px] drop-shadow-[0_24px_48px_rgb(0_0_0_/_0.5)]">${icon(220, 'intro', true)}</div>
      <h1 data-el="title" class="mt-7 font-display text-[120px] leading-none font-extrabold tracking-[-0.02em]">Form Filler</h1>
      <p data-el="claim" class="mt-3 text-[40px] font-light text-muted">${CAPTIONS.claim.title}</p>
      <div data-el="by" class="mt-14 flex items-center justify-center gap-3 text-[22px] text-muted">${CAPTIONS.by.title} ${signet('h-[22px] w-[37px] text-brand-fg')} Martin Liesche</div>
    </div>
  </div>`
}

function outro(): string {
  return `<div data-el="outro" class="absolute inset-0 grid place-items-center text-center" style="opacity:0">
    <div>
      <div class="mx-auto w-[160px]">${icon(160, 'outro')}</div>
      <h1 class="mt-6 font-display text-[96px] leading-none font-extrabold tracking-[-0.02em]">Form Filler</h1>
      <p data-el="outro-repo" class="mt-4 text-[40px] font-light text-brand-fg" style="opacity:0">${CAPTIONS.outroRepo.title}</p>
      <p data-el="outro-browsers" class="mt-3 text-[26px] font-light text-muted" style="opacity:0">${CAPTIONS.outroBrowsers.title}</p>
      <p data-el="outro-copyright" class="mt-12 text-[18px] text-subtle" style="opacity:0">${CAPTIONS.outroCopyright.title}</p>
    </div>
  </div>`
}

export function renderStage(): string {
  return `
    <div data-el="glow" class="absolute size-[1400px] rounded-full bg-[radial-gradient(circle,rgb(29_0_173_/_0.18),transparent_60%)]" style="left:260px;top:-235px"></div>
    <div data-el="window" class="absolute inset-0" style="opacity:0">${browser()}</div>
    <div data-el="band" class="pointer-events-none absolute inset-x-0 bottom-0 h-[230px] bg-linear-to-b from-transparent via-bg/90 via-30% to-bg"></div>
    ${intro()}
    ${outro()}
    <div data-el="captions" class="absolute" style="left:${CAPTION_POS.left}px;bottom:${CAPTION_POS.bottom}px;opacity:0">
      <h2 data-el="caption-title" class="font-display text-[56px] leading-[1.1] font-semibold tracking-[-0.01em]"></h2>
      <p data-el="caption-sub" class="mt-2 text-[28px] font-light text-muted"></p>
    </div>
    <div data-el="keys" class="absolute flex gap-4" style="right:140px;bottom:120px">
      ${(['alt', 'shift', 'f'] as const).map((k) => `<div data-key="${k}" class="grid size-[88px] place-items-center rounded-xl border border-line border-b-[5px] border-b-bg bg-surface font-display text-[28px] font-semibold" style="opacity:0">${k === 'alt' ? 'Alt' : k === 'shift' ? '⇧' : 'F'}</div>`).join('')}
    </div>
    <div data-el="ripple" class="absolute size-14 rounded-full border-[3px] border-brand-fg" style="left:0;top:0;opacity:0"></div>
    <svg data-el="cursor" class="absolute drop-shadow-[0_4px_8px_rgb(0_0_0_/_0.45)]" width="28" height="40" viewBox="0 0 28 40" aria-hidden="true" style="left:960px;top:600px;opacity:0"><path d="M3 2L3 32 11 24 17 37 23 34 17 21 27 21Z" fill="#fff" stroke="#110078" stroke-width="2.5" stroke-linejoin="round"/></svg>
  `
}

/** Demo values are rendered by the fill scene; exported so tests and scenes share one source. */
export const DEMO = DATASETS
