import { Router } from 'express';
import { getPolicy, updatePolicy } from '../controllers/policy.js';
import { isAuth } from '../middleware/isAuth.js';

const router = Router();

router.get('/policy', getPolicy);
router.patch('/policy', isAuth, updatePolicy);

export default router;
