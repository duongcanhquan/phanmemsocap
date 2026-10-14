# phanmemsocap

Frontend quản lý đào tạo sơ cấp: React, Vite, TypeScript, Tailwind CSS, Supabase.

## Chạy local

```bash
cp .env.example .env
npm install
npm run dev
```

Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key) trong `.env`. Không dùng `service_role` trên frontend.

Ngôn ngữ mặc định là Tiếng Việt. Có thể đổi sang Tiếng Myanmar hoặc Tiếng Bengali trên header.

Trang **Bài giảng** dùng TipTap. Ảnh/PDF/slide tải lên bucket Supabase Storage `media` (publishable key + RLS). Không đưa secret R2/`service_role` vào biến `VITE_*`.

## Vị trí code bài giảng

| Việc | File |
|------|------|
| Đóng gói / đọc PDF·slide·video·bài viết | `src/lib/lessonContent.ts` |
| Upload file | `src/lib/media.ts` |
| Lọc HTML khi học viên xem | `src/lib/sanitizeHtml.ts` |
| Form PDF/slide/video dùng chung | `src/components/lesson/MaterialFields.tsx` |
| Soạn bài (admin/GV) | `src/pages/LessonEditorPage.tsx` |
| Xem bài (sinh viên) | `src/pages/student/LessonViewer.tsx` |
