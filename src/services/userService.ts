import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:5000';

export const getUserProfiles = async (token: string, userIds?: string[]) => {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/api/user/user/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const allUsers = response.data.users || [];
    if (userIds && userIds.length > 0) {
      return allUsers.filter((u: any) => userIds.includes(u._id));
    }
    return allUsers;
  } catch (error) {
    console.error('Error fetching user from user service:', error);
    return null;
  }
};

export const getUserById = async (token: string, userId: string) => {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/api/user/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user by id:', error);
    return null;
  }
}
