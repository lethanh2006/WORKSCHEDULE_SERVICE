import { Router } from 'express';
import {
  getMySchedules,
  createRequest,
  getRequestInfo,
  updateEntries,
  submitRequest,
  deleteRequest
} from '../controllers/schedule.js';
import { isAuth, requirePermission } from '../middleware/isAuth.js';

const router = Router();

router.get('/schedule/my', isAuth, requirePermission('schedule:read-own'), getMySchedules);
router.post('/schedule/requests', isAuth, requirePermission('schedule:create'), createRequest);
router.get('/schedule/requests/:id', isAuth, requirePermission('schedule:read-own'), getRequestInfo);
router.patch('/schedule/requests/:id', isAuth, requirePermission('schedule:create'), updateEntries);
router.post('/schedule/requests/:id/submit', isAuth, requirePermission('schedule:create'), submitRequest);
router.delete('/schedule/requests/:id', isAuth, requirePermission('schedule:create'), deleteRequest);

export default router;
