import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from "dns";
dotenv.config();
const connectDb = async () => {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Workschedule service connected to DB');
    }
    catch (error) {
        console.error('Workschedule service DB connection error:', error);
        process.exit(1);
    }
};
export default connectDb;
