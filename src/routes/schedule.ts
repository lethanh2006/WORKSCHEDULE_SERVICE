import { Router } from 'express';
import {
  getMySchedules,
  createRequest,
  getRequestInfo,
  updateEntries,
  submitRequest,
  deleteRequest
} from '../controllers/schedule.js';
import { isAuth } from '../middleware/isAuth.js';

const router = Router();

/**
 * @swagger
 * /schedule/my:
 *   get:
 *     summary: Lấy danh sách lịch làm việc của người dùng hiện tại
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: week
 *         required: false
 *         schema:
 *           type: string
 *         description: Tuần theo định dạng ISO week (ví dụ 2026-W17)
 *     responses:
 *       200:
 *         description: Danh sách lịch làm việc
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Server error
 */
router.get('/schedule/my', isAuth, getMySchedules);

/**
 * @swagger
 * /schedule/requests:
 *   post:
 *     summary: Tạo yêu cầu đăng ký lịch làm việc theo tuần
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - week_start
 *             properties:
 *               week_start:
 *                 type: string
 *                 format: date
 *                 description: Ngày bắt đầu tuần (bắt buộc là thứ 2)
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                     type:
 *                       type: string
 *                       enum: [office, remote, leave]
 *                     note:
 *                       type: string
 *     responses:
 *       201:
 *         description: Tạo yêu cầu thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc đã tồn tại yêu cầu trong tuần
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Server error
 */
router.post('/schedule/requests', isAuth, createRequest);

/**
 * @swagger
 * /schedule/requests/{id}:
 *   get:
 *     summary: Lấy chi tiết một yêu cầu lịch làm việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của yêu cầu lịch làm việc
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy yêu cầu
 *       500:
 *         description: Server error
 */
router.get('/schedule/requests/:id', isAuth, getRequestInfo);

/**
 * @swagger
 * /schedule/requests/{id}:
 *   patch:
 *     summary: Cập nhật danh sách entries của yêu cầu nháp
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của yêu cầu lịch làm việc
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entries
 *             properties:
 *               entries:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                     type:
 *                       type: string
 *                       enum: [office, remote, leave]
 *                     note:
 *                       type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Yêu cầu không hợp lệ hoặc không ở trạng thái draft
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy yêu cầu
 *       500:
 *         description: Server error
 */
router.patch('/schedule/requests/:id', isAuth, updateEntries);

/**
 * @swagger
 * /schedule/requests/{id}/submit:
 *   post:
 *     summary: Gửi yêu cầu lịch làm việc để phê duyệt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của yêu cầu lịch làm việc
 *     responses:
 *       200:
 *         description: Gửi yêu cầu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ, không ở trạng thái draft hoặc đã quá hạn
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy yêu cầu
 *       500:
 *         description: Server error
 */
router.post('/schedule/requests/:id/submit', isAuth, submitRequest);

/**
 * @swagger
 * /schedule/requests/{id}:
 *   delete:
 *     summary: Xóa yêu cầu lịch làm việc ở trạng thái nháp
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của yêu cầu lịch làm việc
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       400:
 *         description: Không thể xóa yêu cầu không phải draft
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy yêu cầu
 *       500:
 *         description: Server error
 */
router.delete('/schedule/requests/:id', isAuth, deleteRequest);

export default router;
