const eventsHistory_Model = require('../model/eventsHistory');
const UserModel = require('../model/userModel');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const eventsHistory_model = {

    // eventsHistory: async (req, res) => {
    //     const { batchId, email, eventName } = req.body;

    //     try {
    //         const user = await UserModel.findOne({ email }).select('_id');
    //         if (!user) {
    //             return res.status(404).json({ error: 'User not found' });
    //         }
    //         let userId = user._id;

    //         const eventsHistory = await eventsHistory_Model.create({
    //             batchId, userId, eventName
    //         });

    //         res.status(201).json(eventsHistory);
    //     } catch (error) {
    //         console.error(error);
    //         res.status(500).json({ error: 'Internal server error' });
    //     }
    // }

    //     eventsHistory: async (req, res) => {
    //         const { batchId, email, eventName } = req.body;

    //         try {
    //             if (!batchId || !email || !eventName) {
    //                 return res.status(400).json({ error: 'batchId, email, and eventName are required' });
    //             }
    //             // Validate batchId
    //             if (!ObjectId.isValid(batchId)) {
    //                 return res.status(400).json({ error: 'Invalid batchId' });
    //             }

    //             const user = await UserModel.findOne({ email }).select('_id');
    //             if (!user) {
    //                 return res.status(404).json({ error: 'User not found' });
    //             }
    //             let userId = user._id;

    //             const eventsHistory = await eventsHistory_Model.create({
    //                 batchId, userId, eventName
    //             });

    //             res.status(201).json(eventsHistory);
    //         } catch (error) {
    //             console.error(error);
    //             res.status(500).json({ error: 'Internal server error' });
    //         }
    //     }

    // };

    eventsHistory: async (req, res) => {
        const { batchId, email, eventName } = req.body;

        try {
            if (!email || !eventName) {
                return res.status(400).json({ error: 'Email and eventName are required' });
            }
    
            // Validate batchId if it is provided and not empty
            if (batchId && batchId.trim() !== "" && !ObjectId.isValid(batchId)) {
                return res.status(400).json({ error: 'Invalid batchId' });
            }
    
            const user = await UserModel.findOne({ email }).select('_id');
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            let userId = user._id;
    
            // Set batchId to 1 if it is not provided or is an empty string
            const validBatchId = (batchId && batchId.trim() !== "") ? batchId : new ObjectId();
    
            const eventHistoryData = {
                userId,
                eventName,
                batchId: validBatchId
            };
    
            const eventsHistory = await eventsHistory_Model.create(eventHistoryData);
            res.status(201).json(eventsHistory);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = eventsHistory_model;
