/**
 * Màn `ROUTES.onboarding` — lời chào và ba bước đầu tiên.
 *
 * Người mở màn này vừa đăng nhập lần đầu và chưa có gì trong tay. Thứ họ cần
 * không phải một băng trình chiếu mà là **ba câu và ba cái nút**: tạo dự án,
 * tải bản vẽ, duyệt kết quả. Nên hình dạng trang là thứ đơn giản nhất tìm được —
 * một cột rộng 960, một tiêu đề, một đoạn hai câu, ba thẻ ngang cùng cỡ, rồi
 * ba liên kết chìm cho người muốn đi đường khác.
 *
 * Hôm nay chỉ tới được bằng cách gõ URL; F-09a sẽ dẫn người vừa nhận lời mời
 * (N10) tới đây qua `ROUTES.onboarding` — B-V1-42. Admin tạo bằng CLI không đi
 * qua đây.
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

import { Check, Lock } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { motion } from '@/components/motion';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Badge } from '@/components/ui/Badge';
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
const FORBIDDEN_NOTE = 'Vai người xem chỉ duyệt được kết quả, không tạo dự án và không tải bản vẽ.';

/** Câu 1 của màn (NGUYEN-TAC-BO-CUC §1), tên khung ba bước và nhãn cột việc tiếp, theo demo Z/S-06. */
const PAGE_TITLE = 'Bắt đầu dự án đầu tiên trong ba bước';
const STEPS_TITLE = 'Từ bản vẽ tới mô hình 3D';
const NEXT_LABEL = 'Việc tiếp';

/** Vòng tiêu điểm 2px offset 2px mà A12 đòi, cho hai nút không đi qua `Button`. */
const FOCUS_RING_CLASS =
  'outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app';

/**
 * Ba cột nằm ngang từ 1024 trở lên, xếp dọc dưới đó — trong MỘT khung, ngăn bằng đường kẻ.
 *
 * Hai đường phải cùng chạy: `lg:` lo lúc chạy thật, `isCollapsed` lo story và
 * test — jsdom không có bề rộng cửa sổ để hỏi.
 */
function columnsClass(isCollapsed: boolean) {
  return cn('grid grid-cols-1', !isCollapsed && 'lg:grid-cols-3');
}

/** Đường kẻ giữa hai cột: trên khi xếp dọc, trái khi nằm ngang. */
function dividerClass(isCollapsed: boolean) {
  return cn('border-t border-border-default', !isCollapsed && 'lg:border-l lg:border-t-0');
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
  /** Câu luôn hiện dưới liên kết, kể cả khi liên kết bấm được. */
  readonly note?: string;
}

/** `id` của câu chú giải một liên kết chìm — nút và câu phải dùng chung đúng một chỗ dựng. */
const noteIdOf = (id: string): string => `${id}-note`;

/** Câu giải thích của một liên kết: lý do vô hiệu, hoặc câu `note` luôn hiện. */
const noteOf = (link: OnboardingLink, note?: string): string | null => link.disabledReason ?? note ?? null;

/**
 * Một liên kết chìm — chỉ cái nút, không kèm câu giải thích.
 *
 * Câu giải thích ở ngoài hàng (xem {@link QuietNote}): để trong cùng ô thì nó kéo
 * ô rộng và cao hơn, làm cặp liên kết lệch tâm (BUG-127). Vùng chạm 44 px dưới
 * 640 px, 24 px từ đó trở lên (WCAG 2.5.8), gạch chân và màu nhấn để nhìn ra là liên kết — chỉ khi bấm được.
 *
 * Liên kết vô hiệu KHÔNG mang thuộc tính `disabled`: nút bị `disabled`
 * rơi khỏi đường đi bàn phím và trình đọc màn hình thôi đọc nó, mà lý do vô hiệu
 * mới là thứ người dùng cần nghe. `aria-disabled` giữ nó ở lại trong tab order,
 * `aria-describedby` nối nó với câu giải thích.
 */
function QuietLink({ link, id, note }: QuietLinkProps) {
  const isDisabled = link.disabledReason !== null;

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : link.onActivate}
      aria-disabled={isDisabled ? true : undefined}
      aria-describedby={noteOf(link, note) === null ? undefined : noteIdOf(id)}
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-lg px-2 text-[13px] fine:min-h-6',
        'transition-colors duration-fast motion-reduce:transition-none',
        FOCUS_RING_CLASS,
        // Gạch chân và màu nhấn (A2) là dấu hiệu "bấm được": chữ xám gạch chân vẫn đọc như chữ thường
        // (run-19). Liên kết bị khoá không mang cả hai, nên không trông y như hai cái bên cạnh (BUG-127).
        isDisabled
          ? 'cursor-not-allowed text-text-muted'
          : 'text-accent underline underline-offset-2 hover:text-accent-hover',
      )}
    >
      {link.label}
    </button>
  );
}

function QuietNote({ link, id, note }: Pick<QuietLinkProps, 'link' | 'id' | 'note'>) {
  const text = noteOf(link, note);

  return text === null ? null : (
    <span id={noteIdOf(id)} className="text-[13px] text-text-secondary">
      {text}
    </span>
  );
}

const DONE_LABEL = 'Đã xong';

interface StepCardProps {
  readonly card: OnboardingStepCard;
  readonly delaySeconds: number;
  readonly isFirst: boolean;
  readonly isCollapsed: boolean;
}

/**
 * Một cột bước: số thứ tự · biểu tượng · nhãn trạng thái · tiêu đề · đúng một câu · một nút.
 *
 * Cột "việc tiếp" (`isPrimary`, chưa xong) có vạch accent trên và nhãn chữ: trạng thái nói bằng chữ,
 * không chỉ bằng màu. Bước khoá giữ nút vô hiệu (số lựa chọn của màn không đổi) và nói lý do cạnh ổ khoá.
 */
function StepCard({ card, delaySeconds, isFirst, isCollapsed }: StepCardProps) {
  const isLocked = card.state === 'locked';
  const isNext = card.isPrimary && card.state !== 'done';
  const reasonId = `onboarding-step-${card.id}-reason`;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durationSeconds('fast'), delay: delaySeconds }}
      className={cn('relative flex flex-col gap-4 px-6 pb-6 pt-5', !isFirst && dividerClass(isCollapsed))}
    >
      {isNext && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
      <div className="flex min-h-6 shrink-0 items-center gap-2">
        <span className="text-[13px] font-medium tabular-nums text-text-muted">{card.ordinal}</span>
        <Glyph id={card.id} className={cn('h-5 w-5', isLocked ? 'text-text-muted' : 'text-text-secondary')} />
        {card.state === 'done' && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-state-verified-tint px-2 py-0.5 text-[13px] font-medium text-state-verified-text">
            <Check size={14} strokeWidth={2} aria-hidden="true" />
            {DONE_LABEL}
          </span>
        )}
        {isNext && (
          <span className="ml-auto text-caption font-medium uppercase tracking-[0.06em] text-accent">{NEXT_LABEL}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className={cn('text-heading', isLocked ? 'text-text-secondary' : 'text-text-primary')}>{card.title}</h3>
        <p className="text-[14px] leading-5 text-text-secondary">{card.sentence}</p>
      </div>
      {/* Chỗ nút cố định ở đáy cột: sang trạng thái khác không có gì nhảy (HOP-DONG-V6 §2.5, BUG-128). */}
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
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
          <p id={reasonId} className="flex items-center gap-2 text-[13px] text-text-secondary">
            <Lock size={16} strokeWidth={1.75} aria-hidden="true" className="text-text-muted" />
            {card.lockedReason}
          </p>
        )}
      </div>
    </motion.li>
  );
}

/** Ba cột xương đúng chỗ ba cột thật, trong cùng khung. */
function LoadingCards({ isCollapsed }: { readonly isCollapsed: boolean }) {
  return (
    <div className={columnsClass(isCollapsed)} role="status" aria-busy="true">
      {['one', 'two', 'three'].map((slot, index) => (
        <div key={slot} aria-hidden="true" className={cn('px-6 pb-6 pt-5', index > 0 && dividerClass(isCollapsed))}>
          <div className="h-40 rounded-lg bg-border-default animate-pulse motion-reduce:animate-none" />
        </div>
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
  progressLabel,
}: WelcomeScreenProps) {
  const conditions = useMotionConditions();
  const delays = staggerDelaysMs(3, conditions);
  const isLoading = screenState === 'loading';

  return (
    <div className="min-h-full w-full bg-bg-app pb-12 pt-8">
      <div
        className={cn(
          'mx-auto flex w-full max-w-[1280px] flex-col px-8 xl:px-0',
          'transition-opacity duration-standard motion-reduce:transition-none',
          isDissolving ? 'opacity-0' : 'opacity-100',
        )}
      >
        {/* Ba câu (NGUYEN-TAC-BO-CUC §1): làm gì = h1, trạng thái = chip số bước + câu, bước tiếp = cột "Việc tiếp".
            Bên phải chỉ còn lối thoát "Bỏ qua" (và nút kết thúc khi đủ ba bước). */}
        <PageHead
          eyebrow={greeting}
          title={PAGE_TITLE}
          status={
            <>
              {progressLabel !== null && <Badge variant="neutral">{progressLabel}</Badge>}
              <span className="max-w-[720px]">{intro}</span>
            </>
          }
          next={
            <>
              {finishLabel !== null && (
                <Button variant="primary" onClick={onFinish}>
                  {finishLabel}
                </Button>
              )}
              {!isLoading && (
                <div className="flex flex-wrap items-center gap-x-2">
                  {sampleProjectLink === null ? null : <QuietLink id="onboarding-sample" link={sampleProjectLink} />}
                  {tutorialLink === null ? null : <QuietLink id="onboarding-tutorial" link={tutorialLink} />}
                  <QuietLink id="onboarding-skip" link={skipLink} note={skipNotice} />
                </div>
              )}
            </>
          }
        />

        <Section title={STEPS_TITLE} flush>
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
            <ul className={columnsClass(isCollapsed)}>
              {cards.map((card, index) => (
                <StepCard
                  key={card.id}
                  card={card}
                  isFirst={index === 0}
                  isCollapsed={isCollapsed}
                  delaySeconds={(delays[index] ?? 0) / 1000}
                />
              ))}
            </ul>
          )}
        </Section>

        {/* Câu hậu quả của "Bỏ qua" và các câu chú giải nằm dưới khung, luôn hiện (demo Z/S-06 mục 5). */}
        <div className="mt-4 flex flex-col gap-1 text-[13px] text-text-secondary">
          {screenState === 'forbidden' && <p>{FORBIDDEN_NOTE}</p>}
          {!isLoading && (
            <>
              {sampleProjectLink === null ? null : <QuietNote id="onboarding-sample" link={sampleProjectLink} />}
              {tutorialLink === null ? null : <QuietNote id="onboarding-tutorial" link={tutorialLink} />}
              <QuietNote id="onboarding-skip" link={skipLink} note={skipNotice} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
