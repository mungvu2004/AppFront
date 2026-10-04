import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { expectSentenceCase, expectSentenceCaseStrings, findSentenceCaseIssues } from '../expectSentenceCase';
import { expectSevenStates } from '../expectSevenStates';
import { createSevenStateScenarios } from '../sevenStateScenarios';

afterEach(cleanup);

describe('expectSentenceCase (A6)', () => {
  it('nút "bỏ qua" viết thường thì đỏ, nêu luật và từ', () => {
    const { container } = render(<button type="button">bỏ qua</button>);

    expect(() => {
      expectSentenceCase(container);
    }).toThrow(/"bỏ qua"[\s\S]*label-lowercase/u);
  });

  it('nhãn trong thuộc tính aria-label cũng được soát', () => {
    const { container } = render(<button aria-label="đóng hộp thoại" type="button" />);

    expect(findSentenceCaseIssues(container)).toEqual([
      expect.objectContaining({ rule: 'label-lowercase', source: 'aria-label', word: 'đóng' }),
    ]);
  });

  it('câu có kbd thì xanh, kể cả khi phím đứng đầu câu', () => {
    const { container } = render(
      <p>
        <kbd>j</kbd> đi xuống, bấm <kbd>Esc</kbd> để đóng.
      </p>,
    );

    expect(findSentenceCaseIssues(container)).toEqual([]);
  });

  it('nhãn "v12 — …" là mã, xanh', () => {
    const { container } = render(<span>v12 — bản nháp</span>);

    expect(findSentenceCaseIssues(container)).toEqual([]);
  });

  it('câu thứ hai viết thường thì đỏ', () => {
    const { container } = render(<p>Mạng đang yếu. mô hình đã tải xong vẫn xem được.</p>);

    expect(findSentenceCaseIssues(container)).toEqual([
      expect.objectContaining({ rule: 'sentence-lowercase', word: 'mô' }),
    ]);
  });

  it('chữ trong aria-hidden thì xanh', () => {
    const { container } = render(
      <div>
        <span aria-hidden="true">bỏ qua</span>
        <span hidden>ẩn đi</span>
      </div>,
    );

    expect(findSentenceCaseIssues(container)).toEqual([]);
  });

  it('chữ thường giữa câu, qua phần tử nội dòng, thì xanh', () => {
    const { container } = render(
      <p>
        Bạn đang xem <strong>tầng 2</strong> với vai người xem.
      </p>,
    );

    expect(findSentenceCaseIssues(container)).toEqual([]);
  });

  it('expectSevenStates soát A6 khi được bật, và nêu tên trạng thái', () => {
    expect(() => {
      expectSevenStates(
        (scenario) => render(<button type="button">{scenario.state === 'error' ? 'thử lại' : 'Thử lại'}</button>),
        createSevenStateScenarios(),
        { sentenceCase: true },
      );
    }).toThrow(/trạng thái "lỗi".*thử lại/su);
  });

  it('bảng chữ: một giá trị viết thường thì đỏ', () => {
    expect(() => {
      expectSentenceCaseStrings(['Tạo dự án', 'tải bản vẽ']);
    }).toThrow(/"tải bản vẽ"/u);
    expect(() => {
      expectSentenceCaseStrings(['Tạo dự án', 'Tải bản vẽ']);
    }).not.toThrow();
  });
});
