# IG Shop Assistant

Extension Chrome hỗ trợ tư vấn Instagram: đọc lịch sử và soạn câu trả lời theo ngôn ngữ khách, nút Copy. Bạn tự dán và gửi. Từ bản 0.2 không dịch lịch sử hoặc đề xuất; câu hỏi cho chủ shop vẫn bằng tiếng Việt.

## Cài và chạy trên Windows / Multilogin

1. Cần Node.js **22.12+**, AGY CLI đã đăng nhập. `agy models` phải trả danh sách model.
2. Chạy **START.cmd** trong thư mục này; giữ cửa sổ mở. Lần đầu sẽ cài thư viện và build.
3. Trong **đúng profile Multilogin**, mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** → thư mục `dist/extension`.
4. Mở/tải lại tab Instagram. Dán dòng **SERVER: https://…trycloudflare.com** từ START.cmd vào ô **Địa chỉ server**, rồi nhập mã ghép cặp.
5. Trong **Cài đặt**, nhập context, URL HTTPS của shop, chọn model rồi **Lưu cài đặt**.
6. Chọn cuộc trò chuyện. Sau khoảng 2 giây tool bắt đầu soạn. Bấm **Copy**, tự dán và gửi.

Không cần CDP hoặc khởi động profile bằng API. Extension phải được cài vào chính profile đang dùng Instagram. Nếu bảng bị thu gọn, bấm nút Trợ lý IG hoặc biểu tượng extension.

## Server qua Cloudflare Tunnel

START.cmd tự tải cloudflared Windows 64-bit từ GitHub chính thức vào `.local/bin`, mở bridge và Quick Tunnel. Có thể đặt `CLOUDFLARED_PATH` tới file exe sẵn có. Giữ cửa sổ mở; Ctrl+C dừng các tiến trình do launcher tạo. Nếu bridge đã chạy thì dùng lại, mã ghép cặp nằm ở cửa sổ bridge cũ.

Quick Tunnel không cần tài khoản/domain, URL đổi mỗi lần khởi động và không có cam kết uptime. Dán URL mới rồi ghép cặp lại. AGY và SQLite vẫn trên máy, nội dung trao đổi đi qua Cloudflare. API dữ liệu vẫn yêu cầu token. Với domain cố định, nhập URL HTTPS của tunnel riêng và cấu hình origin Host header là `127.0.0.1:43127`.

Extension có quyền HTTPS để kết nối server bạn nhập. Đổi server trong Cài đặt → Đổi server / Ghép cặp lại; token cũ không gửi tới server mới. Local vẫn dùng `http://127.0.0.1:43127`. Khi cập nhật extension, bấm Reload trong chrome://extensions rồi tải lại Instagram; chấp nhận quyền host mới nếu trình duyệt yêu cầu.

Tài liệu: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Cách dùng

- **Hội thoại:** các tin gốc đã tải. Nếu chưa xác định người gửi, tải lại tab hoặc xác nhận Bạn/Khách thủ công.
- **Đề xuất:** bản nháp chỉnh được, nguồn website, câu hỏi cần chủ shop bổ sung. Khi có tin mới trong lúc bạn sửa, bản nháp được giữ nhưng Copy bị khóa cho đến khi soạn lại.
- **Tạm dừng:** ngừng sinh tự động và hủy tác vụ hiện tại. Có thể chủ động bấm Soạn lại.
- **Cài đặt:** nhập/nạp TXT, MD, CSV UTF-8 (150 KB), sửa kiến thức, chọn ngôn ngữ và model. Có lịch sử context và danh sách kiến thức tự học để xóa/sửa.
- Context và website mâu thuẫn: AI phải hỏi chủ shop. Câu trả lời chung được lưu thành kiến thức shop; thông tin riêng/không rõ phạm vi chỉ giữ theo khách.
- Ảnh đã kiểm chứng với ảnh PNG tổng hợp: AGY đọc qua file tạm, hook chỉ cho đọc đúng file được đính kèm. Tin ảnh thực trên Instagram vẫn cần kiểm thử CDN/định dạng.
- **Voice chưa được hỗ trợ tự động bởi AGY CLI headless đang cài** (`stream-json` chỉ nhận text). Điền **Mô tả media** dưới tin rồi bấm Soạn lại. Chỉ AGY xử lý AI, không có dịch vụ nhận dạng thay thế. Đây là phần chưa đạt nghiệm thu đầy đủ của kế hoạch.

## Dữ liệu và vận hành

Từ bản 0.3, khi cần recommend sản phẩm, AI hỏi chủ shop chọn sản phẩm. Trong tab Đề xuất, dán tối đa 6 link HTTPS vào ô **Sản phẩm bạn chọn để giới thiệu**, mỗi dòng một link, rồi bấm **Đọc link & soạn tin nhắn**. Tool đọc song song các trang và tổng hợp thành một tin nhắn theo ngôn ngữ khách, có link sản phẩm. Có thể nhập link trước khi AI hỏi. Lựa chọn chỉ nằm trong cuộc trò chuyện đang mở, được xóa khi đổi khách và không lưu thành kiến thức chung của shop.

Luồng recommend không tự tìm hoặc lọc sản phẩm nữa. Mỗi lần soạn từ link sẽ đọc lại giá; link lỗi khiến tool hỏi sửa/bỏ link, không tự đoán. Chỉ đọc trang HTML HTTPS công khai, chặn IP nội bộ, không dùng cookie IG và không chạy JavaScript trên trang sản phẩm. Link cần đăng nhập hoặc chỉ có nội dung sau JavaScript có thể cần bạn bổ sung thông tin. Giá/tiền tệ/biến thể được đưa vào nguồn để AI đối chiếu. Phần tra chính sách shop vẫn có thể đọc website cấu hình khi thiếu context. Mã browser cũ được giữ để kiểm thử, không được engine gọi trong luồng recommend mới.

Bảng trợ lý nằm trong iframe bên trong Shadow DOM để tách sự kiện bàn phím khỏi Instagram, giữ hoạt động nhập tiếng Việt và React.

Bridge chỉ nghe `127.0.0.1:43127`; token nằm trong storage của extension. Mã ghép cặp thay mỗi lần khởi động, token đã ghép vẫn dùng được. Chỉ ghép profile bạn quản lý.

SQLite nằm tại `.local/assistant.sqlite`; chứa context và dữ liệu chat. Cache/hội thoại dọn sau 30 ngày; kiến thức chung giữ đến khi xóa. Dùng nút **Xóa dữ liệu tool** để xóa dữ liệu ứng dụng. **AGY tự quản lý lịch sử/log riêng**, nút này không xóa lịch sử của AGY.

AGY nhận nội dung chat/context để suy luận qua tài khoản model của bạn. Mỗi lần xử lý là phiên độc lập với lịch sử đúng khách từ SQLite, tránh tiếp tục nhầm phiên; cache của tool giảm các lần xử lý lặp. Không dùng `--continue` toàn cục.

Mỗi phiên AGY có workspace tạm và hook `PreToolUse` chặn công cụ; chỉ cho kết thúc câu trả lời và đọc đúng file ảnh được đính kèm. Website được bridge đọc trong phạm vi domain cấu hình, có kiểm tra IP và chuyển hướng. Media chỉ tải từ CDN Instagram/Facebook công khai; không sử dụng cookie từ HAR. Extension chỉ quan sát bản sao response sẵn có, không gọi API gửi tin.

Dừng bằng Ctrl+C trong cửa sổ bridge. Có thể đặt `AGY_PATH` nếu agy không nằm trong PATH; `IG_ASSISTANT_DATA` để đổi thư mục dữ liệu. Không chạy nhiều bridge cùng cổng.

## Kiểm tra dành cho lập trình viên

```powershell
npm.cmd ci
npx.cmd playwright install chromium --only-shell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run probe:agy
```

Probe tiêu thụ lượt gọi model; chỉ dùng dữ liệu tổng hợp. Có thể thêm `-- --image=path.png --audio=path.wav`. Báo cáo nằm tại `.local/agy-probe.json`, không đóng gói vào extension.

## Giới hạn cần kiểm thử trên tài khoản thật

- DOM/HAR hiện có chỉ chứng minh mẫu chat văn bản ngắn. Không coi chuyển khách, ảnh/voice thực, cuộn dài và các kiểu tin Instagram khác là đã nghiệm thu chỉ nhờ fixture.
- Nếu metadata mới không khớp DOM (ví dụ tin đi qua kênh realtime chưa được đọc), tool tạm dừng để tránh đảo người gửi; tải lại tab hoặc xác nhận thủ công.
- DOM dự phòng không có ID thật, nên chỉ dùng snapshot hiện tại, không cộng dồn vào lịch sử lâu dài.
- Không tự cuộn để tải lịch sử; không mở ảnh một lần xem. Media hết hạn hoặc cần đăng nhập sẽ yêu cầu mô tả thủ công.
- Website yêu cầu đăng nhập, CAPTCHA hoặc POST để tìm kiếm có thể không dùng được trong browser chỉ đọc. Khi tra không đủ, tool hỏi chủ shop.

## Tài liệu đối chiếu

- [Chrome content scripts và isolated worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [AGY lifecycle hooks và PreToolUse](https://www.antigravity.google/docs/hooks)
- `agy --help` và `agy models` của bản CLI cài trên máy.

File HAR/DOM gốc nằm ngoài gói build, bị loại khỏi Git và không dùng làm dữ liệu mặc định.
