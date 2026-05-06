import { getUserProfiles } from '../services/userService.js';
const extractBearerToken = (authorization) => {
    if (!authorization || !authorization.startsWith('Bearer '))
        return null;
    return authorization.split(' ')[1] || null;
};
const normalizeUsers = (payload) => {
    if (!payload)
        return [];
    if (Array.isArray(payload))
        return payload;
    if (Array.isArray(payload.data))
        return payload.data;
    if (Array.isArray(payload.users))
        return payload.users;
    return [];
};
const normalizeRowsWithEmployee = (rows) => {
    return rows.map((item) => {
        const obj = typeof item?.toObject === 'function' ? item.toObject() : item;
        return { ...obj, employee: null };
    });
};
export const enrichRowsWithEmployeeProfiles = async (authorization, rows) => {
    if (rows.length === 0)
        return rows;
    const normalizedRows = normalizeRowsWithEmployee(rows);
    const token = extractBearerToken(authorization);
    if (!token)
        return normalizedRows;
    const uniqueIds = Array.from(new Set(normalizedRows
        .map((item) => item.employee_id?.toString?.() ?? item.employee_id)
        .filter(Boolean)));
    if (uniqueIds.length === 0)
        return normalizedRows;
    const userPayload = await getUserProfiles(token, uniqueIds);
    const users = normalizeUsers(userPayload);
    const userMap = new Map(users.map((u) => [String(u._id ?? u.id), u]));
    return normalizedRows.map((obj) => {
        const employeeId = String(obj.employee_id);
        return {
            ...obj,
            employee: userMap.get(employeeId) || null
        };
    });
};
export const enrichSingleWithEmployeeProfile = async (authorization, item) => {
    const [enriched] = await enrichRowsWithEmployeeProfiles(authorization, [item]);
    return enriched || null;
};
