import { Router } from 'express';
import {
  getPendingRequests,
  getAllRequests,
  approveRequest,
  rejectRequest,
  bulkApprove,
  getHeatmap
} from '../controllers/adminSchedule.js';
import { isAuth } from '../middleware/isAuth.js';

const router = Router();

router.get('/schedule/pending', isAuth, getPendingRequests);
router.get('/schedule/all', isAuth, getAllRequests);
router.post('/schedule/requests/:id/approve', isAuth, approveRequest);
router.post('/schedule/requests/:id/reject', isAuth, rejectRequest);
router.post('/schedule/requests/bulk-approve', isAuth, bulkApprove);
router.get('/schedule/heatmap', isAuth, getHeatmap);

export default router;
