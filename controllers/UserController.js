const UserModel = require('../model/userModel');
const crypto = require('crypto-js');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'medmine';
const graph = require('@microsoft/microsoft-graph-client');



const generateAccessToken = (email) => {
    const expiresInHours = 24;
    return jwt.sign({ email }, JWT_SECRET, { expiresIn: expiresInHours * 60 * 60 });
};

const isTokenExpired = (token) => {
    try {
        jwt.verify(token, JWT_SECRET);
        return false;
    } catch (error) {
        return true;
    }
};
const UserController = {


    UserLogin: async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ success: false, error: 'Email and password are required' });
            }

            const hashedPassword = crypto.SHA256(password).toString(crypto.enc.Hex);

            const user = await UserModel.findOne({ email });

            if (!user || user.password !== hashedPassword) {
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            let accessToken = null;

            if (!user.loginToken || isTokenExpired(user.loginToken)) {
                accessToken = generateAccessToken(email);
                await UserModel.updateOne({ email }, { loginToken: accessToken });
            } else {
                accessToken = user.loginToken;
            }


            req.session.email = email;

            res.cookie('userEmail', email, { maxAge: 3600000 });

            res.json({
                success: true,
                message: 'Login successful',
                userData: {
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                accessToken: accessToken
            });
        } catch (error) {
            console.error(`Error while processing login: ${error.message}`);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    },
    // CreateAzureuser: async (req, res) => {

    //     try {
    //         const accessToken = req.headers.authorization.split(' ')[1];
    //         const client = graph.Client.init({
    //           authProvider: (done) => {
    //             done(null, accessToken);
    //           }
    //         });
        
    //         const newUser = {
    //           accountEnabled: true,
    //           displayName: req.body.displayName,
    //           mailNickname: req.body.mailNickname,
    //           userPrincipalName: req.body.userPrincipalName,
    //           mail: [{
    //             "address": req.body.userPrincipalName,
    //             "name": req.body.displayName
    //           }],
    //           passwordProfile: {
    //             forceChangePasswordNextSignIn: true,
    //             password: req.body.password
    //           }
    //         };
        
    //         const response = await client.api('/users').post(newUser);
    //         res.status(201).json(response);
    //       } catch (error) {
    //         console.error('Error creating user:', error);
    //         res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create user' });
    //       }
    // }

    // CreateAzureUser: async (req, res) => {
    //     try {
    //         const accessToken = req.headers.authorization.split(' ')[1];
    //         const client = graph.Client.init({
    //             authProvider: (done) => {
    //                 done(null, accessToken);
    //             }
    //         });
    
    //         const newUser = {
    //             accountEnabled: true,
    //             displayName: req.body.displayName,
    //             mailNickname: req.body.mailNickname,
    //             userPrincipalName: req.body.userPrincipalName,
    //             passwordProfile: {
    //                 forceChangePasswordNextSignIn: true,
    //                 password: req.body.password
    //             }
    //         };
    
    //         const response = await client.api('/users')
    //             .post(newUser);
    
    //         res.status(201).json(response);
    //     } catch (error) {
    //         console.error('Error creating user:', error);
    //         res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create user' });
    //     }
    // }

    CreateAzureuser: async (req, res) => {
        try {
            const accessToken = req.headers.authorization.split(' ')[1];
            const client = graph.Client.init({
                authProvider: (done) => {
                    done(null, accessToken);
                }
            });
    
            const newUser = {
                accountEnabled: true,
                displayName: req.body.displayName,
                mailNickname: req.body.mailNickname,
                userPrincipalName: req.body.userPrincipalName,
                passwordProfile: {
                    forceChangePasswordNextSignIn: true,
                    password: req.body.password
                }
            };
    
            const response = await client.api('/users')
                .post(newUser);
    
            // Check if the response contains unexpected arrays
            if (Array.isArray(response)) {
                // Handle the unexpected array in the response
                console.error('Unexpected array in response:', response);
                res.status(500).json({ error: 'Unexpected response from server' });
                return;
            }
    
            res.status(201).json(response);
        } catch (error) {
            console.error('Error creating user:', error);
            res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create user' });
        }
    },

    get_user_data: async (req, res) => {
        try {
            const email = req.body.email; 
        console.log(email)
            // Check if email is provided
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
    
            const user_details = await UserModel.findOne({ email }).select('-_id -password -loginToken -__v');
    
            // Check if user data is found
            if (!user_details) {
                return res.status(404).json({ error: 'User not found' });
            }
    
            console.log(user_details);
            res.status(200).json(user_details);
        } catch (error) {
            // Handle any unexpected errors
            console.error('Error retrieving user data:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    
    

};


module.exports = UserController;