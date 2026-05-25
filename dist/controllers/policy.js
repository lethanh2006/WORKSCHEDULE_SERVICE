import { WorkPolicy } from '../models/WorkPolicy.js';
export const getPolicy = async (req, res) => {
    try {
        let policy = await WorkPolicy.findOne();
        if (!policy) {
            const now = new Date();
            policy = await WorkPolicy.create({
                registration_start: now,
                registration_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                locked: true
            });
        }
        res.status(200).json({ success: true, count: 1, data: policy });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const updatePolicy = async (req, res) => {
    try {
        const { registration_start, registration_end, locked } = req.body;
        let policy = await WorkPolicy.findOne();
        if (policy) {
            policy.registration_start = registration_start ? new Date(registration_start) : policy.registration_start;
            policy.registration_end = registration_end ? new Date(registration_end) : policy.registration_end;
            if (typeof locked === 'boolean') {
                policy.locked = locked;
            }
            policy.updated_by = req.user._id || req.user.id;
            await policy.save();
        }
        else {
            policy = await WorkPolicy.create({
                registration_start: new Date(registration_start),
                registration_end: new Date(registration_end),
                locked: typeof locked === 'boolean' ? locked : true,
                updated_by: req.user._id || req.user.id
            });
        }
        res.status(200).json({ success: true, data: policy });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
