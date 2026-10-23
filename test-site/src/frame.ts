// Same-origin delivery address frame of the test site; it reports its values to the parent page.
function values(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const input of document.querySelectorAll<HTMLInputElement>('input')) out[input.name] = input.value
  return out
}

document.addEventListener('input', () => {
  window.parent.postMessage({ type: 'delivery', value: values() }, location.origin)
})
