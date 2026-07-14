export const isAuth = (req, res, next) => {
    const payload = req.headers['x-user-payload'];
    if (!payload) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    req.user = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    next();
};
