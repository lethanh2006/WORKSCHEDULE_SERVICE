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

router.get('/schedule/my', isAuth, getMySchedules);
router.post('/schedule/requests', isAuth, createRequest);
router.get('/schedule/requests/:id', isAuth, getRequestInfo);
router.patch('/schedule/requests/:id', isAuth, updateEntries);
router.post('/schedule/requests/:id/submit', isAuth, submitRequest);
router.delete('/schedule/requests/:id', isAuth, deleteRequest);

export default router;
