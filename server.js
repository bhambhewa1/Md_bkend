const express = require('express');
const cors = require('cors'); // Import the cors package
const app = express();
const axios = require('axios');
const { ClientSecretCredential } = require("@azure/identity");
const { ConfidentialClientApplication } = require("@azure/msal-node");
const https = require('https'); // Import the 'https' module
const fs = require('fs'); // Import the 'fs' module to read SSL/TLS files

const userRoutes = require('./routes/routes');
const c_maping_route = require('./routes/routes');
const knex = require('knex')(require('./config/configMySql'));

const dotenv = require('dotenv');
dotenv.config();

const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUIDoc = require('swagger-ui-express');
const confiDB = require('./config/config');

const WebSocket = require('ws');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const CompanyLockModel = require('./model/CompanyLockModel');

// Set up session middleware
app.use(session({
  secret: 'medmine',
  resave: false,
  saveUninitialized: false
}));

app.use(cors());
app.use(express.json());

app.use('/c_mapping', c_maping_route);
app.use('/api', userRoutes);
app.use(cookieParser());

async function deleteRecordsByEmail(email) {
  try {
    const result = await CompanyLockModel.deleteMany({ email: email, is_Open: true });
    console.log('Records deleted successfully for email:', email);
    console.log('Deletion result:', result);
  } catch (err) {
    console.error('Error deleting records:', err);
  }
}
// Read SSL/TLS files
const privateKey = fs.readFileSync('privatekey.pem', 'utf8');
const certificate = fs.readFileSync('fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Create HTTPS server with SSL/TLS credentials
const httpsServer = https.createServer(credentials, app);

// Create WebSocket server on the HTTPS server
const wss = new WebSocket.Server({ server: httpsServer });

wss.on('connection', function connection(ws) {
  let userEmail;

  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    userEmail = message;
  });

  ws.on('close', function() {
    console.log("close",userEmail)
    console.log('User has closed the application.');
    deleteRecordsByEmail(userEmail);
  });
});

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation for Medmine',
      version: '1.0.0'
    },
    servers: [{
      url: 'http://localhost:3002/'
    }]
  },
  apis: ['./routes/*.js']
}

const swaggerSpec = swaggerJSDoc(options);
app.use('/api-docs', swaggerUIDoc.serve, swaggerUIDoc.setup(swaggerSpec));

const PORT = process.env.PORT || 3005;

knex.raw('SELECT 1+1 as result')
  .then(() => {
    console.log('MySQL server is connected');
  })
  .catch((err) => {
    console.error('Error connecting to MySQL server:', err);
  });

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Start the HTTPS server for the WebSocket server
httpsServer.listen(8001, () => {
  console.log(`WebSocket server is running on port 8001`);
});