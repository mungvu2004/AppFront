import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { IconRail } from './icon-rail'

// AppFront 23R-E-001 / 23F-E-001: the extra-panel buttons are icon-only, so
// without `aria-label` the rail had nameless buttons ("Diện tích phòng" lived
// only in the hover tooltip).
describe('IconRail', () => {
  test('every rail button carries its panel label as its accessible name', () => {
    const html = renderToStaticMarkup(
      <IconRail
        activePanel="site"
        extraPanels={[
          { id: 'room-area', icon: <svg />, label: 'Diện tích phòng', component: () => null },
          { id: 'furniture', icon: <svg />, label: 'Thư viện đồ đạc', component: () => null },
        ]}
        onPanelChange={() => {}}
      />,
    )
    for (const label of ['Site', 'Diện tích phòng', 'Thư viện đồ đạc', 'Settings']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
  })
})
