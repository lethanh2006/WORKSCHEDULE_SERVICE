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
router.get('/admin/schedule/pending', isAuth, isAdmin, getPendingRequests);
router.get('/admin/schedule/all', isAuth, isAdmin, getAllRequests);
router.post('/admin/schedule/:id/approve', isAuth, isAdmin, approveRequest);
router.post('/admin/schedule/:id/reject', isAuth, isAdmin, rejectRequest);
router.post('/admin/schedule/bulk-approve', isAuth, isAdmin, bulkApprove);
router.get('/admin/schedule/heatmap', isAuth, isAdmin, getHeatmap);

export default router;
