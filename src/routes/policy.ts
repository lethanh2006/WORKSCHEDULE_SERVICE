import { Router } from 'express';
import { getPolicy, updatePolicy } from '../controllers/policy.js';
import { isAuth, requirePermission } from '../middleware/isAuth.js';

const router = Router();

router.get('/policy', getPolicy);
router.patch('/policy', isAuth, requirePermission('policy:write'), updatePolicy);

export default router;
