import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:5001';
export const getUserProfiles = async (token, userIds) => {
    try {
        const response = await axios.post(`${USER_SERVICE_URL}/api/v1/users/bulk`, { ids: userIds }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
    catch (error) {
        console.error('Error fetching user from user service:', error);
        return null;
    }
};
export const getUserById = async (token, userId) => {
    try {
        const response = await axios.get(`${USER_SERVICE_URL}/api/v1/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
    catch (error) {
        console.error('Error fetching user by id:', error);
        return null;
    }
};
