import { Router } from 'express';
import { getPolicy, updatePolicy } from '../controllers/policy.js';
import { isAuth, isAdmin } from '../middleware/isAuth.js';

const router = Router();

/**
 * @swagger
 * /policy:
 *   get:
 *     summary: Xem policy hiện tại
 *     responses:
 *       200:
 *         description: Lấy policy thành công
 *       500:
 *         description: Server error
 */
router.get('/policy', getPolicy);

/**
 * @swagger
 * /admin/policy:
 *   patch:
 *     summary: Cập nhật policy (chỉ Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               submit_deadline_day:
 *                 type: number
 *               submit_deadline_hour:
 *                 type: number
 *               require_reason_for_remote:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cập nhật policy thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Server error
 */
router.patch('/admin/policy', isAuth, isAdmin, updatePolicy);

export default router;
