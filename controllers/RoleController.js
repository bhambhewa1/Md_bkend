const RoleModel = require('../model/roleModel');

const RoleController = {

    SaveRole: async (req, res) => {
        try {
            const { name } = req.body;
            if (!name) {
                return res.status(400).json({ success: false, error: 'Name is required' });
            }
            const newUser = new RoleModel({
                name
            });
            await newUser.save();
            res.status(201).json({ success: true, message: 'Role created successfully' });
        } catch (error) {
            console.error(`Error while creating user: ${error.message}`);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }

    },

    GetAllRoles: async (req, res) => {
        try {
            const roles = await RoleModel.find();
            res.json({ success: true, roles });
        } catch (error) {
            console.error(`Error while fetching roles: ${error.message}`);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    },

     DeleteRole : async (req, res) => {
        try {
            const { id } = req.body;
 
            if (!id) {
                return res.status(400).json({ success: false, error: 'Role ID is required in the request body' });
            }
     
            const deletedRole = await RoleModel.findByIdAndDelete(id);
    
       
            if (!deletedRole) {
                return res.status(404).json({ success: false, error: 'Role not found' });
            }
    
            
            res.json({ success: true, message: 'Role deleted successfully' });
        } catch (error) {
            console.error(`Error while deleting role: ${error.message}`);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    },



};


module.exports = RoleController;