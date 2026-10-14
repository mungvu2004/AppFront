/**
 * Phase 10 · SCR-40 · /design-system/states — tree + screen selection (FL-10D-05) and the seven frames (FL-10D-06).
 * Dev server mock (devTest), anon, 1440×900. Source: src/screens/system/StateGallery/*.tsx.
 */
import { captureEvidence } from './support/evidence';
import { devTest as test, expect } from './support/p10/devServer';
import {
  ACCOUNT_SCREEN,
  GROUP_HEADINGS,
  OTHER_SCREEN,
  SEVEN_FRAMES,
  STATES_PATH,
  frames,
  openStates,
  screenButton,
  selectScreen,
  toolbar,
  tree,
} from './support/p10/P6';

test('SCR-40 · FL-10D-05 · anon · states: cây và chọn màn', async ({ devPage }) => {
  await test.step('[10D-A-301] mở /design-system/states', async () => {
    await openStates(devPage);
    await expect(devPage).toHaveURL(new RegExp(`${STATES_PATH}$`, 'u'));
    await expect(devPage).not.toHaveURL(/\/login/u);
    await captureEvidence(devPage, 'D10_10D-A-301_states_open.png');
  });

  await test.step('[10D-A-302] chưa chọn màn', async () => {
    // StateGallery.tsx:EMPTY_TITLE / EMPTY_DESCRIPTION
    await expect.soft(devPage.getByText('Chưa chọn màn nào', { exact: true })).toBeVisible();
    await expect
      .soft(devPage.getByText('Chọn một màn ở cây bên trái để xem bảy trạng thái của màn đó.', { exact: true }))
      .toBeVisible();
    await captureEvidence(devPage, 'D10_10D-A-302_states_unselected.png');
  });

  await test.step('[10D-B-301] empty: cây vẫn đầy', async () => {
    await expect.soft(tree(devPage)).toBeVisible();
    await expect.soft(tree(devPage).getByRole('button').first()).toBeVisible();
    expect.soft(await tree(devPage).getByRole('button').count()).toBeGreaterThan(0);
    await captureEvidence(devPage, 'D10_10D-B-301_states_empty_tree.png');
  });

  await test.step('[10D-E-306] landmark', async () => {
    await expect.soft(toolbar(devPage)).toBeVisible();
    await expect.soft(tree(devPage)).toBeVisible();
    // The frames region only exists once a screen is selected (StateGallery.tsx RightPane) — checked in A-306.
    await expect.soft(devPage.locator('main')).toHaveCount(1); // router.tsx:155 suspendedOutsideMain: no nested <main>
    await captureEvidence(devPage, 'D10_10D-E-306_states_landmarks.png');
  });

  await test.step('[10D-A-303] tóm tắt', async () => {
    const texts = await tree(devPage).getByRole('button').allTextContents();
    const counts = texts.map((t) => /(\d+)\/(\d+)/u.exec(t));
    const present = counts.reduce((sum, m) => sum + Number(m?.[1] ?? 0), 0);
    const total = counts.reduce((sum, m) => sum + Number(m?.[2] ?? 0), 0);
    const dd = (label: string) => devPage.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd');
    await expect.soft(dd('Số trạng thái đã có')).toHaveText(`${present}/${total}`);
    await expect.soft(dd('Số màn')).toHaveText(String(texts.length));
    await captureEvidence(devPage, 'D10_10D-A-303_states_summary.png');
  });

  await test.step('[10D-A-304] tám nhóm', async () => {
    await expect.soft(tree(devPage).locator('h3')).toHaveText([...GROUP_HEADINGS]);
    await captureEvidence(devPage, 'D10_10D-A-304_states_groups.png');
  });

  await test.step('[10D-A-305] hàng cây', async () => {
    const row = screenButton(devPage, ACCOUNT_SCREEN);
    await expect.soft(row).toContainText('đã có 7/7'); // sr-only prefix + badge (StateGalleryTree.tsx:ScreenRow)
    await expect.soft(row).toContainText('Đủ bảy trạng thái');
    await captureEvidence(devPage, 'D10_10D-A-305_states_row.png');
  });

  await test.step('[10D-A-306] chọn Cài đặt tài khoản', async () => {
    await selectScreen(devPage, ACCOUNT_SCREEN);
    await expect(frames(devPage)).toBeVisible();
    await captureEvidence(devPage, 'D10_10D-A-306_states_selected.png');
  });

  await test.step('[10D-B-302] success', async () => {
    await expect.soft(devPage.getByText('Không màn nào còn thiếu trạng thái.', { exact: true })).toBeVisible();
    await captureEvidence(devPage, 'D10_10D-B-302_states_success.png');
  });

  await test.step('[10D-A-307] chọn màn khác', async () => {
    await selectScreen(devPage, OTHER_SCREEN);
    await expect.soft(screenButton(devPage, ACCOUNT_SCREEN)).not.toHaveAttribute('aria-current', 'true');
    await expect.soft(frames(devPage).getByRole('heading', { level: 2, name: ACCOUNT_SCREEN })).toHaveCount(0);
    await captureEvidence(devPage, 'D10_10D-A-307_states_other.png');
  });
});

test('SCR-40 · FL-10D-06 · anon · states: bảy khung trạng thái', async ({ devPage }) => {
  await openStates(devPage);
  await selectScreen(devPage, ACCOUNT_SCREEN);
  const frame = (label: string) =>
    frames(devPage).locator('figure').filter({ has: devPage.getByText(label, { exact: true }) });

  // Seven steps written out (one literal id each) so lint-flows / coverage-gate can see them.
  await test.step('[10D-A-311] khung rỗng', async () => {
    const [label, code] = SEVEN_FRAMES[0];
    await expect.soft(frame(label)).toBeVisible();
    await expect.soft(frame(label)).toContainText('Đã có mẫu');
    await expect.soft(frame(label).locator('code')).toHaveText(code);
    await captureEvidence(devPage, 'D10_10D-A-311_frame_empty.png');
  });
  await test.step('[10D-A-312] khung đang tải', async () => {
    const [label, code] = SEVEN_FRAMES[1];
    await expect.soft(frame(label)).toBeVisible();
    await expect.soft(frame(label)).toContainText('Đã có mẫu');
    await expect.soft(frame(label).locator('code')).toHaveText(code);
    await captureEvidence(devPage, 'D10_10D-A-312_frame_loading.png');
  });
  await test.step('[10D-A-313] khung một phần', async () => {
    const [label, code] = SEVEN_FRAMES[2];
    await expect.soft(frame(label)).toBeVisible();
    await expect.soft(frame(label).locator('code')).toHaveText(code);
    await captureEvidence(devPage, 'D10_10D-A-313_frame_partial.png');
  });
  await test.step('[10D-A-314] khung lỗi', async () => {
    const [label, code] = SEVEN_FRAMES[3];
    await expect.soft(frame(label)).toBeVisible();
    await expect.soft(frame(label).locator('code')).toHaveText(code);
    await captureEvidence(devPage, 'D10_10D-A-314_frame_error.png');
  });
  await test.step('[10D-A-315] khung thành công', async () => {
    const [label, code] = SEVEN_FRAMES[4];
    await expect.soft(frame(label)).toBeVisible();
    await expect.soft(frame(label).locator('code')).toHaveText(code);
    await captureEvidence(devPage, 'D10_10D-A-315_frame_success.png');
  });
  await test.step('[10D-A-316] khung không có quyền', async () => {
    const [label, code] = SEVEN_FRAMES[5];
    await expect.soft(frame(label)).toBeVisible();
    await expect.soft(frame(label).locator('code')).toHaveText(code);
    await captureEvidence(devPage, 'D10_10D-A-316_frame_forbidden.png');
  });
  await test.step('[10D-A-317] khung thu gọn', async () => {
    const [label, code] = SEVEN_FRAMES[6];
    await expect.soft(frame(label)).toBeVisible();
    await expect.soft(frame(label).locator('code')).toHaveText(code);
    await captureEvidence(devPage, 'D10_10D-A-317_frame_collapsed.png');
  });

  await test.step('[10D-A-318] đúng 7 khung, 0 thiếu trên mọi màn', async () => {
    const rows = tree(devPage).getByRole('button');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i += 1) {
      await rows.nth(i).click();
      await expect(rows.nth(i)).toHaveAttribute('aria-current', 'true');
      await expect.soft(frames(devPage).locator('figure'), `screen #${i}`).toHaveCount(7);
      // absence only after the 7 frames of this screen are rendered
      await expect.soft(frames(devPage).getByText('Chưa có mẫu cho trạng thái này'), `screen #${i}`).toHaveCount(0);
    }
    await captureEvidence(devPage, 'D10_10D-A-318_frames_all_screens.png');
  });
});
