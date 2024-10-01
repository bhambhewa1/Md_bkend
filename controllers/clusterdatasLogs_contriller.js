const clusterdatasLogsModel = require('../model/clusterdatasLogs');
const UserModel = require('../model/userModel');

const clusterdatasLogs = {

    save_action_data: async (req, res) => {
        const { data, created_date, batch_id, email, action_name } = req.body;
    
        try {
            // Find the user by email and select the _id field
            const user = await UserModel.findOne({ email }).select('_id');
            
            // Check if the user was found
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
    
            // Create a new log entry in the clusterdatasLogsModel
            await clusterdatasLogsModel.create({
                userId: user._id,  // Use user._id to get the user's ID
                actionType: action_name,
                batchId: batch_id,
                data: data,
                created_date,
            });
    
            // Send a success response
            res.status(200).json({ message: 'Action data saved successfully' });
        } catch (error) {
            // Handle any errors
            console.error('Error saving action data:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
};


module.exports = clusterdatasLogs;
