import { expect, SITE_URL, test } from './fixtures'
import { APP } from './site'

const NOTHING_NEW = 'Abgeglichen: 0 neu, 0 aktualisiert, 0 lokal geändert (Kopie), 0 entfernt.'

test.describe('Vorlagen-Quelle', () => {
  test('gleicht Vorlagen aus der Quelle ab und behält lokale Änderungen als Kopie', async ({ extension }) => {
    await extension.seed([{ ...APP, source: { url: `${SITE_URL}/templates.json`, appId: null } }], [])
    const manage = await extension.openManage()
    const status = manage.getByRole('status')
    const templates = manage.getByRole('region', { name: `Vorlagen von ${APP.name}` })

    await manage.getByRole('button', { name: 'Abgleichen', exact: true }).click()
    await expect(status).toContainText('Abgeglichen: 2 neu, 0 aktualisiert, 0 lokal geändert (Kopie), 0 entfernt.')
    await expect(templates.getByRole('button')).toHaveText([/Firma \(Team\).*Quelle/, /Adresse \(Team\).*Quelle/])

    // Nothing changed on either side: the second sync is a no-op.
    await manage.getByRole('button', { name: 'Abgleichen', exact: true }).click()
    await expect(status).toContainText(NOTHING_NEW)

    // A local edit survives as a copy; the source version takes the original's place.
    await extension.renameSynced('team-firma', 'Firma (meins)')
    await expect(templates.getByRole('button').first()).toHaveText(/Firma \(meins\)/)
    await manage.getByRole('button', { name: 'Alle abgleichen' }).click()
    await expect(status).toContainText(`${APP.name} – Abgeglichen: 0 neu, 1 aktualisiert, 1 lokal geändert (Kopie), 0 entfernt.`)
    await expect(templates.getByRole('button')).toHaveText([/Firma \(Team\).*Quelle/, /^Firma \(meins\) \(lokal\)(?!.*Quelle)/, /Adresse \(Team\).*Quelle/])
  })
})
