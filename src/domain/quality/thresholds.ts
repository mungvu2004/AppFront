/**
 * Nơi DUY NHẤT ba mức chất lượng ảnh đầu vào được quyết.
 *
 * Màn `InputQualityGate` bị cấm tự đặt ngưỡng ([CẤM TUYỆT ĐỐI]: "Không tự tính
 * chỉ số ảnh, không tự đặt ngưỡng"), và một hằng số nằm trong màn thì không ai
 * kiểm được nó chống lại thứ gì. Nên nó nằm ở đây: tầng thuần, không React,
 * không `src/api`, không DOM — chạy được trong worker, test được không cần cây
 * React.
 *
 * ## Mọi con số dưới đây đều có hậu quả vật lý, không phải khẩu vị
 *
 * Neo chung cho cả bốn nhóm ngưỡng, phát biểu một lần ở đây vì cả bốn đều quy
 * về nó: **bản vẽ mặt bằng in trên khổ A3 ở tỉ lệ 1:100**, và tường mỏng nhất
 * hệ thống phải dò được là **tường 110 mm** (tường ngăn một lớp gạch đứng).
 *
 * - Cạnh ngắn A3 = 297 mm giấy. Ở 1:100, đó là 29.700 mm công trình.
 * - Tường 110 mm vẽ ra 1,1 mm trên giấy — tức **1/270 cạnh ngắn**.
 *
 * Từ tỉ lệ 1/270 đó suy ra được bề dày tường tính bằng pixel cho mọi độ phân
 * giải, và đó là thứ quyết định dò được hay không. Ba nhóm còn lại quy về cùng
 * một câu hỏi ở dạng khác: nghiêng bao nhiêu thì tường trôi khỏi ô của nó,
 * tương phản bao nhiêu thì nét mảnh nhất còn sống sót qua bước nhị phân hoá,
 * nhiễu bao nhiêu thì đốm giả nhiều hơn nét thật.
 *
 * Ba mức, không bốn — cùng lý lẽ với A4: mức thứ tư là thứ hệ ba mức tồn tại để
 * chặn. `'good'` là đo xong và dùng được, `'attention'` là dùng được nhưng
 * người dùng nên biết, `'poor'` là kết quả dò sẽ sai đủ nhiều để phải làm lại
 * đầu vào.
 *
 * Không mức nào trong ba mức này được dịch sang màu "đã xác minh" của A5: đây
 * là phán quyết của một phép đo tự động, không phải của người duyệt.
 */

/** Ba mức duy nhất một phép đo chất lượng có thể ở. */
export type ImageQualityLevel = 'good' | 'attention' | 'poor';

/** Bốn thứ đo được trên một bản vẽ đầu vào. */
export type ImageQualityMetricId = 'resolution' | 'skew' | 'contrast' | 'noise';

/* -------------------------------------------------------------------------- */
/* 1. Độ phân giải — theo CẠNH NGẮN của ảnh, tính bằng pixel.                  */
/* -------------------------------------------------------------------------- */

/**
 * Từ cạnh ngắn này trở lên, bề dày tường 110 mm là **≈ 7,4 px**.
 *
 * 2.000 / 270 = 7,4. Bảy pixel nghĩa là hai mép tường tách bạch hẳn và bề dày
 * đo được với sai số ±1 px ≈ ±15 mm — dưới dung sai 20 mm mà bước ghép trục
 * dùng để quyết hai đoạn có phải cùng một tường không. Đây là mốc đặc tả gọi là
 * "nên dùng ảnh từ 2.000 px trở lên".
 */
export const RESOLUTION_GOOD_SHORT_EDGE_PX = 2000;

/**
 * Dưới mốc này thì tường 110 mm mỏng hơn **≈ 4,4 px** và phép dò bắt đầu hỏng.
 *
 * 1.200 / 270 = 4,4. Ở bốn pixel, hai mép tường vẫn tách được nhưng sai số
 * ±1 px đã là ±25 mm — vượt dung sai ghép trục, nên hai đoạn của cùng một bức
 * tường có thể bị đọc thành hai bức. Dưới 1.200 px là `'poor'`, và đó là lý do
 * đặc tả xếp ảnh 1.240 x 900 px vào mức kém: cạnh ngắn của nó là 900, tường chỉ
 * còn 3,3 px.
 */
export const RESOLUTION_ATTENTION_SHORT_EDGE_PX = 1200;

/* -------------------------------------------------------------------------- */
/* 2. Độ nghiêng — độ, đo bằng trị tuyệt đối (nghiêng trái hay phải đều tệ).   */
/* -------------------------------------------------------------------------- */

/**
 * Tới nửa độ, một bức tường dài 12 m trôi **≈ 105 mm** từ đầu này sang đầu kia.
 *
 * 12.000 × tan(0,5°) = 105 mm — nhỏ hơn đúng một bề dày tường 110 mm, nghĩa là
 * tường vẫn nằm trong ô của chính nó và bước bắt trục vuông góc vẫn khớp. Đặc
 * tả gọi 0,2 độ là đạt; 0,2 nằm gọn dưới mốc này.
 */
export const SKEW_GOOD_DEG = 0.5;

/**
 * Từ 5 độ trở lên, cùng bức tường 12 m trôi **≈ 1.050 mm** — trọn một chiều
 * rộng hành lang.
 *
 * 12.000 × tan(5°) = 1.050 mm. Ở mức đó phép bắt trục vuông góc không còn tìm
 * ra được hai chùm đường vuông góc nhau, và kết quả dò phải bỏ đi chứ không nắn
 * cứu được. Dưới mốc này là `'attention'`: nắn tự động vẫn xử lý được, đúng như
 * đặc tả xếp 3,4 độ vào nhóm cần nắn — 12.000 × tan(3,4°) = 713 mm, trôi quá
 * nửa mét nên phải nắn, nhưng chưa mất trục.
 */
export const SKEW_ATTENTION_DEG = 5;

/* -------------------------------------------------------------------------- */
/* 3. Độ tương phản — thang 0..1, khoảng cách chuẩn hoá giữa mực và nền giấy.  */
/* -------------------------------------------------------------------------- */

/**
 * Từ 0,75 trở lên, nét mảnh nhất trên bản vẽ vẫn sống sót qua bước nhị phân
 * hoá.
 *
 * 0,75 nghĩa là mực chỉ đi được một phần tư quãng đường về phía trắng giấy. Với
 * biên đó, nét bút 0,13 mm — nét mảnh nhất mà tiêu chuẩn ghi kích thước dùng —
 * vẫn nằm trên ngưỡng Otsu sau khi cộng nhiễu quét thông thường, nên đường ghi
 * kích thước không bị đứt quãng thành các đoạn rời.
 */
export const CONTRAST_GOOD_SCORE = 0.75;

/**
 * Dưới 0,45 thì nét mảnh biến mất hẳn, không phải mờ đi.
 *
 * Ở khoảng cách mực–giấy nhỏ hơn 45% dải sáng, nhiễu quét đủ để đẩy các pixel
 * của một nét 0,13 mm xuống dưới ngưỡng nhị phân hoá — đường ghi kích thước và
 * nét đứt của ô mở rụng khỏi ảnh trước khi phép dò kịp nhìn thấy chúng. Mất nét
 * là mất dữ liệu, không cứu lại được bằng cách tăng tương phản sau, nên đây là
 * `'poor'`.
 */
export const CONTRAST_ATTENTION_SCORE = 0.45;

/* -------------------------------------------------------------------------- */
/* 4. Nhiễu — thang 0..1, CÀNG CAO CÀNG TỆ (ngược chiều hai thang trên).       */
/* -------------------------------------------------------------------------- */

/**
 * Tới 0,20, đốm nhiễu vẫn ngắn hơn nét thật ngắn nhất nên bước gộp đoạn nuốt
 * hết.
 *
 * Nét thật ngắn nhất phải giữ lại là vạch mũi tên ghi kích thước, dài ~2,5 mm
 * giấy. Ở mức nhiễu 0,20, đốm sinh ra dài dưới 1 mm giấy và bị bộ lọc độ dài
 * loại sạch trước khi vào bước dò — không đốm nào trở thành một đoạn thẳng giả.
 */
export const NOISE_GOOD_SCORE = 0.2;

/**
 * Trên 0,40, đốm giả nhiều hơn vạch thật và phép dò bắt đầu đọc nhiễu thành
 * tường.
 *
 * Qua mốc này các đốm bắt đầu dính nhau thành vệt dài quá bộ lọc độ dài, nên số
 * đoạn thẳng giả vượt số vạch ghi kích thước thật trên cùng tấm ảnh. Kết quả
 * không phải "kém chính xác" mà là "có thêm tường không tồn tại", nên là
 * `'poor'`.
 */
export const NOISE_ATTENTION_SCORE = 0.4;

/* -------------------------------------------------------------------------- */
/* Bốn hàm phân loại. Mỗi hàm nhận đúng một số đo, trả đúng một mức.           */
/* -------------------------------------------------------------------------- */

/**
 * Giá trị đúng BẰNG ngưỡng thuộc về mức tốt hơn — cả bốn hàm dưới đây đều vậy.
 *
 * Lý do là hướng của phép đo, không phải khẩu vị: ngưỡng nói "từ đây trở đi thì
 * hỏng", nên điểm nằm đúng trên nó là điểm cuối cùng còn chưa hỏng. Viết thành
 * `>=` / `<=` một lần ở đây để không nửa số nào trong bốn nhóm lệch chiều với
 * nửa còn lại.
 */
export function classifyResolution(shortEdgePx: number): ImageQualityLevel {
  if (shortEdgePx >= RESOLUTION_GOOD_SHORT_EDGE_PX) {
    return 'good';
  }

  return shortEdgePx >= RESOLUTION_ATTENTION_SHORT_EDGE_PX ? 'attention' : 'poor';
}

/** Trị tuyệt đối: nghiêng −3,4° và +3,4° làm tường trôi đúng như nhau. */
export function classifySkew(angleDeg: number): ImageQualityLevel {
  const magnitude = Math.abs(angleDeg);

  if (magnitude <= SKEW_GOOD_DEG) {
    return 'good';
  }

  return magnitude < SKEW_ATTENTION_DEG ? 'attention' : 'poor';
}

export function classifyContrast(score: number): ImageQualityLevel {
  if (score >= CONTRAST_GOOD_SCORE) {
    return 'good';
  }

  return score >= CONTRAST_ATTENTION_SCORE ? 'attention' : 'poor';
}

/** Thang nhiễu chạy ngược: số nhỏ là ảnh sạch. */
export function classifyNoise(score: number): ImageQualityLevel {
  if (score <= NOISE_GOOD_SCORE) {
    return 'good';
  }

  return score <= NOISE_ATTENTION_SCORE ? 'attention' : 'poor';
}

const CLASSIFIER_BY_METRIC = {
  contrast: classifyContrast,
  noise: classifyNoise,
  resolution: classifyResolution,
  skew: classifySkew,
} as const satisfies Record<ImageQualityMetricId, (value: number) => ImageQualityLevel>;

/**
 * Cùng bốn hàm trên, tra theo mã chỉ số.
 *
 * Bảng tra chứ không phải `switch`: `satisfies Record<ImageQualityMetricId, …>`
 * làm việc thêm một mã chỉ số mà quên hàm phân loại thành lỗi biên dịch, còn
 * `switch` thì chỉ thành một nhánh mặc định không ai để ý.
 */
export function classifyMetric(id: ImageQualityMetricId, value: number): ImageQualityLevel {
  return CLASSIFIER_BY_METRIC[id](value);
}

const LEVEL_RANK = {
  attention: 1,
  good: 0,
  poor: 2,
} as const satisfies Record<ImageQualityLevel, number>;

/**
 * Mức tệ nhất trong danh sách — mức mà cả tấm ảnh phải mang.
 *
 * Danh sách rỗng trả `'good'`: không đo được gì tệ thì không có gì để cảnh báo.
 * Đây KHÔNG phải "chưa đo" — chưa đo là chuyện của tầng gọi, ở đó vắng phép đo
 * được biểu diễn bằng vắng bản ghi, không phải bằng một mức thứ tư.
 */
export function worstLevel(levels: readonly ImageQualityLevel[]): ImageQualityLevel {
  return levels.reduce<ImageQualityLevel>(
    (worst, level) => (LEVEL_RANK[level] > LEVEL_RANK[worst] ? level : worst),
    'good',
  );
}
