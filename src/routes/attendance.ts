import { Router } from 'express';
import {
  generateQrToken,
  scanQrToken,
  getMyAttendance,
  getTodayAttendance,
  getReport
} from '../controllers/attendance.js';
import { isAuth, isAdmin } from '../middleware/isAuth.js';

const router = Router();
router.post('/attendance/scan', isAuth, scanQrToken);
router.get('/attendance/my', isAuth, getMyAttendance);
router.post('/admin/attendance/qr/generate', isAuth, isAdmin, generateQrToken);
router.get('/admin/attendance/today', isAuth, isAdmin, getTodayAttendance);
router.get('/admin/attendance/report', isAuth, isAdmin, getReport);

export default router;
