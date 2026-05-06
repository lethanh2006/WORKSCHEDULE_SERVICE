import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDb from './config/db.js';
// import taskRoutes from './routes/workschedule.js';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
dotenv.config();
connectDb();
const app = express();
app.use(cors());
app.use(express.json());
import policyRoutes from './routes/policy.js';
import scheduleRoutes from './routes/schedule.js';
import adminScheduleRoutes from './routes/adminSchedule.js';
import attendanceRoutes from './routes/attendance.js';
app.use("/api/v1", policyRoutes);
app.use("/api/v1", scheduleRoutes);
app.use("/api/v1", adminScheduleRoutes);
app.use("/api/v1", attendanceRoutes);
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: { title: 'Workschedule Service API', version: '1.0.0' },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.ts', './dist/routes/*.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});
const port = process.env.PORT || 5004;
app.listen(port, () => {
    console.log(`Workschedule service is running on port ${port}`);
});
