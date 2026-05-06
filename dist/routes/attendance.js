import { Router } from 'express';
import { generateQrToken, scanQrToken, getMyAttendance, getTodayAttendance, getReport } from '../controllers/attendance.js';
import { isAuth, isAdmin } from '../middleware/isAuth.js';
const router = Router();
/**
 * @swagger
 * /attendance/scan:
 *   post:
 *     summary: Quét token QR để check-in/check-out
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Quét thành công
 *       400:
 *         description: Token không hợp lệ hoặc hết hạn
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Server error
 */
router.post('/attendance/scan', isAuth, scanQrToken);
/**
 * @swagger
 * /attendance/my:
 *   get:
 *     summary: Lấy lịch sử chấm công của tôi
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Server error
 */
router.get('/attendance/my', isAuth, getMyAttendance);
/**
 * @swagger
 * /admin/attendance/qr/generate:
 *   post:
 *     summary: Tạo token QR chấm công (chỉ Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tạo token thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.post('/admin/attendance/qr/generate', isAuth, isAdmin, generateQrToken);
/**
 * @swagger
 * /admin/attendance/today:
 *   get:
 *     summary: Lấy danh sách chấm công trong ngày (chỉ Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.get('/admin/attendance/today', isAuth, isAdmin, getTodayAttendance);
/**
 * @swagger
 * /admin/attendance/report:
 *   get:
 *     summary: Lấy báo cáo chấm công (chỉ Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Lấy báo cáo thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.get('/admin/attendance/report', isAuth, isAdmin, getReport);
export default router;
