# **BÁO CÁO ĐẶC TẢ CHI TIẾT Ý TƯỞNG ĐỀ TÀI NGHIÊN CỨU KHOA HỌC**

## **TÊN ĐỀ TÀI ĐỀ XUẤT**

**HỆ THỐNG SỐ HÓA TỰ ĐỘNG BẢN VẼ KỸ THUẬT 2D ĐA TẦNG THÀNH MÔ HÌNH 3D TƯƠNG TÁC SỬ DỤNG KIẾN TRÚC AI ĐA MÔ HÌNH HYBRID (SEGFORMER + YOLO + PADDLEOCR)**

---

## **PHẦN I: ĐẶT VẤN ĐỀ, "NỖI ĐAU" THỰC TẾ & PHẠM VI NGHIÊN CỨU**

### **1.1. Bối cảnh thực tế của ngành Quản lý hạ tầng (Facility Management)**

Trong kỷ nguyên Chuyển đổi số và Internet vạn vật (IoT), khái niệm **Bản sao số (Digital Twin)** đóng vai trò hạt nhân trong việc tối ưu hóa vận hành các công trình lớn như bệnh viện, trường đại học, nhà máy và tòa nhà văn phòng. Để xây dựng một hệ thống giám sát thời gian thực (ví dụ: hiển thị vị trí cháy, rò rỉ nước, mật độ nhiệt độ, lộ trình thoát hiểm), điều kiện tiên quyết là ban quản lý phải sở hữu một **bản đồ không gian 3D tương tác dạng vector** chạy trực tiếp trên trình duyệt Web.

### **1.2. Nỗi đau của doanh nghiệp (The Real B2B Pain Point)**

- **Sự đứt gãy của chuỗi dữ liệu thiết kế:** Hơn $85\%$ các công trình công cộng xây dựng tại Việt Nam trước năm 2015 đã bị thất lạc file thiết kế gốc do thay đổi đơn vị vận hành, hỏng hóc thiết bị lưu trữ, hoặc đơn vị thiết kế ban đầu đã giải thể.

- **Chi phí dựng hình thủ công (Redraw Overheads):** Khi muốn triển khai IoT, doanh nghiệp phải thuê họa viên kỹ thuật đọc các file scan ảnh/PDF cũ để vẽ lại từ đầu trên các phần mềm như Revit hay SketchUp. Chi phí nhân công ước tính dao động từ $200.000$ đến $500.000\text{ VNĐ}$ cho mỗi mét vuông sàn, tiến độ kéo dài hàng tuần và phụ thuộc hoàn toàn vào độ chính xác của con người.

- **Hạn chế của Generative AI:** Các mô hình AI sinh ảnh hiện tại (như Stable Diffusion, ControlNet) chỉ có khả năng tạo ra một góc nhìn phối cảnh dẹt giả lập 3D (2.5D). Chúng không bóc tách được tọa độ hình học, không hiểu được cấu trúc ranh giới phòng, hoàn toàn vô dụng trong việc lập trình gắn thẻ thiết bị thông minh.

### **1.3. Ràng buộc về dữ liệu đầu vào (Input Constraints)**

Để đảm bảo tính khả thi cơ học và độ chính xác tuyệt đối, đề tài đặt ra giới hạn nghiêm ngặt về dữ liệu đầu vào:

- **Hợp lệ (Phải là bản vẽ kỹ thuật 2D):**

- Ảnh chụp hoặc file scan của bản vẽ mặt bằng kiến trúc (Floor Plan).

- Bản vẽ hoàn công, bản vẽ phòng cháy chữa cháy (PCCC) có đầy đủ vách ngăn, ký hiệu cửa và các đường gióng kích thước.

- Định dạng tệp tin: .png, .jpg, hoặc .pdf.

- **Không hợp lệ:**

- Ảnh chụp không gian thực tế (hiện trạng phòng).

- Ảnh phối cảnh 3D nội thất đã render.

- Bản vẽ Sổ Đỏ thô sơ chỉ có tường bao quanh thửa đất và không phân chia phòng bên trong.

---

## **PHẦN II: KIẾN TRÚC LUỒNG XỬ LÝ (AI HYBRID PIPELINE)**

Hệ thống tập trung tối ưu hóa luồng xử lý AI song song kết hợp các thuật toán xử lý ảnh số chuyên sâu dành cho tệp tin ảnh chụp và PDF scan:

```text
                  [BẢN VẼ 2D ĐẦU VÀO (.png / .jpg / .pdf)]
                                     │
                                     ▼
                          (AI HYBRID PIPELINE)
                                     │
             ┌───────────────────────┼───────────────────────┐
             ▼                       ▼                       ▼
         SegFormer               YOLOv8/v11              PaddleOCR
          (Tường)                (Cửa/Đồ)                 (Số đo)
             │                       │                       │
             ▼                       ▼                       ▼
      [Rút xương &]                  │                 [Tính Scale]
      [Nắn vuông]                    │                 [ Quy đổi  ]
             │                       │                       │
             └───────────────────────┼───────────────────────┘
                                     │
                                     ▼
                          [Spatial JSON Đa Tầng]
                                     │
                                     ▼
                          [Procedural 3D Generator]
                                     │
                                     ▼
                          [Web 3D Interactive Editor]

```

---

## **PHẦN III: ĐẶC TẢ CHI TIẾT LUỒNG XỬ LÝ ẢNH BẰNG AI & TOÁN HỌC**

Quy trình xử lý ảnh thô từ lúc người dùng tải lên cho đến khi xuất ra tọa độ số hóa bao gồm các bước tuần tự và chặt chẽ:

### **Bước 1: Tiền xử lý & Nắn thẳng phối cảnh hình học (Perspective Transform)**

- **Vấn đề thực tế:** Ảnh chụp bản vẽ bằng điện thoại thường bị méo, nghiêng nhẹ, hoặc có góc chụp xiên. Nếu đưa thẳng vào AI, các bức tường thẳng sẽ bị biến dạng thành đường chéo, làm hỏng toàn bộ lưới tọa độ 3D.

- **Cách giải quyết:**

1. **Lọc nhiễu & Tìm biên:** Hệ thống chuyển ảnh về dạng xám (Grayscale), áp dụng bộ lọc **Gaussian Blur** để loại bỏ nhiễu hạt, sau đó chạy thuật toán **Canny Edge Detection** để tìm kiếm các đường biên sắc nét.

2. **Tìm khung giấy bản vẽ:** Sử dụng thuật toán tìm đường bao **Find Contours** của OpenCV. Hệ thống sẽ lọc ra đường bao lồi có diện tích lớn nhất và có đúng 4 góc (biểu thị cho khung viền của tờ giấy hoặc khung tên bản vẽ kỹ thuật).

3. **Chiếu phối cảnh:** Từ tọa độ 4 điểm góc phát hiện được ($P_1, P_2, P_3, P_4$), hệ thống tính toán ma trận chuyển đổi phối cảnh thông qua hàm `cv2.getPerspectiveTransform` và áp dụng hàm `cv2.warpPerspective` để kéo thẳng bức ảnh về góc nhìn trực giao chuẩn $90^\circ$ từ trên xuống (Orthographic View), đưa ảnh về kích thước chuẩn hóa cố định (ví dụ: $3000 \times 3000\text{ px}$).

### **Bước 2: Phân tách thông tin song song bằng cơ chế AI Đa Luồng (Multi-Model Feature Extraction)**

Bức ảnh sau khi nắn thẳng được đưa vào 3 luồng xử lý AI song song trên Backend:

#### **Luồng A: Bóc tách màng tường bằng SegFormer (Semantic Segmentation)**

- **Mô hình áp dụng:** **SegFormer** với backbone **MIT-B3** (hoặc MIT-B5 để đạt độ chính xác cao nhất).

- **Lý do kỹ thuật vượt trội:**

- Tường trong bản vẽ là những đường thẳng song song cực kỳ mảnh và kéo dài liên tục. Các mạng tích chập thông thường (CNN) như U-Net hay YOLO-segment chỉ có trường nhìn cục bộ (local receptive field), nên khi gặp các bức tường chạy quá dài hoặc bị cắt ngang bởi ký hiệu khác, nó rất dễ bị lỗi đứt nét, làm rách tường.

- SegFormer sử dụng cơ chế **Self-Attention** (Tự chú ý) của Transformer, giúp mô hình "nhìn" và hiểu mối quan hệ không gian toàn cục của toàn bộ bản vẽ cùng lúc, đảm bảo nhận diện hệ thống tường bao quanh và tường ngăn phòng chạy liên tục, sắc nét, không bị đứt khúc.

- **Đầu ra:** Một bức ảnh mặt nạ nhị phân (Wall Mask), trong đó các pixel của tường có giá trị là 1 (tương ứng với màu hồng trên hình ảnh trực quan) và các phần còn lại có giá trị là 0 (nền trắng).

#### **Luồng B: Định vị cửa và nội thất bằng YOLOv8/v11 (Object Detection)**

- **Mô hình áp dụng:** **YOLOv8-detect** (hoặc YOLOv11-detect), phiên bản cấu hình **Medium (YOLOv8m)** để cân bằng giữa tốc độ và độ chính xác trên thiết bị biên.

- **Lớp nhãn huấn luyện (Classes):** Mô hình được train để nhận diện các ký hiệu kỹ thuật rời rạc tiêu chuẩn bao gồm: `door` (cửa đi đơn), `double_door` (cửa đi đôi), `window` (cửa sổ), `bed` (giường), `sofa` (ghế sofa), `dining_table` (bàn ăn), `toilet` (bồn cầu), `kitchen_sink` (bồn rửa bếp).

- **Đầu ra:** Danh sách các hộp giới hạn (Bounding Boxes), gồm nhãn vật thể, tọa độ tâm ($x, y$), kích thước hộp ($w, h$), góc xoay ($\theta$) và độ tự tin (Confidence Score).

#### **Luồng C: Đọc kích thước kỹ thuật bằng YOLO-detect + PaddleOCR (Text Spotting)**

- **Vấn đề thực tế:** Bản vẽ kỹ thuật có mật độ chữ số và ký hiệu cực kỳ chằng chịt. Nếu đưa cả bức ảnh lớn vào mô hình OCR, hệ thống sẽ bị rối, nhận diện nhầm các đường kẻ nét đứt, đường gióng thành chữ số, gây sai lệch kích thước nghiêm trọng.

- **Giải pháp RoI-based OCR:**

1. Hệ thống dùng một mô hình YOLO phụ chuyên biệt (được huấn luyện riêng) để phát hiện và khoanh vùng các cụm số kích thước dọc theo các đường gióng (Dim lines) trên bản vẽ.

2. Thực hiện cắt vùng ảnh (Crop Region of Interest - RoI) chứa các chữ số này thành các ảnh nhỏ độc lập.

3. Áp dụng thuật toán nhị phân hóa cục bộ (Otsu's Thresholding) để làm sạch nền của các ảnh nhỏ này, loại bỏ các nét vẽ đường gióng dính kèm.

4. Nạp các ảnh nhỏ đã làm sạch vào **PaddleOCR** để nhận diện văn bản, trích xuất chính xác chuỗi ký tự chữ số (ví dụ: đọc ra chuỗi "4800", "3600").

### **Bước 3: Đo độ dày cục bộ của tường (Local Width Measurement) & Rút xương toán học (Post-Processing)**

Bản vẽ thực tế luôn tồn tại đồng thời các bức tường có độ dày khác nhau (tường bao chịu lực dày $220\text{ mm}$, vách ngăn phòng mỏng $110\text{ mm}$). Để hệ thống không cào bằng độ dày tường khi dựng 3D, quy trình xử lý toán học được thiết kế cực kỳ chi tiết:

#### **3.1. Đo độ dày pixel bằng bản đồ khoảng cách (Distance Transform)**

1. Áp dụng thuật toán **Distance Transform** (`cv2.distanceTransform` với tham số khoảng cách L2 Euclide) lên mặt nạ tường nhị phân (Wall Mask) nhận diện được từ SegFormer.

2. Thuật toán này sẽ tính toán khoảng cách từ **mỗi pixel trắng** (nằm trong tường) tới **pixel đen gần nhất** (ranh giới ngoài của tường).

3. Kết quả trả về là một bản đồ xám, trong đó pixel nằm chính giữa lõi tường sẽ có giá trị độ sáng lớn nhất (biểu thị khoảng cách xa biên nhất). Giá trị khoảng cách tại lõi này chính bằng **một nửa độ dày** của bức tường tại vị trí đó ($W_{pixel} = 2 \times \text{Distance}_{\max}$).

#### **3.2. Rút xương tường (Skeletonization)**

1. Áp dụng thuật toán mỏng hóa **Zhang-Suen** lên mặt nạ tường để rút dải tường dày về đường trung tuyến mảnh đúng 1 pixel (đây là trục xương lõi của tường).

2. Sử dụng thuật toán dò tìm điểm nút để xác định các vị trí ngã ba, ngã tư hoặc góc nhà (Vertices) - nơi đường trung tuyến giao nhau hoặc kết thúc.

3. Áp dụng thuật toán **Douglas-Peucker** để nắn thẳng các đường nét vẽ bị răng cưa, loại bỏ điểm thừa và ép các đường xiên vẹo về các góc vuông góc chuẩn hóa ($0^\circ, 90^\circ$). Hệ thống tường lúc này được lưu trữ dưới dạng danh sách các đoạn thẳng kết nối giữa các điểm nút: $w_1$ nối từ nút $A(x_1, y_1)$ đến nút $B(x_2, y_2)$.

#### **3.3. Ánh xạ độ dày và Chuẩn hóa cơ khí**

1. Hệ thống lấy mẫu các giá trị độ dày tính được từ bản đồ khoảng cách (ở mục 3.1) dọc theo đường trung tuyến mảnh của từng đoạn tường $w_i$.

2. Tính toán giá trị trung vị (Median) của độ dày trên đoạn tường đó để loại bỏ các điểm nhiễu cục bộ.

3. Quy đổi độ dày pixel sang kích thước thật bằng tỷ lệ Scale thực tế (ở Bước 4).

4. **Bộ lọc làm tròn thông minh (Standardization Filter):** Để triệt tiêu hoàn toàn sai số răng cưa của hình ảnh làm tường bị lệch lẻ (ví dụ tính ra $113.5\text{ mm}$ hoặc $218\text{ mm}$), hệ thống áp dụng bộ lọc đối chiếu với tiêu chuẩn xây dựng:

- Nếu kích thước tính toán $\approx 90\text{ mm} - 140\text{ mm} \rightarrow$ Làm tròn về **$110\text{ mm}$** (Tường đơn tiêu chuẩn).

- Nếu kích thước tính toán $\approx 180\text{ mm} - 250\text{ mm} \rightarrow$ Làm tròn về **$220\text{ mm}$** (Tường đôi chịu lực tiêu chuẩn).

- Nếu kích thước tính toán $\ge 300\text{ mm} \rightarrow$ Làm tròn về **$330\text{ mm}$** hoặc gán nhãn Cột chịu lực bê tông cốt thép.

### **Bước 4: Định chuẩn tỷ lệ thực tế ngoài đời (Spatial Calibration)**

Để mô hình 3D khớp chính xác $100\%$ với kích thước công trình ngoài đời thực chứ không phải ước lượng theo pixel ảnh:

1. Hệ thống tìm kiếm các đường gióng kích thước nằm song song với các đoạn tường tương ứng.

2. Đo độ dài pixel của bức tường đó trên ảnh (ví dụ: $L_{pixel} = 400\text{ px}$).

3. Lấy giá trị số đo thực tế mà OCR đọc được trên đường gióng (ví dụ: $L_{real} = 4800\text{ mm}$).

4. Tính toán tỷ lệ quy đổi chuẩn xác cho dự án:

$$\text{Scale Ratio} = \frac{4800\text{ mm}}{400\text{ px}} = 12\text{ mm/pixel}$$

5. Nhân toàn bộ hệ thống tọa độ tường từ SegFormer và đồ đạc từ YOLO với Scale Ratio để đưa toàn bộ dữ liệu từ pixel ảnh về kích thước milimét thực tế.

### **Bước 5: Thiết lập mỏ neo đa tầng và Trích xuất cao độ (Multi-level Alignment)**

Đối với các công trình nhiều tầng, hệ thống tự động đồng bộ hóa không gian theo chiều dọc (trục Z):

1. **Phát hiện lưới trục:** AI quét và nhận diện các ký hiệu lưới trục định vị hình tròn (ví dụ: vòng tròn chứa chữ cái A, B, C hoặc số 1, 2, 3).

2. **Xác định Gốc tọa độ:** Hệ thống tính toán giao điểm của hai trục chuẩn (ví dụ giao của Trục A và Trục 1) trên bản vẽ Tầng 1 và đặt điểm này làm **Gốc tọa độ chung (0, 0, 0)** cho toàn bộ dự án.

3. **Đồng bộ hóa tầng:** Khi người dùng tải lên bản vẽ Tầng 2, hệ thống tìm giao điểm tương ứng của Trục A và Trục 1 trên bản vẽ này, thực hiện phép dịch chuyển tịnh tiến (Translation) toàn bộ tọa độ Tầng 2 sao cho điểm giao trục này trùng khít hoàn hảo với tọa độ Gốc (0, 0, 0) của Tầng 1 theo phương thẳng đứng.

4. **Trích xuất cao độ:** Hệ thống quét bản vẽ mặt đứng kỹ thuật (Elevation Plan) bằng OCR để đọc các thông số cao độ (ví dụ: Tầng 1 cao $3.9\text{ m}$, Tầng 2 cao $3.6\text{ m}$) để thiết lập thông số độ cao tầng tự động cho mô hình 3D.

---

## **PHẦN IV: CẤU TRÚC DỮ LIỆU ĐẦU RA CHUẨN (SPATIAL JSON)**

Mọi kết quả tính toán sau khi được chuẩn hóa kích thước, độ dày và đồng bộ trục tọa độ sẽ được đóng gói thành một file JSON có cấu trúc phân cấp chặt chẽ để gửi lên Frontend:

```json
{
  "project_metadata": {
    "project_name": "Biet_Thu_Moi",
    "scale_ratio_mm_per_px": 12.0,
    "levels": [
      {
        "level_id": "L1",
        "name": "Tầng 1",
        "elevation_m": 0.0,
        "height_m": 3900
      },
      {
        "level_id": "L2",
        "name": "Tầng 2",
        "elevation_m": 3900,
        "height_m": 3600
      }
    ],
    "global_anchor": {
      "axis_intersection": "A-1",
      "x_offset": 450,
      "y_offset": 250
    }
  },
  "geometry": {
    "L1": {
      "vertices": [
        { "id": "v0", "x": 1200, "y": 800 },
        { "id": "v1", "x": 6000, "y": 800 },
        { "id": "v2", "x": 6000, "y": 4800 },
        { "id": "v3", "x": 1200, "y": 4800 }
      ],
      "walls": [
        { "id": "w1", "from": "v0", "to": "v1", "thickness_mm": 220 },
        { "id": "w2", "from": "v1", "to": "v2", "thickness_mm": 220 },
        { "id": "w3", "from": "v2", "to": "v3", "thickness_mm": 110 },
        { "id": "w4", "from": "v3", "to": "v0", "thickness_mm": 220 }
      ],
      "doors": [
        {
          "id": "d1",
          "wall_id": "w1",
          "position_t": 0.35,
          "width_mm": 900,
          "height_mm": 2200,
          "type": "single_swing"
        }
      ],
      "windows": [
        {
          "id": "win1",
          "wall_id": "w2",
          "position_t": 0.5,
          "width_mm": 1200,
          "height_mm": 1500,
          "elevation_m": 900
        }
      ],
      "furniture": [
        {
          "id": "f1",
          "type": "sofa",
          "x": 2400,
          "y": 1500,
          "rotation_deg": 90
        },
        {
          "id": "f2",
          "type": "toilet",
          "x": 5500,
          "y": 4200,
          "rotation_deg": 180
        }
      ],
      "rooms": [
        {
          "id": "r1",
          "label": "Phòng Khách",
          "vertices": ["v0", "v1", "v2", "v3"],
          "area_m2": 19.2
        }
      ]
    }
  }
}
```

---

## **PHẦN V: QUY TRÌNH DỰNG HÌNH PROCEDURAL GENERATION & TRÌNH BIÊN TẬP WEB 3D**

Phân hệ Frontend sử dụng thư viện **Three.js / React Three Fiber** để đọc file JSON và thực hiện quá trình sinh dựng tự động (Procedural Generation):

### **5.1. Dựng hệ tường 3D đa kích thước**

- Đọc mảng `walls` từ JSON. Với mỗi đoạn thẳng kết nối từ nút $v_i \rightarrow v_j$, hệ thống tính toán khoảng cách hình học để làm chiều dài tường.

- Hệ thống tự động sinh một khối hình hộp 3D (BoxGeometry) chạy dọc theo đoạn thẳng đó.

- **Tham số hóa độ rộng và cao:** Chiều rộng khối hộp được thiết lập chính xác bằng tham số `thickness_mm` của bức tường đó (quy đổi ra mét, ví dụ: $0.22\text{ m}$ hoặc $0.11\text{ m}$), chiều cao được kéo lên theo thông số `height_m` của tầng tương ứng (ví dụ: $3.9\text{ m}$).

### **5.2. Khoét lỗ cửa bằng toán học (CSG - Constructive Solid Geometry)**

- Đọc vị trí cửa từ JSON (ví dụ cửa `d1` nằm trên tường `w1` tại vị trí tỉ lệ `position_t`: 0.35).

- Hệ thống tính toán tọa độ $XYZ$ thực tế của cánh cửa trên tường 3D.

- Sinh một khối hộp tạm thời có kích thước bằng chiều rộng (`width_mm`) và chiều cao (`height_mm`) của cửa.

- Áp dụng phép toán trừ khối không gian (CSG subtraction) để đục một ô trống hình chữ nhật hoàn hảo xuyên qua mảng tường 3D, sau đó nạp mô hình 3D cửa sổ/cửa đi có sẵn từ thư viện lắp khít vào lỗ rỗng này.

### **5.3. Thả đồ đạc từ thư viện mẫu (Asset Library)**

- Hệ thống tích hợp một thư viện mô hình 3D định dạng `.glb` tối giản, siêu nhẹ (mỗi file chỉ khoảng 100 - 300 KB để tối ưu hóa tốc độ tải trang trên Web).

- Dựa vào nhãn loại đồ đạc, tọa độ ($x, y$) và góc xoay (`rotation_deg`) trong JSON, hệ thống tự động nhân bản (clone) mô hình mẫu tương ứng và đặt chuẩn xác vào phòng 3D, nâng độ cao Z theo cao độ sàn của tầng đó.

### **5.4. Trình biên tập trực quan (3D Web Editor)**

- **Interactive Gizmos (Bộ điều hướng):** Khi người dùng click chuột vào một bức tường hoặc một món đồ nội thất, hệ thống sẽ hiển thị các mũi tên điều hướng (Gizmos) cho phép họ kéo thả chuột để:

- Di chuyển vị trí của đồ đạc dọc theo mặt sàn ($X, Y$).

- Xoay hướng đồ đạc quanh trục đứng $Z$.

- Kéo giãn độ dài hoặc di chuyển các điểm nút (Vertices) để thay đổi kích thước phòng thời gian thực, hệ thống tường 3D sẽ tự động co giãn và tính toán lại diện tích phòng ngay lập tức.

---

## **PHẦN VI: KHẮC PHỤC SAI SỐ BẰNG LUẬT RÀNG BUỘC NGỮ CẢNH (SPATIAL RULES)**

Để giải quyết triệt để các lỗi nhận diện nhầm của AI do ký hiệu bản vẽ tương đồng (như ví dụ chiếc ô tô trong gara bị nhận nhầm thành chiếc giường đôi do cả hai cùng là hình chữ nhật bo góc), hệ thống áp dụng các **Luật ràng buộc không gian (Spatial Context Rules)** ở bước hậu xử lý:

### **1. Luật ràng buộc theo nhãn phòng (Room-label Constraints)**

- **Cách hoạt động:** Hệ thống chạy OCR để đọc các nhãn chữ tên phòng trên bản vẽ (ví dụ tìm các chuỗi chữ: "GARA", "WC-1", "PHÒNG NGỦ", "PHÒNG KHÁCH").

- **Luật lọc đồ đạc:**

- _Luật Gara:_ Nếu một vật thể có nhãn nhận diện ban đầu là `BED` (Giường) hoặc `SOFA` nhưng nằm hoàn toàn bên trong ranh giới đa giác của phòng có nhãn "GARA", hệ thống tự động ghi đè và chuyển đổi vật thể đó thành mô hình mẫu `CAR` (Ô tô).

- _Luật WC:_ Nếu vật thể nhận diện là `BED` hoặc `SOFA` nằm trong phòng có nhãn "WC", hệ thống sẽ tự động lọc bỏ (loại bỏ lỗi nhận diện nhầm do các nét vẽ bệ đá, hộp kỹ thuật gây ra).

### **2. Luật ràng buộc tiếp giáp (Adjacency Constraints)**

- **Luật định vị thiết bị vệ sinh:** Các vật thể có nhãn `toilet` (bồn cầu) hoặc `kitchen_sink` (bồn rửa) bắt buộc phải được tịnh tiến sát vào bức tường gần nhất (khoảng cách tối đa $50\text{ mm}$ từ lưng thiết bị đến tường), đầu lưng thiết bị phải tựa thẳng vào mặt tường để tránh hiện tượng thiết bị bị đặt lơ lửng giữa phòng do AI nhận diện lệch tâm vài pixel.

### **3. Luật ràng buộc cửa sổ (Window Wall Placement)**

- Cửa sổ (`WINDOW`) chỉ được phép xuất hiện bám dọc trên các bức tường được xác định là **Tường bao ngoài cùng** của tòa nhà (tường tiếp giáp với không gian bên ngoài). Hệ thống sẽ tự động báo lỗi hoặc loại bỏ các cửa sổ bị AI nhận diện nhầm nằm trên các vách ngăn phòng nội bộ ở lõi nhà.

---

## **PHẦN VII: KẾ HOẠCH TRIỂN KHAI HOÀN CHỈNH (4 THÁNG)**

| Thời gian   | Giai đoạn                                | Nội dung kỹ thuật chi tiết                                             | Kết quả bàn giao (Deliverables) |
| ----------- | ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| **Tháng 1** | **Xử lý Dữ liệu & Huấn luyện SegFormer** | - Thu thập bộ dữ liệu bản vẽ kỹ thuật (từ các nguồn mở như RPlan).<br> |

<br>- Gắn nhãn mặt nạ tường bằng công cụ CVAT.<br>

<br>- Huấn luyện mô hình SegFormer (MIT-B3) bóc tách lớp tường sạch.

| - Mô hình SegFormer đạt độ chính xác IoU $> 90\%$ khi phân đoạn tường.

<br>

<br>- Bộ dữ liệu huấn luyện đã tiền xử lý.

|
| **Tháng 2** | **Huấn luyện YOLO, PaddleOCR & Logic Toán học** | - Huấn luyện YOLOv8-detect nhận diện cửa, đồ nội thất và cụm số đo.

<br>

<br>- Tích hợp PaddleOCR cho các vùng ảnh chứa số đã cắt (RoI).

<br>

<br>- Lập trình thuật toán rút xương tường và tính tỷ lệ co giãn (Scale Ratio) chuẩn xác.

| - API hoàn chỉnh viết bằng FastAPI nhận ảnh chụp đầu vào, trả về cấu trúc file Spatial JSON đa tầng chuẩn hóa kích thước thật.

|
| **Tháng 3** | **Phát triển Web 3D Editor** | - Xây dựng giao diện Frontend bằng React và Tailwind CSS.

<br>

<br>- Lập trình phân hệ đồ họa Three.js đọc dữ liệu JSON để tự động dựng các khối tường, khoét lỗ cửa và thả đồ nội thất mẫu.

<br>

<br>- Viết công cụ kéo thả sửa đồ đạc và xoay góc nhìn 3D.

| - Ứng dụng Web hoàn chỉnh hiển thị mô hình 3D trực quan, hỗ trợ tương tác chỉnh sửa thời gian thực ngay trên trình duyệt.

|
| **Tháng 4** | **Kiểm thử, Đánh giá & Hoàn thiện Báo cáo** | - Đo lường sai số khoảng cách giữa mô hình 3D và bản vẽ gốc.

<br>

<br>- Tối ưu hóa hiệu năng render 3D (giảm số lượng đa giác Polygon) để hệ thống chạy mượt trên các máy tính cấu hình yếu.

<br>

<br>- Viết báo cáo tốt nghiệp.

| - Hệ thống hoàn chỉnh chạy ổn định.

<br>

<br>- Quyển báo cáo Capstone chi tiết và Slide thuyết trình bảo vệ trước hội đồng.

|
