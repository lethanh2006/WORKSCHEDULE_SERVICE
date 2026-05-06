import { Router } from 'express';
import {
  getPendingRequests,
  getAllRequests,
  approveRequest,
  rejectRequest,
  bulkApprove,
  getHeatmap
} from '../controllers/adminSchedule.js';
import { isAuth, isAdmin } from '../middleware/isAuth.js';

const router = Router();

/**
 * @swagger
 * /admin/schedule/pending:
 *   get:
 *     summary: Lấy danh sách yêu cầu đang chờ duyệt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: week
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.get('/admin/schedule/pending', isAuth, isAdmin, getPendingRequests);

/**
 * @swagger
 * /admin/schedule/all:
 *   get:
 *     summary: Lấy toàn bộ yêu cầu lịch làm việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: week
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [draft, pending, approved, rejected]
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.get('/admin/schedule/all', isAuth, isAdmin, getAllRequests);

/**
 * @swagger
 * /admin/schedule/{id}/approve:
 *   post:
 *     summary: Duyệt một yêu cầu lịch làm việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Duyệt thành công
 *       400:
 *         description: Request không hợp lệ hoặc không ở trạng thái pending
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.post('/admin/schedule/:id/approve', isAuth, isAdmin, approveRequest);

/**
 * @swagger
 * /admin/schedule/{id}/reject:
 *   post:
 *     summary: Từ chối một yêu cầu lịch làm việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Từ chối thành công
 *       400:
 *         description: Request không hợp lệ hoặc không ở trạng thái pending
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.post('/admin/schedule/:id/reject', isAuth, isAdmin, rejectRequest);

/**
 * @swagger
 * /admin/schedule/bulk-approve:
 *   post:
 *     summary: Duyệt hàng loạt các yêu cầu
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Duyệt hàng loạt thành công
 *       400:
 *         description: Thiếu danh sách ids
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.post('/admin/schedule/bulk-approve', isAuth, isAdmin, bulkApprove);

/**
 * @swagger
 * /admin/schedule/heatmap:
 *   get:
 *     summary: Thống kê heatmap theo tuần đã duyệt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: week
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy dữ liệu heatmap thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.get('/admin/schedule/heatmap', isAuth, isAdmin, getHeatmap);

export default router;
