# Cài IG Shop Assistant bằng agent

Hướng dẫn cho **Windows 10/11 x64**, Chrome hoặc profile Multilogin chạy Mimic/Chromium. Tool đọc cuộc trò chuyện Instagram đang mở, dùng AGY CLI soạn câu trả lời và tìm sản phẩm trên website khi cần. Người dùng tự Copy → dán → gửi. Bản hiện tại không dịch tin nhắn; câu hỏi cho chủ shop vẫn bằng tiếng Việt.

## Người nhận bắt đầu ở đây

Giải nén **toàn bộ mã nguồn tool** vào một thư mục cố định. Mở thư mục đó bằng agent có quyền chạy terminal và cài phần mềm, rồi gửi:

> Đọc how_to_setup.md trong thư mục này và thực hiện phần dành cho agent. Tự kiểm tra, cài các thành phần còn thiếu, build và kiểm tra tool. Sau đó hướng dẫn tôi đăng nhập AGY nếu cần, chạy START.cmd và load extension vào đúng trình duyệt/profile tôi dùng Instagram. Dùng đường dẫn thực tế trên máy này. Không tự gửi tin nhắn Instagram.

File hướng dẫn này không chứa mã nguồn. Nếu chỉ nhận được một file Markdown, hãy lấy thêm bộ mã nguồn từ người gửi trước.

## Phần dành cho agent: hãy thực hiện, không chỉ đưa kế hoạch

Thực hiện lần lượt các bước dưới đây trong phạm vi quyền người dùng đã cấp. Tự xử lý việc cài dependency, build và lỗi cấu hình thông thường. Chỉ nhờ người dùng ở những bước cần tương tác thật: đăng nhập tài khoản, UAC/quyền hệ thống hoặc thao tác trình duyệt mà bạn không điều khiển được. Tiếp tục làm những bước độc lập trong lúc chờ đăng nhập.

Giữ nguyên dữ liệu shop, tài khoản, proxy và profile hiện có. Không tự xóa `.local`, đổi model/provider sang dịch vụ khác, gửi tin IG hay sửa tính năng sản phẩm để né lỗi cài đặt. Không đọc HAR, cookie, database chat hoặc thông tin đăng nhập để làm bài kiểm tra cài đặt.

### 1. Xác định thư mục và môi trường

- Lấy thư mục chứa file này làm thư mục dự án; không dùng đường dẫn máy của người gửi.
- Kiểm tra có `package.json`, `package-lock.json`, `START.cmd`, `tsconfig.json`, `src/`, `scripts/`, `tests/`.
- Nếu thiếu mã nguồn, báo chính xác file/thư mục cần người gửi bổ sung. Không tự tạo ứng dụng thay thế.
- Chạy PowerShell trong thư mục dự án. Kiểm tra OS/kiến trúc; bản launcher hiện tải cloudflared Windows x64. macOS/Linux/ARM cần chỉnh riêng, không báo đã cài thành công bằng quy trình này.

```powershell
Get-Location
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
Get-Command node, npm.cmd, agy, winget -ErrorAction SilentlyContinue |
    Select-Object Name, Source
```

Ưu tiên đường dẫn thư mục đơn giản, tránh ký tự `"`, `%` hoặc xuống dòng vì hook AGY có giới hạn đường dẫn. Không tự di chuyển thư mục đang được người dùng sử dụng.

### 2. Node.js và npm

Tool yêu cầu **Node.js >= 22.12.0**; dùng bản LTS được hỗ trợ đáp ứng yêu cầu. Nếu bản đang có đáp ứng và chạy được SQLite thì giữ nguyên.

```powershell
node --version
npm.cmd --version
node --experimental-sqlite -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(':memory:'); db.close(); console.log('SQLite OK');"
```

Nếu chưa có hoặc quá cũ, cài Node LTS bằng WinGet:

```powershell
winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
```

Nếu đã có gói Node LTS nhưng cần nâng cấp, dùng `winget upgrade` với cùng package ID. Kiểm tra mã thoát và phiên bản sau cài; không gỡ các bản Node khác một cách mù quáng. Khi cần quyền quản trị, nhờ người dùng hoàn tất UAC.

Nếu không có WinGet, tải bộ cài Windows x64 từ [nodejs.org](https://nodejs.org/en/download). Có thể dùng bản ZIP chính thức trong thư mục riêng của người dùng nếu không có quyền cài toàn máy; kiểm tra checksum do Node công bố và thêm đúng thư mục chứa `node.exe` vào User PATH, giữ các mục PATH cũ. Đảm bảo START.cmd mở từ Explorer cũng tìm thấy Node, không chỉ terminal hiện tại.

Sau khi cài, mở terminal mới hoặc nạp lại PATH rồi kiểm tra lại:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
node --version
npm.cmd --version
```

Dùng `npm.cmd` và `npx.cmd` trong PowerShell để tránh lỗi chặn `npm.ps1`; không cần tắt Execution Policy toàn hệ thống.

### 3. AGY CLI và đăng nhập

Cần **Antigravity CLI với lệnh `agy`**, không chỉ ứng dụng IDE có lệnh `antigravity`.

```powershell
agy --help
agy models
```

CLI phải có các cờ `--print`, `--input-format`, `--output-format`, `--json-schema`, `--model`, `--sandbox`, `--disable-slash-commands`. Nếu thiếu, đối chiếu bản hiện tại với tài liệu chính thức và cập nhật CLI.

Nếu chưa cài, dùng installer PowerShell chính thức theo [AGY Quickstart](https://antigravity.google/docs/getting-started?tab=cli):

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

Sau đó nạp lại PATH và kiểm tra. Binary thường nằm ở `%LOCALAPPDATA%\agy\bin\agy.exe`. Nếu installer đã tạo file nhưng terminal chưa nhận `agy`, xác minh file đó, bổ sung thư mục vào User PATH nếu còn thiếu, giữ nguyên các mục cũ. Đường dẫn khác có thể cấu hình bằng biến `AGY_PATH` trỏ tới **file exe**, không trỏ tới thư mục hay file `.cmd`.

Nếu chưa đăng nhập, hướng dẫn người dùng mở terminal và chạy:

```powershell
agy
```

Người dùng tự hoàn tất thiết lập ban đầu và đăng nhập trong trình duyệt. Không hỏi mật khẩu/token trong chat. Sau đăng nhập, thoát phiên tương tác rồi chạy lại `agy models`. Danh sách model chưa đủ để chứng minh inference hoạt động; chỉ báo đăng nhập/model đã sẵn sàng theo kiểm tra thực tế. Không tự chạy smoke/probe gọi AI trong bước cài mặc định vì có thể dùng quota. Có thể thử một yêu cầu tổng hợp khi người dùng muốn kiểm tra AI.

### 4. Cài dependency, Chromium và build

Chạy **từng lệnh**, kiểm tra exit code trước khi tiếp tục:

```powershell
npm.cmd ci
npx.cmd playwright install chromium --only-shell
npm.cmd run check
npm.cmd test
npm.cmd run build
```

`npm ci` dùng lockfile; không thay bằng cập nhật hàng loạt package. Chromium ở đây phục vụ AI tìm sản phẩm, không thay đổi profile Instagram của người dùng. Không cần cài Python, Docker, ChromeDriver, SQLite server hay API key AI khác.

Nếu test HTTP báo trùng cổng, kiểm tra tiến trình dùng `43128`; không tự tắt mọi tiến trình Node. Test browser cần Chromium được cài ở đúng tài khoản Windows chạy tool.

Kiểm tra build có:

```text
dist/
  bridge/main.js
  extension/
    manifest.json
    background.js
    content.js
    observer.js
```

### 5. Khởi động bridge và Cloudflare Tunnel

Trong thư mục dự án:

```powershell
.\START.cmd
```

Hoặc người dùng nhấp đúp `START.cmd` trong Explorer. Agent có thể chạy thử bằng terminal mình quản lý, nhưng phải nói rõ tiến trình đó có tiếp tục sống sau phiên agent hay không; không báo server đang chạy nếu đã dừng. Cách dùng hằng ngày là người dùng mở START.cmd và giữ cửa sổ đó.

START.cmd build tool, đảm bảo Chromium có sẵn, rồi chạy `scripts/start.mjs`. Launcher tự tải **cloudflared chính thức** vào `.local/bin/cloudflared.exe` nếu thiếu và mở Quick Tunnel. Không cần tài khoản Cloudflare, tên miền hay mở port router. Không cần cài package npm tên cloudflared.

Cửa sổ cần hiển thị hai thông tin thật của lần chạy hiện tại:

```text
Mã ghép cặp: <mã của bridge>
SERVER: https://<tên-ngẫu-nhiên>.trycloudflare.com
```

Giữ cửa sổ mở. Ctrl+C dừng tunnel và bridge do launcher tạo. Nếu launcher dùng lại bridge đã chạy, bridge đó vẫn thuộc cửa sổ cũ, và mã ghép cặp nằm ở cửa sổ cũ. Khi nâng cấp code, phải dừng bridge cũ trước để tránh launcher dùng lại phiên bản cũ.

Agent kiểm tra:

```powershell
Invoke-RestMethod 'http://127.0.0.1:43127/health'
```

Kết quả cần có `ok: true`. Sau khi tunnel kết nối, kiểm tra thêm `<URL SERVER thực tế>/health` bằng request có timeout. Dòng URL xuất hiện chưa chứng minh tunnel đã sẵn sàng; chờ kết nối rồi thử lại trong thời gian giới hạn. Nếu gặp lỗi, đọc log và báo nguyên nhân, không tự đổi proxy của profile.

Nếu đã có cloudflared riêng, có thể đặt `CLOUDFLARED_PATH` tới file `.exe` trước khi chạy START. Biến chỉ đặt trong terminal có hiệu lực cho tiến trình con trong terminal đó; muốn nhấp đúp START từ Explorer thì cần cấu hình User environment tương ứng hoặc dùng đường dẫn mặc định.

### 6. Hướng dẫn người dùng load extension

Đưa ra **đường dẫn tuyệt đối thật** tới `dist\extension` trên máy người dùng.

1. Mở đúng Chrome/profile Multilogin đang dùng Instagram. Với Multilogin, mở profile rồi thao tác bên trong cửa sổ của profile đó.
2. Nhập `chrome://extensions` vào thanh địa chỉ.
3. Bật **Developer mode / Chế độ dành cho nhà phát triển**.
4. Chọn **Load unpacked / Tải tiện ích đã giải nén**.
5. Chọn thư mục **`dist\extension`**, không chọn thư mục dự án, `src\extension` hoặc file ZIP.
6. Kiểm tra có **IG Shop Assistant** và bật extension. Nếu trình duyệt yêu cầu xác nhận quyền truy cập host khi cập nhật, người dùng hoàn tất bước đó.
7. Mở `https://www.instagram.com/direct/inbox/` hoặc tải lại tab Instagram đã mở.

Không cần kết nối CDP hoặc bật automation API của Multilogin. Nếu trình duyệt bị chính sách quản trị chặn Load unpacked, cần người quản trị cho phép; không sửa chính sách máy để lách chặn.

### 7. Ghép cặp và nhập kiến thức shop

1. Trong bảng trợ lý IG, nhập **Địa chỉ server** là URL HTTPS in sau `SERVER:`. Không thêm `/health` hay đường dẫn khác.
2. Nhập **mã ghép cặp của bridge đang chạy** → bấm **Kết nối**.
3. Mở **Cài đặt**, nhập website shop HTTPS và kiến thức shop: sản phẩm, giá/tiền tệ, size, vận chuyển, đổi trả, giọng tư vấn. Có thể nạp `.txt`, `.md`, `.csv`.
4. Chọn model có trong danh sách AGY trên máy rồi **Lưu cài đặt**. Không mặc định mọi tài khoản có cùng model; nếu model mặc định không tồn tại, chọn một model được liệt kê.
5. Mở một cuộc trò chuyện, đối chiếu người gửi và nội dung trước khi dùng đề xuất. Nếu chưa xác định được người gửi, tải lại hoặc xác nhận Bạn/Khách trong bảng.
6. Đọc bản nháp → **Copy** → tự dán và gửi. Tool không gửi hộ.

Nếu người nhận cũng vận hành Wrydeco, URL danh mục đã được thử là `https://wrydeco.com/collections/all`. Với shop khác, dùng website của người nhận; không sao chép kiến thức, giá hoặc tài khoản của người gửi.

Multilogin nên dùng URL HTTPS của tunnel để tránh vấn đề proxy/port local. Chrome thường có thể dùng `http://127.0.0.1:43127` khi extension và bridge ở cùng máy. Không cần chỉnh Port scan protection khi dùng tunnel.

### 8. Báo cáo bàn giao của agent

Khi xong, trả lời ngắn gọn bằng tiếng Việt, ghi rõ:

- Đã cài/tìm thấy Node, AGY, npm dependencies và Chromium nào; những bước nào đã kiểm tra thành công.
- Đăng nhập AGY đã xong hay còn cần người dùng thực hiện.
- Đường dẫn thật của `START.cmd` và thư mục `dist\extension`.
- Server đang chạy hay đã dừng sau kiểm tra; URL tunnel chỉ đưa khi lấy được từ lần chạy thật.
- Các bước còn lại: mở START, load extension, ghép cặp, nhập context/model.

Phân biệt “build/tests qua” với “đã chạy trên tài khoản IG thật”. Không khẳng định đã thử đăng nhập, ghép cặp hay soạn tin thực tế nếu chưa làm.

## Dùng hằng ngày và cập nhật

Mở START.cmd → lấy URL tunnel hiện tại → mở profile IG. Nếu URL thay đổi, vào **Cài đặt → Đổi server / Ghép cặp lại** và nhập URL/mã mới. Không phải load extension lại mỗi ngày. Quick Tunnel đổi URL khi tạo lại và không có cam kết uptime; máy phải bật và có mạng trong lúc dùng. Nội dung trao đổi giữa extension và bridge đi qua Cloudflare; AGY và database vẫn chạy trên máy.

Khi nhận bản tool mới: dừng START/bridge cũ, giữ nguyên `.local` của chính người dùng, cập nhật mã nguồn, chạy lại phần cài/build, rồi Reload extension tại `chrome://extensions` và tải lại Instagram. Nếu đổi vị trí thư mục extension, cần load lại đường dẫn mới.

## Lỗi thường gặp

| Triệu chứng | Cách kiểm tra/xử lý |
| --- | --- |
| `node`/`agy` không được nhận diện | Kiểm tra file đã cài và PATH; mở lại terminal/Explorer. AGY thường ở `%LOCALAPPDATA%\agy\bin`. |
| PowerShell chặn `npm.ps1` | Dùng `npm.cmd`/`npx.cmd`. |
| `node:sqlite` không tồn tại | Kiểm tra phiên bản Node đang thực sự được dùng; yêu cầu >= 22.12.0. |
| Không có browser executable | Chạy `npx.cmd playwright install chromium --only-shell` bằng tài khoản chạy START. |
| Cổng 43127 đang được dùng | Kiểm tra `/health`. Nếu là bridge cũ, dừng đúng cửa sổ đó trước khi cập nhật. Nếu là app khác, không tự kill app đó. |
| Bridge chạy nhưng Multilogin không kết nối | Dùng URL HTTPS hiện tại; kiểm tra tunnel `/health`, reload extension và tab IG. |
| Mã ghép cặp sai | Lấy mã từ bridge hiện đang chạy. Restart bridge tạo mã mới; URL tunnel và mã là hai thứ khác nhau. |
| Tunnel trả 502/530 hoặc không truy cập được | Kiểm tra bridge `/health`, log cloudflared, mạng và URL còn sống; chạy lại START khi cần. |
| AGY yêu cầu đăng nhập hoặc hết quota | Người dùng đăng nhập/kiểm tra tài khoản AGY; không thay provider tự động. |
| Danh sách model có nhưng soạn lỗi | Kiểm tra quyền dùng model/quota bằng một yêu cầu tổng hợp nếu người dùng muốn; `agy models` không chứng minh inference thành công. |
| Không thấy bảng trợ lý | Đúng profile chưa, extension đã bật chưa, tab có phải `www.instagram.com` không; tải lại tab và bấm biểu tượng extension. |
| Gõ chữ vẫn mất focus | Kiểm tra đã Reload bản extension mới và tải lại IG, không chỉ restart bridge. |
| Tìm web lâu hoặc thiếu kết quả | Browser chỉ dùng bộ lọc có thật, tối đa 5 vòng/3 phút; tiền tệ, CAPTCHA, đăng nhập hoặc API POST có thể hạn chế. Bổ sung context khi tool hỏi. |

## Dành cho người gửi bộ tool

Gửi `how_to_setup.md` cùng `START.cmd`, `README.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `src/`, `scripts/`, `tests/`. `dist/` có thể gửi kèm nhưng agent vẫn nên build từ source. Giữ nguyên cấu trúc thư mục.

**Không đưa vào gói chia sẻ:** `.local/`, `node_modules/`, `*.har`, `instagram-dom.html`, log, token, cookie, database chat và thông tin đăng nhập. Đặc biệt `.local/assistant.sqlite` chứa context/lịch sử/cache; gói mã nguồn sạch không cần dữ liệu này. Đây là hướng dẫn đóng gói, không phải yêu cầu xóa dữ liệu gốc trên máy người gửi.

## Nguồn cài đặt chính thức

- Node.js: https://nodejs.org/en/download
- AGY CLI: https://antigravity.google/docs/getting-started?tab=cli
- AGY đăng nhập: https://www.antigravity.google/docs/install?tab=cli
- Playwright Chromium: https://playwright.dev/docs/browsers
- Cloudflare Quick Tunnels: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/

Nếu nhà cung cấp đổi installer hoặc CLI, agent đối chiếu tài liệu chính thức rồi điều chỉnh bước cài tương ứng; không tải bản thay thế từ nguồn không rõ.
