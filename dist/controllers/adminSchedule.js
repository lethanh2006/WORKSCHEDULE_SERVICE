import { ScheduleRequest } from '../models/ScheduleRequest.js';
import { ScheduleEntry } from '../models/ScheduleEntry.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { parseIsoWeek, getWeekStartRange } from '../utils/date.js';
import { enrichRowsWithEmployeeProfiles } from '../utils/userProfileEnricher.js';
export const getPendingRequests = async (req, res) => {
    try {
        const { week } = req.query;
        const filter = { status: 'pending' };
        if (week && typeof week === 'string') {
            const matchWeek = parseIsoWeek(week);
            if (matchWeek)
                filter.week_start = getWeekStartRange(matchWeek);
        }
        const requests = await ScheduleRequest.find(filter).sort({ submitted_at: 1 });
        const enriched = await enrichRowsWithEmployeeProfiles(req.headers.authorization, requests);
        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const getAllRequests = async (req, res) => {
    try {
        const { week, status } = req.query;
        const filter = {};
        if (week && typeof week === 'string') {
            const matchWeek = parseIsoWeek(week);
            if (matchWeek)
                filter.week_start = getWeekStartRange(matchWeek);
        }
        if (status && status !== 'all' && status !== 'draft') {
            filter.status = status;
        }
        else {
            filter.status = { $ne: 'draft' };
        }
        const requests = await ScheduleRequest.find(filter).sort({ week_start: -1 });
        const enriched = await enrichRowsWithEmployeeProfiles(req.headers.authorization, requests);
        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
const handleApproveSideEffects = async (requestId, adminId) => {
    const request = await ScheduleRequest.findById(requestId);
    if (!request)
        return;
    request.status = 'approved';
    request.reviewed_by = adminId;
    request.reviewed_at = new Date();
    await request.save();
    const remoteEntries = await ScheduleEntry.find({ request_id: requestId, type: 'remote' });
    if (remoteEntries.length > 0) {
        const insertData = remoteEntries.map(entry => ({
            employee_id: request.employee_id,
            date: entry.date,
            schedule_type: 'remote',
            source: 'schedule',
            check_in_at: new Date(entry.date.setHours(9, 0, 0, 0)),
            check_out_at: new Date(entry.date.setHours(18, 0, 0, 0))
        }));
        await AttendanceRecord.insertMany(insertData);
    }
};
export const approveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await ScheduleRequest.findById(id);
        if (!request || request.status !== 'pending') {
            res.status(400).json({ success: false, message: 'Invalid or missing pending request' });
            return;
        }
        await handleApproveSideEffects(id, req.user._id || req.user.id);
        res.status(200).json({ success: true, message: 'Approved successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const rejectRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const request = await ScheduleRequest.findById(id);
        if (!request || request.status !== 'pending') {
            res.status(400).json({ success: false, message: 'Invalid or missing pending request' });
            return;
        }
        request.status = 'rejected';
        request.reject_reason = reason;
        request.reviewed_by = req.user._id || req.user.id;
        request.reviewed_at = new Date();
        await request.save();
        res.status(200).json({ success: true, message: 'Rejected successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const bulkApprove = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ success: false, message: 'List ids is required' });
            return;
        }
        const adminId = req.user._id || req.user.id;
        for (const id of ids) {
            const request = await ScheduleRequest.findById(id);
            if (request && request.status === 'pending') {
                await handleApproveSideEffects(id, adminId);
            }
        }
        res.status(200).json({ success: true, message: 'Bulk approval complete' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const getHeatmap = async (req, res) => {
    try {
        const { week } = req.query;
        let matchWeek = new Date();
        if (week && typeof week === 'string') {
            const parsed = parseIsoWeek(week);
            if (parsed)
                matchWeek = parsed;
        }
        const requests = await ScheduleRequest.find({
            week_start: getWeekStartRange(matchWeek),
            status: 'approved'
        }).select('_id');
        const reqIds = requests.map(r => r._id);
        const pipeline = [
            { $match: { request_id: { $in: reqIds } } },
            { $group: {
                    _id: { date: "$date", type: "$type" },
                    count: { $sum: 1 }
                } },
            { $group: {
                    _id: "$_id.date",
                    stats: { $push: { type: "$_id.type", count: "$count" } }
                } },
            { $sort: { _id: 1 } }
        ];
        const results = await ScheduleEntry.aggregate(pipeline);
        res.status(200).json({ success: true, data: results });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
