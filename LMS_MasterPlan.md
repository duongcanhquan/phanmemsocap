# LMS Master Plan

Đánh giá trên mã hiện có (React, Vite, TypeScript, Tailwind, Supabase). Đây là kế hoạch, chưa phải phần đã làm.

## Những gì đã chạy được

- Vai trò `superadmin`, `admin`, `teacher`, `student`. Quyền đọc từ `profiles`, không lấy từ metadata đăng nhập.
- Tài khoản: tạo, sửa, xóa, đổi mật khẩu, nhập CSV (tối đa 100 dòng) gồm email, mật khẩu, họ tên, ngày sinh, hộ chiếu, CCCD, điện thoại, ảnh.
- Chương trình gắn một giáo viên. Ghi danh nằm ở `program_enrollments` (`status` hiện chỉ dùng `active`).
- Bài học có `is_published`. Học viên chỉ thấy bài đã xuất bản. Bài sau khóa cho đến khi bài trước đạt.
- Quiz qua RPC `get_lesson_questions` và `submit_lesson_quiz`. Điểm đậu đang cố định là 5. Một lượt làm. Tự luận chấm tay, có `teacher_feedback` trong cơ sở dữ liệu.
- Bảng điểm xuất Excel và PDF theo một chương trình.
- Soạn bài TipTap, ảnh R2, trợ lý AI theo API key OpenAI, Gemini, DeepSeek.

## Nhiệm vụ 1. Lỗ hổng nghiệp vụ

### 1. Quản trị viên

| Nhu cầu | Hiện trạng |
| --- | --- |
| Nhập hàng loạt | Có CSV. Chưa có Excel `.xlsx`. Chưa xuất danh sách tài khoản ra file. |
| Reset mật khẩu | Quản trị đặt mật khẩu mới trên trang Tài khoản. Học viên không có trang hồ sơ để tự đổi. |
| Khóa tài khoản khi nghỉ | Chưa có. Không có `suspended`, không có `banned_until` trên giao diện. |
| Lớp / khóa | Lớp đang trùng với chương trình. Không có niên khóa, mã lớp, sĩ số tối đa, hay một lớp học nhiều đợt của cùng một chương trình. Ghi danh là từng người, không có xếp lớp hàng loạt theo file. |
| Dashboard | Ba ô số: học viên, chương trình, và chương trình đếm lại thành lớp. Chưa có tỷ lệ hoàn thành, học viên im hơn 7 ngày, hay nhật ký đăng nhập và đăng xuất. |
| RLS | Đã có hàm `security definer` để cắt vòng lặp policy. Học viên không được nhận đáp án qua RPC. Lỗ còn lại: nhiều màn đọc bảng trực tiếp; cần rà lại policy `quizzes` để học viên không select được `correct_option_index`. Chưa có nhật ký kiểm toán. |
| Cài đặt hệ thống | Chỉ có trang mô hình AI. Chưa có trang cấu hình điểm đậu, số lần làm bài, hạn nộp, tên trường trên chứng chỉ. |

### 2. Giảng viên

| Nhu cầu | Hiện trạng |
| --- | --- |
| Học viên bỏ học | Sĩ số chỉ tính tỷ lệ quiz đã nộp và điểm trung bình. Không có mốc “không vào học 7 ngày”, không có cảnh báo học vụ. |
| Chấm tự luận | Có danh sách bài chưa chấm và ô nhận xét. Nhận xét chỉ nằm trong dòng điểm. Học viên không được báo khi có điểm. |
| Hỏi đáp | Chưa có. |
| Nháp và xuất bản | Có cờ xuất bản trong form bài học của chương trình. Trang soạn thảo lưu HTML vào `content_url` mà không tách bản nháp khỏi bản học viên đang xem. |
| Tua video | Video là iframe YouTube hoặc link. Không đo thời lượng xem, không chặn tua, không gắn chuyên cần vào video. |

### 3. Sinh viên

| Nhu cầu | Hiện trạng |
| --- | --- |
| Nhắc hạn | Chưa có hạn bài, chưa có hộp thông báo. |
| Chứng chỉ | Chưa có. Xuất PDF hiện là bảng điểm của cả lớp, do giáo viên hoặc quản trị bấm. |
| Thời gian học | Chưa ghi nhận thời gian mở bài. Chuyên cần không tính được. |
| Hồ sơ cá nhân | Đổi ngôn ngữ trên thanh đầu chỉ đổi phiên làm việc, không ghi vào `profiles.language`. Ảnh và mật khẩu chỉ sửa được từ trang quản trị. Học viên không có trang hồ sơ. |

## Nhiệm vụ 2. Việc cần tạo hoặc sửa

Ưu tiên P1 trước. P2 và P3 không làm cho đến khi P1 xong và được duyệt.

### P1. Vận hành đúng

#### Schema

- `profiles.status`: `active` hoặc `suspended`. Tài khoản `suspended` không vào bài học. Không xóa người để còn lịch sử điểm.
- `cohorts`: `id`, `program_id`, `name`, `code`, `starts_on`, `ends_on`, `teacher_id`.
- `cohort_members`: `cohort_id`, `student_id`, duy nhất theo cặp. Ghi danh chương trình vẫn giữ ở `program_enrollments`.
- `lesson_drafts`: `lesson_id`, `html`, `updated_by`, `updated_at`. Bản học viên tiếp tục là `lessons.content_url` và chỉ đổi khi xuất bản.
- `study_sessions`: `student_id`, `lesson_id`, `started_at`, `ended_at`, `visible_seconds`, `hidden_seconds`. Cộng dồn theo phiên, không ghi từng giây.
- `auth_events`: `user_id`, `event` (`login` hoặc `logout`), `created_at`. Ghi từ ứng dụng khi đăng nhập và đăng xuất thành công.
- `system_settings` một dòng: `passing_score`, `max_quiz_attempts`, `inactive_days`, `school_name`.

#### RPC

- `record_study_ping(lesson_id, visible_seconds)`: chỉ học viên đang ghi danh, bài đã mở, cộng tối đa 60 giây mỗi lần gọi.
- `publish_lesson(lesson_id)`: giáo viên của chương trình hoặc quản trị chép nháp sang `content_url` và bật `is_published`.
- `school_overview()`: tổng học viên đang học, tỷ lệ hoàn thành theo chương trình, danh sách im hơn `inactive_days`.
- `set_account_status(user_id, status)`: quản trị. Không khóa super admin cuối cùng, không khóa chính mình.

#### Policy

- Học viên không select `quizzes.correct_option_index`. Đáp án chỉ trong RPC chấm.
- `study_sessions`: học viên chỉ ghi phiên của mình. Giáo viên và quản trị chỉ đọc.
- `lesson_drafts`: học viên không đọc.

#### Giao diện

- `src/pages/admin/Overview.tsx`: bốn số và bảng học viên im. Thay các ô đếm trùng trên `DashboardPage`.
- `src/pages/admin/Cohorts.tsx` và sửa `ClassManager`: lớp là cohort, không còn coi mỗi chương trình là một lớp.
- `src/pages/Profile.tsx` cho mọi vai trò: mật khẩu, ảnh, ngôn ngữ ghi xuống `profiles`.
- Soạn bài: nút Lưu nháp và Xuất bản. Học viên không thấy nháp.
- `LessonViewer`: khi tab đang hiện, gọi `record_study_ping` mỗi 30 giây. Ẩn tab thì dừng.
- Sĩ số giáo viên: thêm cột ngày học gần nhất và cờ cảnh báo nếu vượt `inactive_days`.

#### Chống gian lận ở mức làm được

YouTube không cho nhà trường cấm tua trên iframe. P1 không giả là đã chặn tua. P1 ghi thời gian tab đang mở và không cho mở bài sau nếu bài video chưa đủ tỷ lệ thời lượng khai báo. Tỷ lệ đó nằm trên `lessons.required_watch_ratio` và `lessons.duration_seconds`. Bài không phải video giữ luật điểm như hiện tại.

### P2. Vận hành đầy đủ hơn

- Nhập và xuất `.xlsx` trên trang Tài khoản và trên xếp lớp. Giữ CSV.
- `notifications`: điểm đã chấm, hạn bài, cảnh báo nghỉ học. Chuông trên header.
- `lesson_questions`: hỏi đáp dưới bài, giáo viên của chương trình trả lời.
- `certificates`: phát khi đủ bài đã đạt. Học viên tải PDF mang tên mình. Không dùng bảng điểm cả lớp làm chứng chỉ.
- Hạn nộp trên quiz. Nhắc trước một ngày qua `notifications`.

### P3. Sau khi P1 và P2 ổn

- Huy hiệu, chuỗi ngày học.
- Chuyển động giao diện ngoài trạng thái bấm và kính mờ đang có.

## Thứ tự làm khi được đồng ý

1. Migration P1 và policy.
2. RPC `school_overview`, `record_study_ping`, `publish_lesson`, `set_account_status`.
3. Hook dữ liệu trong `src/lib`.
4. Màn tổng quan, lớp, hồ sơ, nháp bài, đồng hồ học, cảnh báo sĩ số.

Chưa làm P2 và P3 trong lượt đó.
