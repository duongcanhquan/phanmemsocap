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

Trang **Bài giảng** dùng TipTap. Ảnh kéo thả được tải lên Cloudflare R2 qua `src/lib/r2.ts`. Bucket cần bật CORS cho origin của ứng dụng và cho phép `PUT`. Các biến `VITE_R2_*` nằm trong bundle trình duyệt, nên token R2 chỉ nên có quyền ghi vào prefix `lessons/`.
