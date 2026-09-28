# Multilingo Platform - Workspace Agents Configuration

Thư mục `.agents/` chứa các quy tắc (rules) và kỹ năng (skills) dùng chung cho toàn team, được tự động tải bởi AI agents khi làm việc trong dự án.

## Cấu trúc

```
.agents/
├── README.md                        # File này
├── rules/                           # Quy tắc bắt buộc (always-on)
│   ├── backend-architecture.md      # Quy chuẩn Entity, ApiResponse, ErrorCode
│   ├── frontend-architecture.md     # Quy chuẩn React, Axios, TypeScript
│   ├── docker-infrastructure.md     # Quy chuẩn Docker, Port, Healthcheck
│   └── git-workflow.md              # Quy chuẩn Branch, Rebase, Force-push, PR
└── skills/                          # Kỹ năng chuyên biệt (on-demand)
    ├── ⚡ BỘ KỸ NĂNG SUPERPOWERS NỘI TẠI (ĐÃ ĐÓNG GÓI SẴN TRONG DỰ ÁN):
    │   ├── brainstorming/           # Khảo sát yêu cầu, làm rõ nghiệp vụ, phác thảo Spec
    │   ├── writing-plans/           # Chia nhỏ Spec thành các task 2-5 phút
    │   ├── test-driven-development/ # TDD: Red -> Green -> Refactor
    │   ├── executing-plans/         # Thực thi kế hoạch tuần tự, chuẩn hóa
    │   ├── verification-before-completion/ # Chạy test, thu thập log bằng chứng hoàn thành
    │   ├── systematic-debugging/    # Debug có hệ thống 4 bước (Root Cause Analysis)
    │   ├── subagent-driven-development/    # Điều phối subagents thực thi task độc lập
    │   ├── using-superpowers/       # Điều phối tổng quan phương pháp luận Superpowers
    │   ├── requesting-code-review/  # Tự động gửi review code trước khi hoàn tất
    │   ├── receiving-code-review/   # Tiếp nhận và xử lý góp ý code review
    │   └── finishing-a-development-branch/ # Hoàn thiện branch, chuẩn bị merge
    └── 🎯 KỸ NĂNG ĐẶC THÙ MULTILINGO:
        ├── multilingo-feature-development/ # Quy trình phát triển tính năng Use Case Multilingo
        ├── multilingo-crud-generator/      # Tạo nhanh bộ CRUD chuẩn Base Architecture
        └── multilingo-debugging/           # Hướng dẫn debug đặc thù Multilingo (DB, Redis, H2)
```


## Cách hoạt động

- **Rules** (`rules/*.md`): Được tải tự động vào context của AI agent. Agent sẽ luôn tuân thủ các quy tắc này.
- **Skills** (`skills/*/SKILL.md`): Chỉ kích hoạt khi cần thiết. AI agent sẽ đọc và áp dụng khi gặp task phù hợp.

## Tài liệu liên quan

- 📘 [Hướng dẫn Sử dụng AI Agent cho Team](file:///f:/Working/JavaBackend/multilingo-platform/docs/AI_AGENT_GUIDE.md) (`docs/AI_AGENT_GUIDE.md`): Cách prompt, các kịch bản mẫu, quy trình feature có/chưa có đặc tả.
- 📘 [Tài liệu Hướng dẫn Phát triển Toàn diện](file:///f:/Working/JavaBackend/multilingo-platform/docs/TEAM_DEVELOPMENT_GUIDE.md) (`docs/TEAM_DEVELOPMENT_GUIDE.md`): Setup môi trường, kiến trúc base, quy chuẩn Git Rebase & PR.

## Lưu ý cho team

- Các file trong `.agents/` **phải được commit** vào Git để cả team cùng hưởng lợi.
- Quy trình Git: Bắt buộc dùng `git rebase develop` và chỉ dùng `git push --force-with-lease` trên nhánh cá nhân.
- Tính năng mới **chưa có đặc tả**: Bắt buộc yêu cầu AI lập Spec trước tại `docs/superpowers/specs/` trước khi code.
- Khi cập nhật quy chuẩn kiến trúc, hãy đồng bộ sửa cả `GEMINI.md` (gốc) và `.agents/rules/` (chi tiết).
- Không xoá hoặc sửa cấu trúc thư mục này mà chưa thông qua team lead.

