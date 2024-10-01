
const UserModel = require('../model/userModel');
const jwt = require("jsonwebtoken");

const authMiddleware = async (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token || !token.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const tokenValue = token.replace('Bearer ', '');
    // Get user data from Firestore based on the loginToken
    const userQuery = await UserModel.where('loginToken', '==', tokenValue).get();

    if (userQuery.empty) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    jwt.verify(tokenValue, "medmine", (error, decoded) => {
        if (error) {
            return res.status(401).json({ message: "Token expired" });

        }


        req.user = decoded.user;
        next();
    });
};

module.exports = authMiddleware;
