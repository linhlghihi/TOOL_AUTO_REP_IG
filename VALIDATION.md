# Kết quả kiểm tra — 21/10/2026

## Bản 0.3 — chủ shop chọn link sản phẩm

- Engine không gọi browser tự tìm/lọc sản phẩm trong luồng recommend. AI yêu cầu `needsProductLinks`; giao diện có ô nhập tối đa 6 link và nút đọc/tổng hợp.
- 22 tests qua, gồm link sai/ngoài giao thức/IP nội bộ, giữ metadata giá/tiền tệ, hỏi chủ shop trước khi recommend, đọc các link trước một lần tổng hợp, không lưu lựa chọn thành shop facts, không dùng reply cache cũ cho giá sản phẩm, chặn bản nháp nếu một link lỗi.
- TypeScript và build qua. Test focus iframe vẫn qua; chưa thử bản 0.3 trực tiếp trên tài khoản IG người dùng.
- AGY thật `gemini-3.8-flash-low`: lần đầu hỏi chủ shop chọn sản phẩm, lần tiếp theo đọc hai link Wrydeco công khai và tổng hợp một bản nháp chứa đủ hai link. Kết quả tại `.local/products-smoke-result.json`; không dùng hội thoại khách thật.

## Bản 0.2 — chỉ soạn câu trả lời, lọc sản phẩm, tách focus

- TypeScript/build và 17 tests qua: thêm schema không còn dịch, không gọi AI khi tin cuối là của shop, kiểm tra input React trong iframe trước handler trang cha cố giành focus, thao tác lọc/sắp xếp/phân trang trên fixture và kiểm tra token khi đổi server.
- AGY thật với context tổng hợp: trả đúng giá 49 USD, JSON chỉ có câu trả lời và metadata, không có translations/replyVi. Cache dùng namespace mới để không dùng lại kết quả dịch cũ.
- AGY `gemini-3.8-flash-low` duyệt Wrydeco thật: `/collections/all` → `?filter.p.t.category=fr-24-1-1` → thêm `sort_by=price-ascending` → `/products/handcrafted-live-edge-root-wood-coffee-table`. Hoàn thành khoảng 41.3 giây cho riêng lượt duyệt; không phải benchmark thời gian soạn trả lời cuối cùng. Báo cáo tại `.local/web-smoke-result.json`.
- Browser riêng, không có phiên IG; điều khiển theo DOM quan sát được, chỉ GET qua bộ kiểm tra IP và scope, chặn WebSocket/Service Worker, không giỏ hàng hoặc gửi form. Không cam kết mọi bộ lọc trên mọi website: tiền tệ/locale, CAPTCHA, đăng nhập và API POST có thể giới hạn kết quả.
- Test focus dùng Chromium thật và website giả lập có handler capture; chưa xác nhận trực tiếp bản 0.2 trong profile Instagram của người dùng. Reload extension và tải lại tab để nhận iframe mới.
- Kiến thức shop được giữ nguyên. Cần dừng bridge cũ rồi chạy lại START.cmd để server nạp code mới; URL Quick Tunnel mới cần nhập lại trong extension.

## Kết quả lịch sử của bản 0.1 (trước khi bỏ dịch)

## Đã kiểm chứng

- `npm run check`: TypeScript không lỗi.
- `npm test`: 12 test qua; bao gồm phân biệt IG ID/FBID, DOM dự phòng, hiệu chỉnh hướng tin realtime bằng hai phía đã biết, chống trùng/sửa/thu hồi, cache tách khách, hủy tác vụ cũ, chặn đề xuất khi media chưa đọc được, giới hạn mạng và xác thực bridge.
- `npm run build`: tạo `dist/extension` và `dist/bridge`.
- DOM/HAR gốc: bộ đọc triển khai nhận đúng 2 tin, tìm được 2 snapshot mạng khớp nội dung và xác nhận thứ tự người gửi khách/bạn. Không đóng gói nội dung gốc.
- AGY thật, model `gemini-3.8-flash-high`: dịch câu hỏi giá của dữ liệu tổng hợp, trả lời đúng 49 USD từ context thử, kèm bản dịch Việt và JSON hợp lệ.
- Ảnh PNG tổng hợp: AGY đọc file ảnh được phép và nhận đúng nền xanh lá không có vật thể.
- Hook giới hạn công cụ: yêu cầu thử ghi file canary bị từ chối; file không được tạo.
- Website công khai `https://example.com`: lấy được tiêu đề, nội dung và URL nguồn qua bộ đọc có kiểm tra IP/chuyển hướng.
- Giao diện trên fixture cục bộ trong Chrome: hiển thị hội thoại/bản dịch/đề xuất; sau khi sửa bản nháp rồi thêm tin khách, bản nháp còn nguyên và Copy bị khóa. Không sử dụng tài khoản Instagram thật trong thử nghiệm này.

## Chưa nghiệm thu / giới hạn xác nhận

- AGY CLI headless từ chối content block `audio` và `image` trong `stream-json` (chỉ nhận text). Ảnh được xử lý qua file đọc có giới hạn; **voice chưa có đường xử lý tự động được kiểm chứng**, ứng dụng yêu cầu nhập mô tả thủ công và chặn đề xuất phụ thuộc voice.
- Chưa cài/chạy extension trong profile Multilogin thật. Cần kiểm tra đổi khách, tin realtime, lịch sử dài, ảnh CDN và các kiểu tin đặc biệt.
- Chưa có URL/context shop thật. Việc đọc website đã thử về mặt kỹ thuật, chưa xác minh tư vấn chính xác trên dữ liệu kinh doanh của shop.
- Nếu DOM và metadata không khớp hoặc không hiệu chỉnh được hai phía gửi, tool yêu cầu tải lại/xác nhận người gửi; không tự đoán.
- CLI AGY có lịch sử riêng bên ngoài SQLite. Xóa dữ liệu ứng dụng không xóa lịch sử CLI.

## Kiểm thử tiếp sau khi cài vào profile

1. Nhập context thật và website, xác nhận model trong danh sách.
2. Mở chat có cả tin bạn/khách; đối chiếu bản dịch và người gửi.
3. Chuyển chat trong lúc đang soạn; kết quả cũ phải biến mất.
4. Chỉnh bản nháp, nhận tin mới: nội dung chỉnh phải còn và Copy phải bị khóa.
5. Cuộn tải tin cũ bằng tay; kiểm tra thứ tự và chống trùng.
6. Thử ảnh thường, voice, tin thu hồi và hỏi giá thiếu dữ liệu; trường hợp chưa đọc được phải hỏi bằng tiếng Việt.
7. Kiểm tra câu trả lời bổ sung chung được lưu cho shop; chi tiết riêng khách không xuất hiện ở chat khác.
8. Dán/gửi thủ công; kiểm tra extension không tự nhập hoặc gửi.
