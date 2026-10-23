/* Two web components after the patterns common in component libraries, used to try the extension
   against open shadow DOM. Vanilla custom elements, no dependency. */

const FIELD_STYLE = `
  :host { display: grid; gap: 0.25rem; }
  input { font: inherit; padding: 0.4rem; border: 1px solid #555; border-radius: 4px; }
  :focus-visible { outline: 3px solid #1a56db; outline-offset: 2px; }`

/** Pattern 1: label and input live in the shadow root; name, label and required sit on the host. */
class WcTextField extends HTMLElement {
  connectedCallback(): void {
    if (this.shadowRoot) return
    const root = this.attachShadow({ mode: 'open' })
    const label = this.getAttribute('label') ?? ''
    const required = this.hasAttribute('required')
    root.innerHTML = `<style>${FIELD_STYLE}</style><label for="input">${label}${required ? ' *' : ''}</label><input id="input"${required ? ' required' : ''}>`
    // Real typing crosses the boundary on its own; a non-composed synthetic event is forwarded for listeners on the host.
    root.querySelector('input')?.addEventListener('input', (event) => {
      if (!event.composed) this.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    })
  }

  get value(): string {
    return this.shadowRoot?.querySelector('input')?.value ?? ''
  }
}

/** Pattern 2: a main-document <label for="…"> points at the host; only the input is inside. */
class WcInput extends HTMLElement {
  connectedCallback(): void {
    if (this.shadowRoot) return
    const root = this.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>${FIELD_STYLE}</style><input>`
    root.querySelector('input')?.addEventListener('input', (event) => {
      if (!event.composed) this.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    })
  }

  get value(): string {
    return this.shadowRoot?.querySelector('input')?.value ?? ''
  }
}

customElements.define('wc-text-field', WcTextField)
customElements.define('wc-input', WcInput)
