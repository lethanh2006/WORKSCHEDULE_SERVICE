import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from "dns";
import { ScheduleRequest } from '../models/ScheduleRequest.js';
dotenv.config();


const connectDb = async () => {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    try {
        await mongoose.connect(process.env.MONGO_URL as string, { dbName: 'nrapp' });
        const migratedDrafts = await ScheduleRequest.collection.updateMany(
            { status: 'draft' },
            { $set: { status: 'pending', submitted_at: new Date() } }
        );
        if (migratedDrafts.modifiedCount > 0) {
            console.log(`Migrated ${migratedDrafts.modifiedCount} draft schedules to pending`);
        }
        console.log('Workschedule service connected to DB');
    } catch (error) {
        console.error('Workschedule service DB connection error:', error);
        process.exit(1);
    }
};

export default connectDb;
