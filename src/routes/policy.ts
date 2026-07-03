import { Router } from 'express';
import { getPolicy, updatePolicy } from '../controllers/policy.js';
import { isAuth, isAdmin } from '../middleware/isAuth.js';

const router = Router();
router.get('/policy', getPolicy);
router.patch('/admin/policy', isAuth, isAdmin, updatePolicy);

export default router;
