export const isAuth = async (req, res, next) => {
    try {
        const base64Payload = req.headers['x-user-payload'];
        if (!base64Payload) {
            res.status(401).json({ message: "Unauthorized: Missing identity payload" });
            return;
        }
        const jsonString = Buffer.from(base64Payload, 'base64').toString('utf8');
        const userData = JSON.parse(jsonString);
        req.user = userData;
        next();
    }
    catch (error) {
        console.error("Auth middleware error:", error);
        res.status(401).json({ message: "Unauthorized: Invalid identity payload" });
    }
};
export const isAdmin = async (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        res.status(403).json({ message: "Forbidden: Admins only" });
        return;
    }
    next();
};
export const requirePermission = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissions) {
            res.status(403).json({ message: "Forbidden: No permissions assigned" });
            return;
        }
        const hasAccess = req.user.permissions.includes("*") || req.user.permissions.includes(requiredPermission);
        if (!hasAccess) {
            res.status(403).json({ message: "Forbidden: Insufficient permissions" });
            return;
        }
        next();
    };
};
export const requireAnyRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            res.status(403).json({ message: "Forbidden: Access denied for your role" });
            return;
        }
        next();
    };
};
