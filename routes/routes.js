// routes/users.js
const express = require('express');
const router = express.Router();
// const Companycontroller = require('../controllers/Companycontroller');
const JsonController = require('../controllers/JsonController');
const UserController = require('../controllers/UserController');
// const ApproveController = require('../controllers/ApproveController');
// const DataHelperController = require('../controllers/DataHelperController');
const RoleController = require('../controllers/RoleController');
const RefeshController = require('../controllers/RefeshController');
// const CurrentMappingController = require('../controllers/CurrentMappingController');
const authMiddleware = require('../middleware/middleware');
const current_mapping = require('../controllers/current_mapping');
const company = require('../controllers/company');
const clusterdatasLogs = require('../controllers/clusterdatasLogs_contriller');
const approvedMatches_Logs = require('../controllers/approvedMatchesLogs_controller');
const eventsHistory_model = require('../controllers/eventsHistory_controllers');
const OmiController = require('../controllers/OmiController');
const dashboardData = require('../controllers/dashboardData');
const addingbatchController = require('../controllers/Onetime_approveBatch');



/**
 * @swagger
 * /api/get_file_name:
 *   get:
 *     summary: Get file names listing
 *     description: |
 *       Retrieves a list of file names.
 *       This endpoint returns an array of file names available in the system.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               - "AORT"
 *               - "JNJ"
 *               - "OtherFile"
 *               # Add more file names as needed
 *       '404':
 *         description: No files found
 *       '500':
 *         description: Internal Server Error
 */

// router.post('/get_file_namejjj', Companycontroller.getFileNameListing);
/**
 * @swagger
 * /api/get_file_data:
 *   post:
 *     summary: Get data for a specific file
 *     description: |
 *       Retrieves data for a specific file based on the provided filename and user email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *                 description: The name of the file for which data is requested.
 *               email:
 *                 type: string
 *                 description: The email of the user making the request.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               error: "This user is not locked for any file"
 *               data:
 *                 'ManufacturerCatalogNumber': '303302'
 *                 'ItemDescription': '3.5MM CORTEX SCREW SELF-TAPPING 45MM'
 *                 'parent_id': 77285946
 *                 # Add more properties as needed
 *       '404':
 *         description: No data found for the specified file
 *         content:
 *           application/json:
 *             example:
 *               error: "No data found for the specified file"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

// router.post('/get_file_data', Companycontroller.getFileData);

/**
 * @swagger
 * /api/check_data:
 *   get:
 *     summary: Check data status for files
 *     description: |
 *       Checks the data status for files and returns information about non-empty files.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               status: 0
 *               message: "Some files have data"
 *               nonEmptyFiles:
 *                 - "AORT"
 *                 - "JNJ"
 *                 # Add more files as needed
 *       '404':
 *         description: No files with data found
 *         content:
 *           application/json:
 *             example:
 *               status: 1
 *               message: "No files with data found"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               status: 2
 *               message: "Internal Server Error"
 */


// router.get('/check_data', Companycontroller.checkDataInfile);
/**
 * @swagger
 * /api/giveUniqueId:
 *   post:
 *     summary: Cluster data in JSON files and add unique IDs and parent IDs
 *     description: |
 *       Clusters data from JSON files, adds unique IDs and parent IDs, and reloads the clustered matches files.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 description: Indicates the success of the operation.
 *               message:
 *                 type: string
 *                 description: A message describing the result of the operation.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "All Clustered Matches files reloaded successfully."
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */


// router.get('/giveUniqueId', JsonController.giveUniqueId);
router.post('/transferData', JsonController.transferData);
router.post('/get_file_name',JsonController.getFileNameListing);
router.post('/get_batches_list',JsonController.getBatchNameListing);


/**
 * @swagger
 * /api/save_new_cluster:
 *   post:
 *     summary: Save a new cluster
 *     description: |
 *       Saves a new cluster based on the provided details and returns information about the saved row.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *                 description: The name of the file for which the cluster is being saved.
 *               key:
 *                 type: object
 *                 properties:
 *                   parent_id:
 *                     type: string
 *                     description: The parent ID for the new row.
 *                   iscopy:
 *                     type: number
 *                     description: Indicates whether the row is a copy (1 for copy, 0 otherwise).
 *               details:
 *                 type: object
 *                 properties:
 *                   ManufacturerId:
 *                     type: string
 *                     description: The Manufacturer ID for the new row.
 *                   ManufacturerCatalogNumber:
 *                     type: string
 *                     description: The Manufacturer Catalog Number for the new row.
 *                   ItemDescription:
 *                     type: string
 *                     description: The Item Description for the new row.
 *                   # Add more properties as needed
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Row copied successfully."
 *               innerArray:
 *                 - # Details of the first saved row
 *                 - # Details of the second saved row
 *                 # Add more rows as needed
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */


// router.post('/save_new_cluster', JsonController.SaveNewCluster);


/**
 * @swagger
 * /api/approve_cluster:
 *   post:
 *     summary: Approve a cluster
 *     description: |
 *       Approves a cluster based on the provided details and returns information about the approval status.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *                 description: The name of the file for which the cluster is being approved.
 *               key:
 *                 type: object
 *                 properties:
 *                   parent_id:
 *                     type: string
 *                     description: The parent ID for the cluster.
 *                   uniqueId:
 *                     type: string
 *                     description: The unique ID for the cluster.
 *                   action:
 *                     type: string
 *                     description: The action to be performed (e.g., "saveAndApprove", "approve").
 *               details:
 *                 type: object
 *                 properties:
 *                   approvel_status:
 *                     type: number
 *                     description: The approval status (e.g., 1 for approved).
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Cluster approved successfully."
 *               file_status: "empty"
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */


// router.post('/approve_cluster', JsonController.ApproveCluster);

/**
 * @swagger
 * /api/edit_cluster:
 *   post:
 *     summary: Edit a cluster
 *     description: |
 *       Edits an existing cluster based on the provided details and returns information about the edited row.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *                 description: The name of the file for which the cluster is being edited.
 *               key:
 *                 type: object
 *                 properties:
 *                   parent_id:
 *                     type: string
 *                     description: The parent ID for the cluster being edited.
 *                   uniqueId:
 *                     type: string
 *                     description: The unique ID for the cluster being edited.
 *               details:
 *                 type: object
 *                 properties:
 *                   ManufacturerId:
 *                     type: string
 *                     description: The Manufacturer ID for the edited row.
 *                   ManufacturerCatalogNumber:
 *                     type: string
 *                     description: The Manufacturer Catalog Number for the edited row.
 *                   ItemDescription:
 *                     type: string
 *                     description: The Item Description for the edited row.
 *                   # Add more properties as needed
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Row edited successfully."
 *               editedRow:
 *                 # Details of the edited row
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */

// router.post('/edit_cluster', JsonController.EditCluster);

/**
 * @swagger
 * /api/delete_cluster:
 *   post:
 *     summary: Delete a cluster
 *     description: |
 *       Deletes a cluster based on the provided details and returns information about the deletion status.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *                 description: The name of the file for which the cluster is being deleted.
 *               key:
 *                 type: object
 *                 properties:
 *                   parent_id:
 *                     type: string
 *                     description: The parent ID for the cluster being deleted.
 *                   uniqueId:
 *                     type: string
 *                     description: The unique ID for the cluster being deleted.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Object deleted successfully."
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */

// router.post('/delete_cluster', JsonController.DeleteCluster);

/**
 * @swagger
 * /api/user_login:
 *   post:
 *     summary: User login
 *     description: |
 *       Authenticates a user based on the provided email and password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email of the user for login.
 *               password:
 *                 type: string
 *                 description: The password of the user for login.
 *     responses:
 *       '200':
 *         description: Successful login
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "User authenticated successfully."
 *               token: "jwt_token_here"
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid email or password."
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */

router.post('/user_login', UserController.UserLogin);
router.post('/createAzure_user', UserController.CreateAzureuser);
router.post('/get_user_details', UserController.get_user_data);



 

/**
 * @swagger
 * /api/store_user_lock:
 *   post:
 *     summary: Store user lock information
 *     description: |
 *       Stores user lock information based on the provided email and filename.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email of the user for whom the lock information is being stored.
 *               filename:
 *                 type: string
 *                 description: The name of the file for which the user is being locked.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "User lock information stored successfully."
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */

// router.post('/store_user_lock', UserController.storeUserDetails);
/**
 * @swagger
 * /api/delete_user_lock:
 *   post:
 *     summary: Delete user lock information
 *     description: |
 *       Deletes user lock information based on the provided email and filename.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email of the user for whom the lock information is being deleted.
 *               filename:
 *                 type: string
 *                 description: The name of the file for which the user lock is being deleted.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "User lock information deleted successfully."
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */


// router.post('/delete_user_lock', UserController.deleteUserDetails);

/**
 * @swagger
 * /api/approve_file_list:
 *   get:
 *     summary: Get a list of files pending approval
 *     description: |
 *       Retrieves a list of files that are pending approval.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               - "AORT"
 *               - "JNJ"
 *               # Add more files as needed
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */

// router.get('/approve_file_list', ApproveController.getApproveFileNameListing);
/**
 * @swagger
 * /api/get_approve_file_data:
 *   post:
 *     summary: Get approved file data
 *     description: |
 *       Retrieves data for an approved file based on the provided filename.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *                 description: The name of the approved file for which data is being retrieved.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               - ManufacturerId: 154426
 *                 ManufacturerCatalogNumber: "AV0015MM"
 *                 ItemDescription: "VALVE AORTIC 15MM W/CONDUIT"
 *                 Group: "Preservation Services"
 *                 Company: "Artivion, Inc"
 *                 # Add more properties as needed
 *               - ManufacturerId: 154426
 *                 ManufacturerCatalogNumber: "AV0015MM"
 *                 ItemDescription: "VALVE AORTIC 15MM W/CONDUIT"
 *                 Group: "Preservation Services"
 *                 Company: "Artivion, Inc"
 *                 # Add more properties as needed
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */

// router.post('/get_approve_file_data', ApproveController.getApproveFileData);
/**
 * @swagger
 * /api/download_blobs:
 *   get:
 *     summary: Download blobs
 *     description: |
 *       Downloads blobs and returns the corresponding data.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               # Add the example data for successful response if applicable
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */

// router.get('/download_blobs', DataHelperController.DownloadBlobs);

/**
 * @swagger
 * /api/upload_all_blobs:
 *   post:
 *     summary: Upload all blobs
 *     description: |
 *       Uploads all blobs and returns information about the upload status.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Blobs uploaded successfully."
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */

// router.post('/upload_all_blobs', DataHelperController.UploadAllBlobs);

/**
 * @swagger
 * /api/single_blob_upload:
 *   post:
 *     summary: Upload a single blob
 *     description: |
 *       Uploads a single blob for the specified filename and returns information about the upload status.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *                 description: The name of the file for which a blob is being uploaded.
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Single blob uploaded successfully."
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid request payload"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Internal Server Error"
 */

// router.post('/single_blob_upload', DataHelperController.UploadSingleBlob);


// router.post('/single_blob_upload', DataHelperController.UploadSingleBlob);

router.post('/save_role', RoleController.SaveRole);
router.get('/get_all_roles', RoleController.GetAllRoles);
router.get('/delete_roles', RoleController.DeleteRole);

router.post('/get_file_data', JsonController.getFileData);//done

router.post('/add_edit_copy_cluster', JsonController.addAndeditData);
router.post('/delete_cluster', JsonController.deleteCluster);

router.post('/save_approve_cluster', JsonController.saveAndApproveCluster);//done
router.post('/approve_exact_data', JsonController.approveExactData);

router.post('/check_data', JsonController.checkDataInfile);
router.post('/approve_file_list', JsonController.ApproveFileName);
router.post('/approve_batches_list', JsonController.ApproveBatchesList);

router.post('/get_approve_file_data', JsonController.ApproveFiledata);

router.post('/store_user_lock', JsonController.storeUserDetails);
router.post('/delete_user_lock', JsonController.deleteUserDetails);
router.post('/edit_exact_data', JsonController.editExactData);



router.post('/approve_single_ticker', RefeshController.ApproveSingleTicker);

router.post('/disapprove_single_ticker', RefeshController.DisapproveApproveTicker);


router.post('/data_refesh_ticker_data', RefeshController.tickerListingCountdata);


router.post('/data_refesh_ticker_listing', RefeshController.tickernameListing);
router.post('/cancleExactData', JsonController.cancleExactData);
router.post('/logout', JsonController.logout);
router.post('/edit_approve_data', JsonController.editApproveData);
router.get('/get_all_tickers', company.get_all_tickers);
router.post('/save_action_data', clusterdatasLogs.save_action_data);
router.post('/Aprroved_matches_logs', approvedMatches_Logs.aprroved_matches_logs);
router.post('/eventsHistory', eventsHistory_model.eventsHistory);
router.post('/omi_batch', OmiController.OmiController_one);
router.post('/adding_batchId', OmiController.adding_batch);
// update a created_date s
router.get('/Update_createdDate', OmiController.Update_createdDate);



// ------------------------Start Dashboard Data APIs---------------------

// router.post('/get_dashboard_data', dashboardData.get_dashboard_data);
router.post('/get_dashboard_data_v1', dashboardData.get_dashboard_data_v1);
router.post('/get_dashboard_data_v2', dashboardData.get_dashboard_data_v2);

// grid popup API's

router.post('/get_unique_ticker_all_company', dashboardData.get_unique_ticker_allcompany);
router.post('/get_batch_name_with_ticker', dashboardData.get_batch_name_with_ticker);

router.get('/get_users_listing', dashboardData.get_users_listing);


router.post('/get_All_Companies_grid_Data', dashboardData.get_All_Companies_grid_Data);
router.post('/Total_Records_grid', dashboardData.Total_Records_grid);
router.post('/get_approved_listing', dashboardData.get_approved_listing);
router.post('/get_fill_all_Percentage', dashboardData.get_fill_all_Percentage);
router.post('/Active_Batches', dashboardData.Active_Batches);
router.post('/Published_Records', dashboardData.Published_Records);
router.post('/User_Analytics', dashboardData.User_Analytics);








// ----------------------End Dashboard Data APIs-------------------------

// MSSql routes
router.post('/get_tickert_data', current_mapping.get_alldata_from_current_mapping);
// router.get('/get_all_tickers', company.get_all_tickers);
// MSSql routes
// router.post('/get_tickert_data', current_mapping.get_alldata_from_current_mapping);



// one time hit api routes

router.get('/adding_batchId_one', addingbatchController.adding_batch);
router.get('/change_date', addingbatchController.change_date);
router.get('/update_batch_approved', addingbatchController.Update_batch_for_approved);
router.get('/update_status_Approve',addingbatchController.Update_status_Approve)

// 2024-06-26T12:21:36.306Z

module.exports = router;
