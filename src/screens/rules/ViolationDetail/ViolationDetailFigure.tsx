/**
 * Khối 5 của tấm trượt chi tiết vi phạm: khối hình cao 240, cộng hình minh hoạ luật.
 *
 * View thuần như file chính (mục D, R-60). Không một phép hình học nào ở đây: chuỗi
 * `points` của từng đa giác và `viewBox` bao quanh chúng tới nơi đã tính xong trong
 * `props.figure2d`, do hook dựng bằng `toBuildFloorInput` + `resolveWallShapes`. Việc của
 * file này là đổ chuỗi vào thuộc tính và chọn token màu.
 *
 * ## Vì sao 2D mang màu vi phạm còn 3D mang màu nhấn
 *
 * Phán quyết G4 của người duyệt. Ở 2D, màu là một thuộc tính của `<polygon>`, nên đối
 * tượng gây lỗi mang đúng `--state-violation` và phần còn lại hạ xuống `--wall-idle` —
 * "ngữ cảnh xám trung tính" theo đúng nghĩa đen. Ở 3D thì không: `mountViewerScene` tô
 * vật được chọn bằng `--accent`, viết cứng trong `viewer3dScene.ts`, và cửa màu duy nhất
 * nơi gọi có là `tokenOfPartKind` — theo LOẠI bộ phận, không theo đối tượng. Sửa nó là
 * chạm hợp đồng của màn Viewer3D, thứ đặc tả cấm. Nên 3D dùng `--accent`, thứ A2 cho
 * phép vì đối tượng ấy bấm được, và 2D là chế độ mặc định vì nó là chế độ mang đúng màu.
 *
 * ## Vì sao canvas 3D chỉ là một `ref`
 *
 * Ngân sách `routeChunk` là 280 KiB và `screens/viewer/Viewer3D` một mình đã chiếm
 * 264,8 KiB. Lắp cảnh từ đây nghĩa là nhập tĩnh `three` vào chunk của màn này và vỡ cổng
 * kích thước ngay trước khi màn có dòng nội dung nào. Nên hook giữ `import()` động và
 * trả về `figureRef`; file này chỉ đưa ra một `<canvas>` để gắn vào. Khuôn: `previewRef`
 * của `RuleReport`.
 *
 * ## Không dựng được thì không dựng khung
 *
 * `figureUnavailable` bật, hoặc `figure2d` là `null`, hoặc cả hai năng lực xem trước đều
 * tắt — trong cả ba trường hợp khối này trả `null` và phần chữ đứng một mình. Một khung
 * xám rỗng cao 240 với dòng "không dựng được" bên trong là khung vỡ có trang trí, và đặc
 * tả cấm đúng thứ đó.
 */

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DIMMED_OPACITY } from '@/lib/coloring/legend';

import type { ViolationDetailViewProps } from './types';

/** Nhóm luật, đọc ngược từ props để thư mục này không có dòng nào nêu tên `@/domain`. */
type RuleGroup = NonNullable<ViolationDetailViewProps['group']>;

type FigureMode = ViolationDetailViewProps['figureMode'];

/** Cao 240 theo đặc tả, ở cả hai chế độ, để đổi chế độ không làm trang nhảy. */
const FIGURE_HEIGHT = 'h-[240px]';

/** Nền 2D: tường ngữ cảnh chỉ là một mảng xám nhạt, không phải một hình được nhìn. */
const CONTEXT_FILL_OPACITY = 0.18;

/** Đối tượng gây lỗi: đủ đậm để tìm thấy trong một phần tư giây, không đậm hơn. */
const SUBJECT_FILL_OPACITY = 0.32;

/** Nét viền vẽ theo pixel màn hình, không theo đơn vị mm của `viewBox`. */
const HAIRLINE = 1;

interface RuleDiagram {
  readonly label: string;
  readonly paths: readonly string[];
}

/**
 * Hình minh hoạ luật: một sơ đồ nét 1px cho mỗi nhóm luật.
 *
 * Nó KHÔNG viết căn cứ luật — căn cứ là câu ở khối 2, lấy nguyên văn từ `Rule.name`.
 * Đây là hình: hai đoạn thẳng và một khoảng cách, nói cho mắt biết luật đang đo cái gì
 * trước khi người đọc kịp đọc hết câu. Toạ độ nằm trong hộp 48×32 và không mang đơn vị.
 */
const RULE_DIAGRAMS: Readonly<Record<RuleGroup, RuleDiagram>> = {
  geometry: {
    label: 'sơ đồ hai đoạn tường và khe hở giữa chúng',
    paths: ['M4 8 H44', 'M4 24 H30', 'M30 24 H44', 'M30 20 V28'],
  },
  circulation: {
    label: 'sơ đồ lối đi và bề rộng thông thuỷ của nó',
    paths: ['M8 4 V28', 'M40 4 V28', 'M8 16 H40', 'M12 12 L8 16 L12 20', 'M36 12 L40 16 L36 20'],
  },
  area: {
    label: 'sơ đồ một mặt sàn và phần diện tích được đo',
    paths: ['M6 6 H42 V26 H6 Z', 'M6 12 H42', 'M6 18 H42'],
  },
  annotation: {
    label: 'sơ đồ một nhãn gắn vào bộ phận nó mô tả',
    paths: ['M6 10 H26 V20 H6 Z', 'M26 15 H40', 'M40 11 V19'],
  },
  levels: {
    label: 'sơ đồ hai tầng chồng lên nhau và chênh cao giữa chúng',
    paths: ['M6 10 H36', 'M6 24 H36', 'M40 10 V24', 'M37 13 L40 10 L43 13', 'M37 21 L40 24 L43 21'],
  },
};

interface RuleDiagramProps {
  readonly group: RuleGroup | null;
}

/** Sơ đồ nét 1px cạnh câu luật. Nhóm luật chưa có sơ đồ thì không vẽ gì. */
export function ViolationRuleDiagram({ group }: RuleDiagramProps) {
  if (group === null) {
    return null;
  }

  const diagram = RULE_DIAGRAMS[group];

  return (
    <svg
      aria-label={diagram.label}
      className="h-8 w-12 shrink-0 text-text-muted"
      fill="none"
      role="img"
      viewBox="0 0 48 32"
    >
      {diagram.paths.map((path) => (
        <path
          d={path}
          key={path}
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={HAIRLINE}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

interface FigurePlanProps {
  readonly figure2d: NonNullable<ViolationDetailViewProps['figure2d']>;
}

/**
 * Mặt bằng 2D: một `<polygon>` cho mỗi tường, ba quyết định màu và không gì khác.
 *
 * `isDimmed` là đường nối của xem trước hậu quả — trỏ vào hàng "xoá đối tượng" thì hook
 * bật cờ này cho các mã trong `affectedEntityIds` và vật tụt xuống `DIMMED_OPACITY`.
 * Token KHÔNG đổi khi làm mờ: hạ độ mờ là cách trung thực duy nhất để đẩy một vật ra
 * sau, còn đổi màu nó là nói rằng nó đã trở thành thứ khác.
 */
function ViolationFigurePlan({ figure2d }: FigurePlanProps) {
  return (
    <svg
      aria-label="mặt bằng quanh đối tượng gây lỗi"
      className={`w-full ${FIGURE_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      viewBox={figure2d.viewBox}
    >
      {figure2d.shapes.map((shape) => {
        const token = shape.isSubject ? 'var(--state-violation)' : 'var(--wall-idle)';
        const solid = shape.isSubject ? SUBJECT_FILL_OPACITY : CONTEXT_FILL_OPACITY;

        return (
          <polygon
            fill={token}
            fillOpacity={shape.isDimmed ? DIMMED_OPACITY : solid}
            key={shape.id}
            points={shape.points}
            stroke={token}
            strokeOpacity={shape.isDimmed ? DIMMED_OPACITY : 1}
            strokeWidth={HAIRLINE}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

export interface ViolationFigureProps {
  readonly capabilities: ViolationDetailViewProps['capabilities'];
  readonly figureMode: FigureMode;
  readonly onFigureModeChange: (mode: FigureMode) => void;
  readonly figure2d: ViolationDetailViewProps['figure2d'];
  readonly figureRef: ViolationDetailViewProps['figureRef'];
  readonly figureUnavailable: boolean;
}

/**
 * Khối hình, hoặc không có khối hình.
 *
 * Nút đổi chế độ chỉ hiện khi CẢ HAI chế độ dựng được — một nút chọn có đúng một lựa
 * chọn là một nút không làm gì, và bày ra một chế độ không dựng được rồi để nó hỏng khi
 * bấm là tệ hơn nữa.
 */
export function ViolationFigure(props: ViolationFigureProps) {
  const { canPreview2d, canPreview3d } = props.capabilities;
  const canShow2d = canPreview2d && props.figure2d !== null;
  const canSwitch = canShow2d && canPreview3d;

  if (props.figureUnavailable || (!canShow2d && !canPreview3d)) {
    return null;
  }

  const mode: FigureMode = canSwitch ? props.figureMode : canShow2d ? '2d' : '3d';

  const options = [
    { label: '2D', value: '2d' as FigureMode },
    { label: '3D', value: '3d' as FigureMode },
  ];

  return (
    <section aria-label="khối hình của vi phạm" className="flex flex-col gap-2">
      {canSwitch ? (
        <div className="flex justify-end">
          <SegmentedControl
            aria-label="chế độ khối hình"
            onChange={props.onFigureModeChange}
            options={options}
            value={mode}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[12px] border border-border-default bg-bg-sunken">
        {mode === '2d' && props.figure2d !== null ? (
          <ViolationFigurePlan figure2d={props.figure2d} />
        ) : (
          <canvas className={`w-full ${FIGURE_HEIGHT} bg-canvas-3d`} ref={props.figureRef} />
        )}
      </div>
    </section>
  );
}
