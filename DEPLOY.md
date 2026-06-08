# VM Deploy — BatSim Web Portal (lab)

One-shot deploy for a lab VM. Branch: `Loc-deploy`.

## Yêu cầu
- Docker Engine 24+ và Docker Compose **v2.24+** (cần cho `env_file ... required: false`). Kiểm tra: `docker compose version`.
- `python3` + `curl` trên VM (cho bước seed tài khoản).

## Các bước
```bash
git clone <repo-url> batsim-web-portal
cd batsim-web-portal
git checkout Loc-deploy
./deploy.sh                          # tạo backend/.env, build image, up stack, seed users
```
`deploy.sh` tự: copy `backend/.env.vm.example` → `backend/.env` nếu thiếu, build image `pybatsim-extended`, `docker compose up -d --build`, chờ backend healthy, rồi seed tài khoản.

Sau lần chạy đầu, **sửa `backend/.env`** (ít nhất `SECRET_KEY`, `GRAFANA_URL` theo IP VM) rồi:
```bash
docker compose restart backend
```

## Tài khoản seed sẵn (scripts/seed-vm-users.py)
- Trình diễn: `demo1..demo3` / `demo@123`
- Khảo sát: `user1..user6` / `lab@123`
- Không có trang đăng ký công khai; seed lại an toàn (user đã có → SKIP).

## Cấu hình đáng chú ý
| Biến | Ở đâu | Ghi chú |
|------|-------|---------|
| `SECRET_KEY`, `GRAFANA_URL` | `backend/.env` | BẮT BUỘC sửa theo VM |
| `DATABASE_URL` | `backend/.env` | VM dùng `sqlite:///./storage/batsim.db` (DB nằm trong `storage/` → backup = copy cả thư mục `storage/`) |
| `PYBATSIM_IMAGE` | `backend/.env` | `batsim-portal/pybatsim-extended:1.0` (image có numpy/scipy) |
| `GRAFANA_ADMIN_PASSWORD` | shell / `batsim-web-portal/.env` (project-root, **không** phải `backend/.env`) | Mặc định `admin`. Đổi: đặt biến rồi `docker compose up -d` |

## Backup / restore
- DB + mọi file thí nghiệm nằm trong `backend/storage/` → backup = `tar czf backup.tgz backend/storage`.

## Phạm vi mạng (QUAN TRỌNG — bảo mật)
- **CHỈ** chạy trong LAN lab / VPN. **KHÔNG** mở port ra Internet công khai.
- Lý do: backend mount `docker.sock` (toàn quyền Docker host), cho phép chạy code strategy do người dùng nạp, và vite dev server không phải prod build.
- Truy cập từ xa: dùng SSH tunnel hoặc Tailscale.
- Public thật (sau bảo vệ): nginx + HTTPS + prod build frontend + tách `docker.sock` (rootless/proxy). Đây là hạng mục tương lai.
