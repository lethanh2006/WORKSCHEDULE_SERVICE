import { Router } from 'express';
import {
  generateQrToken,
  scanQrToken,
  getMyAttendance,
  getTodayAttendance,
  getReport
} from '../controllers/attendance.js';
import { isAuth } from '../middleware/isAuth.js';

const router = Router();

router.post('/attendance/scan', isAuth, scanQrToken);
router.get('/attendance/my', isAuth, getMyAttendance);
router.post('/attendance/qr/generate', isAuth, generateQrToken);
router.get('/attendance/today', isAuth, getTodayAttendance);
router.get('/attendance/report', isAuth, getReport);

export default router;
