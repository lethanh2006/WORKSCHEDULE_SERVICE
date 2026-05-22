import { ScheduleRequest } from '../models/ScheduleRequest.js';
import { ScheduleEntry } from '../models/ScheduleEntry.js';
import { WorkPolicy } from '../models/WorkPolicy.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { isMonday, parseIsoWeek, isPastDeadline, isLockedByPolicy } from '../utils/date.js';
import { enrichSingleWithEmployeeProfile } from '../utils/userProfileEnricher.js';
export const getMySchedules = async (req, res) => {
    try {
        const { week } = req.query;
        const filter = { employee_id: req.user._id || req.user.id };
        if (week && typeof week === 'string') {
            const matchWeek = parseIsoWeek(week);
            if (matchWeek) {
                filter.week_start = matchWeek;
            }
        }
        const requests = await ScheduleRequest.find(filter).sort({ week_start: -1 });
        const result = [];
        for (const scheduleRequest of requests) {
            const entries = await ScheduleEntry.find({ request_id: scheduleRequest._id });
            const scheduleWithEmployee = await enrichSingleWithEmployeeProfile(req.headers.authorization, scheduleRequest);
            result.push({ ...scheduleWithEmployee, entries });
        }
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const createRequest = async (req, res) => {
    try {
        const { week_start, entries } = req.body;
        if (!isMonday(week_start)) {
            res.status(400).json({ success: false, message: 'week_start must be a Monday' });
            return;
        }
        const existing = await ScheduleRequest.findOne({
            employee_id: req.user._id || req.user.id,
            week_start: new Date(week_start)
        });
        if (existing) {
            res.status(400).json({ success: false, message: 'Schedule request for this week already exists' });
            return;
        }
        if (req.user.role !== 'admin') {
            const policy = await WorkPolicy.findOne();
            if (policy && isLockedByPolicy(new Date(week_start), policy.lock_schedule_days)) {
                res.status(400).json({ success: false, message: 'This week is locked by schedule policy' });
                return;
            }
        }
        const newRequest = await ScheduleRequest.create({
            employee_id: req.user._id || req.user.id,
            week_start,
            status: 'draft'
        });
        if (entries && Array.isArray(entries)) {
            if (entries.length === 0) {
                res.status(400).json({ success: false, message: 'entries must not be empty' });
                return;
            }
            const insertData = entries.map(e => ({
                request_id: newRequest._id,
                date: new Date(e.date),
                type: e.type,
                note: e.note
            }));
            await ScheduleEntry.insertMany(insertData);
        }
        res.status(201).json({ success: true, data: newRequest });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const getRequestInfo = async (req, res) => {
    try {
        const _id = req.params.id;
        const employee_id = req.user._id || req.user.id;
        let request = null;
        if (req.user.role === 'admin') {
            request = await ScheduleRequest.findById(_id);
        }
        else {
            request = await ScheduleRequest.findOne({ _id, employee_id });
        }
        if (!request) {
            res.status(404).json({ success: false, message: 'Request not found' });
            return;
        }
        const entries = await ScheduleEntry.find({ request_id: _id });
        const requestWithEmployee = await enrichSingleWithEmployeeProfile(req.headers.authorization, request);
        res.status(200).json({ success: true, data: { ...requestWithEmployee, entries } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const updateEntries = async (req, res) => {
    try {
        const { id } = req.params;
        const { entries } = req.body;
        if (!Array.isArray(entries) || entries.length === 0) {
            res.status(400).json({ success: false, message: 'entries must be a non-empty array' });
            return;
        }
        let request = null;
        const isAdminUser = req.user.role === 'admin';
        if (isAdminUser) {
            request = await ScheduleRequest.findById(id);
        }
        else {
            request = await ScheduleRequest.findOne({ _id: id, employee_id: req.user._id || req.user.id });
        }
        if (!request) {
            res.status(404).json({ success: false, message: 'Not found' });
            return;
        }
        if (!isAdminUser) {
            if (request.status !== 'draft') {
                res.status(400).json({ success: false, message: 'Can only edit draft requests' });
                return;
            }
            const policy = await WorkPolicy.findOne();
            if (policy && isLockedByPolicy(request.week_start, policy.lock_schedule_days)) {
                res.status(400).json({ success: false, message: 'This week is locked by schedule policy' });
                return;
            }
        }
        await ScheduleEntry.deleteMany({ request_id: id });
        const insertData = entries.map((e) => ({
            request_id: id,
            date: new Date(e.date),
            type: e.type,
            note: e.note
        }));
        await ScheduleEntry.insertMany(insertData);
        // If already approved, sync attendance records
        if (request.status === 'approved') {
            const weekStart = new Date(request.week_start);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            await AttendanceRecord.deleteMany({
                employee_id: request.employee_id,
                source: 'schedule',
                date: { $gte: weekStart, $lt: weekEnd }
            });
            const remoteEntries = insertData.filter(e => e.type === 'remote');
            if (remoteEntries.length > 0) {
                const attRecords = remoteEntries.map(entry => ({
                    employee_id: request.employee_id,
                    date: entry.date,
                    schedule_type: 'remote',
                    source: 'schedule',
                    check_in_at: new Date(new Date(entry.date).setHours(9, 0, 0, 0)),
                    check_out_at: new Date(new Date(entry.date).setHours(18, 0, 0, 0))
                }));
                await AttendanceRecord.insertMany(attRecords);
            }
        }
        res.status(200).json({ success: true, message: 'Updated successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const submitRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await ScheduleRequest.findOne({ _id: id, employee_id: req.user._id || req.user.id });
        if (!request) {
            res.status(404).json({ success: false, message: 'Not found' });
            return;
        }
        if (request.status !== 'draft') {
            res.status(400).json({ success: false, message: 'Already submitted or not draft' });
            return;
        }
        const policy = await WorkPolicy.findOne();
        if (policy && req.user.role !== 'admin') {
            if (isLockedByPolicy(request.week_start, policy.lock_schedule_days)) {
                res.status(400).json({ success: false, message: 'This week is locked by schedule policy' });
                return;
            }
            if (isPastDeadline(request.week_start, policy.submit_deadline_day, policy.submit_deadline_hour)) {
                res.status(400).json({ success: false, message: 'Past deadline to submit schedule for this week' });
                return;
            }
        }
        request.status = 'pending';
        request.submitted_at = new Date();
        await request.save();
        res.status(200).json({ success: true, data: request });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const deleteRequest = async (req, res) => {
    try {
        const { id } = req.params;
        let request = null;
        const isAdminUser = req.user.role === 'admin';
        if (isAdminUser) {
            request = await ScheduleRequest.findById(id);
        }
        else {
            request = await ScheduleRequest.findOne({ _id: id, employee_id: req.user._id || req.user.id });
        }
        if (!request) {
            res.status(404).json({ success: false, message: 'Not found' });
            return;
        }
        if (!isAdminUser) {
            if (request.status !== 'draft') {
                res.status(400).json({ success: false, message: 'Cannot delete a non-draft request' });
                return;
            }
            const policy = await WorkPolicy.findOne();
            if (policy && isLockedByPolicy(request.week_start, policy.lock_schedule_days)) {
                res.status(400).json({ success: false, message: 'This week is locked by schedule policy' });
                return;
            }
        }
        await ScheduleEntry.deleteMany({ request_id: id });
        // Delete attendance records if approved schedule is deleted
        if (request.status === 'approved') {
            const weekStart = new Date(request.week_start);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            await AttendanceRecord.deleteMany({
                employee_id: request.employee_id,
                source: 'schedule',
                date: { $gte: weekStart, $lt: weekEnd }
            });
        }
        await request.deleteOne();
        res.status(200).json({ success: true, message: 'Deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
