import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export interface AuthenticatedRequest extends Request {
    user?: any;
}

export const isAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try { 
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        
        const token = authHeader.split(" ")[1];
        
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("JWT_SECRET is not configured");
            res.status(500).json({ message: "Internal server error" });
            return;
        }

        const decodedValue = jwt.verify(token, secret) as JwtPayload;
        
        if (!decodedValue) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const userObj = decodedValue.user || decodedValue;

        if (userObj.password) {
            delete userObj.password;
        }
        
        req.user = userObj;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(401).json({ message: "Unauthorized or invalid token" });
    }
};

export const isAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || req.user.role !== "admin") {
        res.status(403).json({ message: "Forbidden: Admins only" });
        return;
    }
    next();
};
