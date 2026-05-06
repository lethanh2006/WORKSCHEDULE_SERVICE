import { WorkPolicy } from '../models/WorkPolicy.js';
export const getPolicy = async (req, res) => {
    try {
        let policy = await WorkPolicy.findOne();
        if (!policy) {
            policy = await WorkPolicy.create({
                submit_deadline_day: 5,
                submit_deadline_hour: 17,
                lock_schedule_days: 7
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
        const { submit_deadline_day, submit_deadline_hour, lock_schedule_days } = req.body;
        let policy = await WorkPolicy.findOne();
        if (policy) {
            policy.submit_deadline_day = submit_deadline_day ?? policy.submit_deadline_day;
            policy.submit_deadline_hour = submit_deadline_hour ?? policy.submit_deadline_hour;
            policy.lock_schedule_days = lock_schedule_days ?? policy.lock_schedule_days;
            policy.updated_by = req.user._id || req.user.id;
            await policy.save();
        }
        else {
            policy = await WorkPolicy.create({
                submit_deadline_day,
                submit_deadline_hour,
                lock_schedule_days,
                updated_by: req.user._id || req.user.id
            });
        }
        res.status(200).json({ success: true, data: policy });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
