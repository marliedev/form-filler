<script setup lang="ts">
import { reactive, ref } from 'vue'
import AriaCombobox, { type ComboOption } from './AriaCombobox.vue'

interface Address {
  street: string
  zip: string
  city: string
}

const step = ref(1)
const model = reactive({
  company: '',
  customerNo: '',
  notes: '',
  startDate: '',
  birthDate: '',
  industry: '',
  role: '',
  country: '',
  billingDiffers: false,
  address: { street: '', zip: '', city: '' } as Address,
  billing: { street: '', zip: '', city: '' } as Address,
  contactFirstName: '',
  contactEmail: '',
  costCenter: '',
  poNumber: '',
  delivery: { street: '', zip: '', city: '' } as Address,
})

/** Value of a web component; its input event is retargeted to the host. */
function componentValue(event: Event): string {
  const target = event.target as HTMLElement & { value?: string }
  return target.value ?? ''
}

// The delivery frame (same origin) reports its values with postMessage.
window.addEventListener('message', (event: MessageEvent) => {
  if (event.origin !== location.origin) return
  const data = event.data as { type?: string; value?: Partial<Address> } | null
  if (data?.type === 'delivery' && data.value) Object.assign(model.delivery, data.value)
})

const countries: ComboOption[] = [
  { value: 'de', label: 'Deutschland' },
  { value: 'at', label: 'Österreich' },
  { value: 'ch', label: 'Schweiz' },
  { value: 'xx', label: 'Nicht verfügbar', disabled: true },
]
const roles = ['Teilnehmer', 'Lernmanager', 'Admin']
</script>

<template>
  <main>
    <h1>Musterformular</h1>
    <form
      v-if="step === 1"
      @submit.prevent="step = 2"
    >
      <h2>Schritt 1: Firmendaten</h2>
      <label for="company">Firmenname *</label>
      <input
        id="company"
        v-model="model.company"
        name="company"
        required
      >

      <label for="customer-no">Kundennummer</label>
      <input
        id="customer-no"
        v-model="model.customerNo"
        name="customer_no"
        maxlength="20"
      >

      <label for="notes">Bemerkung</label>
      <textarea
        id="notes"
        v-model="model.notes"
        name="notes"
      />

      <label for="start-date">Startdatum</label>
      <input
        id="start-date"
        v-model="model.startDate"
        name="start_date"
        type="date"
      >

      <label for="birth-date">Geburtsdatum</label>
      <input
        id="birth-date"
        v-model="model.birthDate"
        name="birth_date"
        placeholder="TT.MM.JJJJ"
      >

      <label for="industry">Branche</label>
      <select
        id="industry"
        v-model="model.industry"
        name="industry"
      >
        <option value="">
          Bitte wählen
        </option>
        <option value="it">
          IT
        </option>
        <option value="handel">
          Handel
        </option>
        <option value="bau">
          Bau
        </option>
      </select>

      <fieldset>
        <legend>Rolle</legend>
        <label
          v-for="r in roles"
          :key="r"
        >
          <input
            v-model="model.role"
            type="radio"
            name="role"
            :value="r"
          > {{ r }}
        </label>
      </fieldset>

      <AriaCombobox
        v-model="model.country"
        label="Land"
        name="country"
        :options="countries"
      />

      <fieldset>
        <legend>Firmenadresse</legend>
        <label for="street">Straße</label>
        <input
          id="street"
          v-model="model.address.street"
          name="street"
        >
        <label for="zip">PLZ</label>
        <input
          id="zip"
          v-model="model.address.zip"
          name="zip"
        >
        <label for="city">Ort</label>
        <input
          id="city"
          v-model="model.address.city"
          name="city"
        >
      </fieldset>

      <wc-text-field
        name="cost_center"
        label="Kostenstelle"
        required
        @input="model.costCenter = componentValue($event)"
      />
      <label for="po-number">Bestellnummer</label>
      <wc-input
        id="po-number"
        name="po_number"
        @input="model.poNumber = componentValue($event)"
      />
      <iframe
        src="/frame.html"
        name="delivery"
        title="Lieferadresse"
        class="frame"
      />

      <label>
        <input
          v-model="model.billingDiffers"
          type="checkbox"
          name="billing_differs"
        > Rechnungsadresse abweichend
      </label>

      <fieldset v-if="model.billingDiffers">
        <legend>Rechnungsadresse</legend>
        <label for="billing-street">Straße</label>
        <input
          id="billing-street"
          v-model="model.billing.street"
          name="billing_street"
        >
        <label for="billing-zip">PLZ</label>
        <input
          id="billing-zip"
          v-model="model.billing.zip"
          name="billing_zip"
        >
        <label for="billing-city">Ort</label>
        <input
          id="billing-city"
          v-model="model.billing.city"
          name="billing_city"
        >
      </fieldset>

      <button type="submit">
        Weiter
      </button>
    </form>

    <form
      v-else
      @submit.prevent
    >
      <h2>Schritt 2: Ansprechpartner</h2>
      <label for="contact-first-name">Vorname</label>
      <input
        id="contact-first-name"
        v-model="model.contactFirstName"
        name="contact_first_name"
      >
      <label for="contact-email">E-Mail</label>
      <input
        id="contact-email"
        v-model="model.contactEmail"
        name="contact_email"
        type="email"
      >
      <button
        type="button"
        @click="step = 1"
      >
        Zurück
      </button>
    </form>

    <h2>Model</h2>
    <pre data-testid="model">{{ JSON.stringify(model, null, 2) }}</pre>
  </main>
</template>

<style>
main { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
form { display: grid; gap: 0.5rem; }
fieldset { display: grid; gap: 0.5rem; }
input, select, textarea, .combo { font: inherit; padding: 0.4rem; border: 1px solid #555; border-radius: 4px; }
:focus-visible { outline: 3px solid #1a56db; outline-offset: 2px; }
.field { display: grid; gap: 0.25rem; position: relative; }
.list { list-style: none; margin: 0; padding: 0; border: 1px solid #555; background: #fff; }
.list li { padding: 0.4rem; cursor: pointer; }
.list li.active, .list li:hover { background: #dbe7ff; }
.list li[aria-disabled='true'] { color: #595959; cursor: not-allowed; }
pre { background: #f3f3f3; padding: 1rem; }
.frame { width: 100%; height: 14rem; border: 1px solid #555; border-radius: 4px; }
</style>
