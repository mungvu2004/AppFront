import { addCollection, Icon, type IconifyJSON } from '@iconify/react/offline'
import carbon from './icon-data/carbon.json'
import lucide from './icon-data/lucide.json'
import mdi from './icon-data/mdi.json'
import ph from './icon-data/ph.json'
import qlementineIcons from './icon-data/qlementine-icons.json'

// CSP blocks api.iconify.design/api.simplesvg.com/api.unisvg.com in production
// (and in tests/offline dev), so every icon the editor renders must already
// be in this module-global storage before first paint. `@iconify/react/offline`
// never calls the network API, unlike the default `@iconify/react` export.
for (const data of [carbon, lucide, mdi, ph, qlementineIcons]) {
  addCollection(data as IconifyJSON)
}

export { Icon }
