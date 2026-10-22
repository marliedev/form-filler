import './styles.css'
import { registerPageFonts } from '../../src/theme/overlayFonts'

registerPageFonts()
document.getElementById('stage')!.textContent = 'stage'
