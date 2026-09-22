# Theo dõi hiệu quả index production

Không dùng tài khoản MongoDB của ứng dụng để chạy `$indexStats`. Tạo một tài
khoản monitoring chỉ đọc có đúng quyền `indexStats`, rồi truyền URI qua biến
`INDEX_STATS_MONGO_URL`. Không ghi URI này vào repository hoặc `.env` của ứng
dụng.

Sau khi phiên bản có index mới được triển khai, chụp một mốc ban đầu:

```bash
read -rsp 'Monitoring Mongo URI: ' INDEX_STATS_MONGO_URL && echo
export INDEX_STATS_MONGO_URL
npm run index-stats > index-stats-day-0.json
unset INDEX_STATS_MONGO_URL
```

Chạy lại sau ít nhất 3 ngày có traffic đại diện:

```bash
read -rsp 'Monitoring Mongo URI: ' INDEX_STATS_MONGO_URL && echo
export INDEX_STATS_MONGO_URL
npm run index-stats > index-stats-day-3.json
unset INDEX_STATS_MONGO_URL
```

Nếu chạy trong container production, file script đã được build vào `dist`:

```bash
read -rsp 'Monitoring Mongo URI: ' INDEX_STATS_MONGO_URL && echo
export INDEX_STATS_MONGO_URL
docker exec \
  -e INDEX_STATS_MONGO_URL \
  nrapp-backend-workschedule-1 \
  npm run index-stats > index-stats-day-3.json
unset INDEX_STATS_MONGO_URL
```

Chỉ cân nhắc bỏ `employee_id_1` hoặc `status_1` của collection
`workrequests` khi thỏa cả ba điều kiện:

1. Hai snapshot cách nhau ít nhất 3 ngày và khoảng đo có traffic bình thường.
2. `accesses.ops` của single index không tăng, trong khi compound index tương
   ứng có tăng.
3. `explain("executionStats")` của các truy vấn production đại diện không chọn
   single index và không làm tăng `totalDocsExamined` sau khi ẩn/thử index trên
   môi trường staging.

`$indexStats` được tính từ thời điểm trong trường `accesses.since`; nếu MongoDB
restart hoặc bộ đếm bắt đầu lại trong khoảng đo thì phải bắt đầu lại cửa sổ 3
ngày. Không drop index chỉ vì collection hiện còn ít dữ liệu.
