
const CompanyLockModel = require('../model/CompanyLockModel');


// Define a middleware function to handle session expiration or browser window closing
const cleanupOnSessionEnd = async (req, res, next) => {
    try {
        // Check if the session has expired or the browser window is closed
        if (!req.session || !req.session.email) {
            return next(); // If session doesn't exist or email is not stored, proceed to next middleware
        }

        // Retrieve the user's email from the session
        const userEmail = req.session.email;

        // Delete CompanyLockModel data where is_Open is true and email matches the user's email
        await CompanyLockModel.deleteMany({ email: userEmail, is_Open: true });

        // Clear the user's email from the session
        delete req.session.email;

        // Proceed to next middleware
        next();
    } catch (error) {
        console.error('Error cleaning up session:', error);
        // You may choose to handle the error differently based on your application's requirements
        next(error);
    }
};

// Register the middleware to run on each request
app.use(cleanupOnSessionEnd);
