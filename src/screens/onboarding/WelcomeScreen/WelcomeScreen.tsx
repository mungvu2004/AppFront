/**
 * Màn `ROUTES.onboarding` — lời chào và ba bước đầu tiên.
 *
 * Người mở màn này vừa đăng nhập lần đầu và chưa có gì trong tay. Thứ họ cần
 * không phải một băng trình chiếu mà là **ba câu và ba cái nút**: tạo dự án,
 * tải bản vẽ, duyệt kết quả. Nên hình dạng trang là thứ đơn giản nhất tìm được —
 * một cột rộng 960, một tiêu đề, một đoạn hai câu, ba thẻ ngang cùng cỡ, rồi
 * ba liên kết chìm cho người muốn đi đường khác.
 *
 * **Mục D / R-60 — view thuần.** Mọi thứ vẽ ra đến từ `WelcomeScreenProps`:
 * không store, không mạng, không `Date`, không một phép định dạng số nào.
 * `WelcomeScreenProps` KHÔNG còn là một khối khai lại: nó là chính
 * `WelcomeScreenViewModel` của `useWelcomeScreen.ts`, mượn về bằng `import type`.
 * Hai bản chép song song của hợp đồng đông cứng đã gộp làm một ở lượt tích hợp,
 * nên từ đây một trường đổi tên là một lỗi biên dịch chứ không phải một lỗi lúc chạy.
 *
 * **Ba con số chuyển động.** Đặc tả xin ba con số cho stagger, vẽ nét và hoà
 * tan; cả ba đều nằm ngoài thang của mục B nên `local/no-raw-duration` từ chối
 * cả ba, và không con số nào trong đó xuất hiện ở đây. Bản thay thế hợp lệ:
 * `staggerDelaysMs(3, conditions)` → `[0, 24, 48]`; class
 * `animate-empty-icon-draw` (`AMBIENT_LOOP_MS`); và `duration-standard` cho lúc
 * hoà tan. Không con số mili-giây nào viết tay trong file này. `MotionProvider` đã đặt `reducedMotion="user"` một lần cho
 * toàn ứng dụng nên `motion.li` tự lo phần của nó; hai thứ nằm ngoài tầm với của
 * provider vẫn phải tự chặn — class keyframe của Tailwind chặn bằng
 * `motion-reduce:animate-none` (đúng cách `Skeleton` và `PipelineStepper` đang
 * làm), độ trễ stagger chặn bằng `useMotionConditions()`, thứ `staggerDelaysMs`
 * đọc để tự trả `[0, 0, 0]`.
 *
 * **Chuỗi nào của ai.** Câu người đọc thấy phần lớn đến từ hook. Bốn câu còn lại
 * — tiêu đề lỗi, câu lỗi dự phòng, nhãn thử lại, câu chú giải vai Người xem —
 * không có trường nào trong view model chở chúng, nên chúng viết thẳng ở đây,
 * đúng bảng chuỗi của hợp đồng.
 */

import { EmptyState } from '@/components/feedback/EmptyState';
import { motion } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { useMotionConditions } from '@/hooks/useMotionConditions';
import { durationSeconds } from '@/lib/motion';
import { staggerDelaysMs } from '@/lib/motion/stagger';
import { cn } from '@/lib/utils';

import type {
  OnboardingLink,
  OnboardingStepCard,
  OnboardingStepId,
  WelcomeScreenViewModel,
} from './useWelcomeScreen';

/**
 * Props của view = view model của hook, một nguồn duy nhất.
 *
 * Hai bản chép song song của hợp đồng mục 2 đã gộp ở đây: bản còn lại là bản
 * trong `useWelcomeScreen.ts`, và view mượn nó bằng `import type`. Kiểu bị xoá
 * lúc biên dịch nên không một dòng mã chạy được nào của view chạm tới hook —
 * R-60 vẫn nguyên, và `pnpm lint` là thứ nói câu đó chứ không phải chú thích này.
 */
export type WelcomeScreenProps = WelcomeScreenViewModel;

export type { OnboardingLink, OnboardingStepCard, OnboardingStepId, OnboardingStepState } from './useWelcomeScreen';

/** Bốn câu không trường nào chở, viết thẳng theo bảng chuỗi của hợp đồng. */
const ERROR_TITLE = 'Không đọc được tiến độ';
const ERROR_FALLBACK = 'Chưa lấy được danh sách dự án nên chưa biết bạn đang ở bước nào.';
const RETRY_LABEL = 'Thử lại';
const FORBIDDEN_NOTE = 'Vai Người xem chỉ duyệt được kết quả, không tạo dự án và không tải bản vẽ.';

/** Cỡ thẻ và cỡ khung xương lúc đang tải là MỘT con số, nên nó là một hằng. */
const CARD_SIZE_CLASS = 'w-[300px] h-[220px]';

/** Viền, nền, bo 16, đệm 20. Không thẻ nào có nền màu — đó là điều cấm tuyệt đối. */
const CARD_CLASS = 'flex flex-col justify-between rounded-2xl border border-border-default bg-bg-surface p-5';

/** Vòng tiêu điểm 2px offset 2px mà A12 đòi, cho hai nút không đi qua `Button`. */
const FOCUS_RING_CLASS =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app';

/**
 * Ba thẻ nằm ngang từ 1024 trở lên, xếp dọc dưới đó.
 *
 * Hai đường phải cùng chạy: `lg:` lo lúc chạy thật, `isCollapsed` lo story và
 * test — jsdom không có bề rộng cửa sổ để hỏi.
 */
function cardRowClass(isCollapsed: boolean) {
  return cn(
    'flex w-full flex-col items-center gap-5',
    !isCollapsed && 'lg:flex-row lg:items-stretch lg:justify-center',
  );
}

/**
 * Nét vẽ của bốn biểu tượng, để thẳng trong file này.
 *
 * Không dựng component dùng chung cho bốn hình chỉ màn này cần: chúng là chi
 * tiết xếp chỗ của riêng đây, đúng lý do `ProjectCardTile` giữ `PlanPreview`
 * trong nhà nó (R-68). Màu đi qua `currentColor` nên `local/no-raw-color` không
 * có gì để bắt; nét 1,5 trong hộp 24 là kiểu nhà.
 */
const GLYPH_PATHS: Readonly<Record<OnboardingStepId | 'title', readonly string[]>> = {
  createProject: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M12 11v5', 'M9.5 13.5h5'],
  uploadDrawings: ['M12 3v10', 'M8.5 6.5 12 3l3.5 3.5', 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'],
  reviewAndBuild: ['M12 3 4 7.5v9L12 21l8-4.5v-9z', 'M4 7.5 12 12l8-4.5', 'M12 12v9'],
  title: ['M3 10.5 12 3l9 7.5', 'M5.5 9.5V20h13V9.5', 'M10 20v-5.5h4V20'],
};

interface GlyphProps {
  readonly id: OnboardingStepId | 'title';
  readonly className?: string;
  /**
   * Nét mái nhà ở đầu trang tự vẽ lấy mình đúng một lần khi màn hiện ra.
   * `strokeDasharray` phải có thì `stroke-dashoffset` mới có gì để chạy: keyframe
   * `empty-icon-draw` đưa offset từ 100 về 0, nên dasharray đặt 100 cho nét liền.
   */
  readonly selfDraws?: boolean;
}

function Glyph({ id, className, selfDraws = false }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0', selfDraws && 'animate-empty-icon-draw motion-reduce:animate-none', className)}
      style={selfDraws ? { strokeDasharray: 100 } : undefined}
    >
      {GLYPH_PATHS[id].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

interface QuietLinkProps {
  readonly link: OnboardingLink;
  readonly id: string;
  readonly toneClass: string;
  /** Câu luôn hiện dưới liên kết, kể cả khi liên kết bấm được. */
  readonly note?: string;
}

/**
 * Một liên kết chìm.
 *
 * Không có token riêng cho "liên kết chìm" trong repo, nên nó ghép từ hai token
 * đã có. Liên kết vô hiệu KHÔNG mang thuộc tính `disabled`: nút bị `disabled`
 * rơi khỏi đường đi bàn phím và trình đọc màn hình thôi đọc nó, mà lý do vô hiệu
 * mới là thứ người dùng cần nghe. `aria-disabled` giữ nó ở lại trong tab order,
 * `aria-describedby` nối nó với câu giải thích.
 */
function QuietLink({ link, id, toneClass, note }: QuietLinkProps) {
  const isDisabled = link.disabledReason !== null;
  const description = link.disabledReason ?? note ?? null;
  const descriptionId = `${id}-note`;

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={isDisabled ? undefined : link.onActivate}
        aria-disabled={isDisabled ? true : undefined}
        aria-describedby={description === null ? undefined : descriptionId}
        className={cn(
          'rounded-lg px-1 text-[13px] transition-colors duration-fast motion-reduce:transition-none',
          FOCUS_RING_CLASS,
          isDisabled ? 'cursor-not-allowed text-text-muted' : toneClass,
        )}
      >
        {link.label}
      </button>
      {description !== null && (
        <span id={descriptionId} className="text-[12px] text-text-muted">
          {description}
        </span>
      )}
    </span>
  );
}

interface StepCardProps {
  readonly card: OnboardingStepCard;
  readonly delaySeconds: number;
}

/**
 * Một thẻ bước: số thứ tự · biểu tượng · tiêu đề · đúng một câu · một nút.
 *
 * Thẻ không phải thứ bấm được — thứ bấm được là cái nút bên trong. Nhấc 1px khi
 * rê chuột và thu 0,985 khi bấm là hai phép biến đổi, không phải thời lượng, nên
 * chúng viết thẳng được. `lockedReason` là phần tử anh em cạnh nút vì `Button`
 * không có chỗ nào chở câu mô tả.
 */
function StepCard({ card, delaySeconds }: StepCardProps) {
  const isLocked = card.state === 'locked';
  const reasonId = `onboarding-step-${card.id}-reason`;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durationSeconds('fast'), delay: delaySeconds }}
      className={cn(
        CARD_CLASS,
        CARD_SIZE_CLASS,
        'transition-transform duration-fast hover:-translate-y-px active:scale-[0.985]',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-medium tabular-nums text-text-muted">{card.ordinal}</span>
        <Glyph id={card.id} className={cn('h-6 w-6', isLocked ? 'text-text-muted' : 'text-text-secondary')} />
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[15px] font-semibold text-text-primary">{card.title}</h2>
        <p className="text-[13px] leading-relaxed text-text-secondary">{card.sentence}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Button
          variant={card.isPrimary ? 'primary' : 'secondary'}
          size="sm"
          disabled={isLocked}
          onClick={card.onActivate}
          aria-describedby={isLocked ? reasonId : undefined}
        >
          {card.actionLabel}
        </Button>
        {card.lockedReason !== null && (
          <p id={reasonId} className="text-[12px] text-text-muted">
            {card.lockedReason}
          </p>
        )}
      </div>
    </motion.li>
  );
}

/** Ba hộp đúng cỡ thẻ. `Skeleton` không có preset nào ra hộp 300×220. */
function LoadingCards({ isCollapsed }: { readonly isCollapsed: boolean }) {
  return (
    <div className={cardRowClass(isCollapsed)} role="status" aria-busy="true">
      {['one', 'two', 'three'].map((slot) => (
        <div
          key={slot}
          aria-hidden="true"
          className={cn(CARD_SIZE_CLASS, 'rounded-2xl bg-bg-sunken animate-pulse motion-reduce:animate-none')}
        />
      ))}
    </div>
  );
}

export function WelcomeScreen({
  screenState,
  isCollapsed,
  greeting,
  intro,
  cards,
  sampleProjectLink,
  tutorialLink,
  skipLink,
  errorMessage,
  onRetry,
  finishLabel,
  onFinish,
  isDissolving,
  skipNotice,
}: WelcomeScreenProps) {
  const conditions = useMotionConditions();
  const delays = staggerDelaysMs(3, conditions);
  const isLoading = screenState === 'loading';

  return (
    <div className="min-h-full w-full bg-bg-app pb-16 pt-16">
      <div
        className={cn(
          'mx-auto flex w-full max-w-[960px] flex-col items-center gap-8 px-6',
          'transition-opacity duration-standard motion-reduce:transition-none',
          isDissolving ? 'opacity-0' : 'opacity-100',
        )}
      >
        <header className="flex flex-col items-center gap-3 text-center text-text-primary">
          <Glyph id="title" className="h-10 w-10" selfDraws />
          <h1 className="text-[28px] font-semibold tracking-tight">{greeting}</h1>
          <p className="max-w-[640px] text-[14px] leading-relaxed text-text-secondary">{intro}</p>
        </header>

        {screenState === 'error' ? (
          <EmptyState
            className="h-auto"
            icon={<Glyph id="reviewAndBuild" className="h-6 w-6" />}
            title={ERROR_TITLE}
            description={errorMessage ?? ERROR_FALLBACK}
            action={{ label: RETRY_LABEL, onClick: onRetry }}
          />
        ) : isLoading ? (
          <LoadingCards isCollapsed={isCollapsed} />
        ) : (
          <ul className={cardRowClass(isCollapsed)}>
            {cards.map((card, index) => (
              <StepCard key={card.id} card={card} delaySeconds={(delays[index] ?? 0) / 1000} />
            ))}
          </ul>
        )}

        {screenState === 'forbidden' && (
          <p className="max-w-[640px] text-center text-[13px] text-text-muted">{FORBIDDEN_NOTE}</p>
        )}

        {finishLabel !== null && (
          <Button variant="primary" onClick={onFinish}>
            {finishLabel}
          </Button>
        )}

        {!isLoading && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-2">
              <QuietLink
                id="onboarding-sample"
                link={sampleProjectLink}
                toneClass="text-text-secondary hover:text-text-primary"
              />
              <QuietLink
                id="onboarding-tutorial"
                link={tutorialLink}
                toneClass="text-text-secondary hover:text-text-primary"
              />
            </div>
            <QuietLink
              id="onboarding-skip"
              link={skipLink}
              toneClass="text-text-muted hover:text-text-secondary"
              note={skipNotice}
            />
          </div>
        )}
      </div>
    </div>
  );
}
