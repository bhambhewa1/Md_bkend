const InputDataModel = require("../model/InputDataModel");
const ClusterDataModel = require("../model/ClusterDataModel");
const ApproveClusterDataModel = require("../model/ApproveModel");
const CompaniesModel = require("../model/CompaniesModel");
const CompanyLockModel = require("../model/CompanyLockModel");
const CompanyModel = require("../model/CompanyModel");
const CommonFunction = require("../middleware/CommonFunction");
const BatchesHistory = require("../model/batchesHistory");
const userModel = require("../model/userModel");
const MasterDatasetModel = require("../model/master_dataset");

// Lock flag for the API
let isTransferDataInProgress = false; 

const JsonController = {
  transferData: async (req, res) => {
    if (isTransferDataInProgress) {
      return res.status(429).json({ message: 'Another request is in progress, unable to proceed.' });
    }

    isTransferDataInProgress = true; // Set the lock to proceed a request
    try {
      try {
        // Get all data from InputDataModel
        const inputDatas = await InputDataModel.find({});
        // Loop through each input data
        for (const inputData of inputDatas) {
          const { created_date, ticker } = inputData._doc;

          // Check if the created_date and ticker combination exists in ClusterDataModel
          const clusterExists = await ClusterDataModel.exists({
            created_date,
            ticker,
          });

          // Attempt to update the existing record or create a new one if it doesn't exist
          const updateResult = await MasterDatasetModel.updateOne(
            { created_date },
            {
              $inc: { total_records: 1 },
              $setOnInsert: { total_company: clusterExists ? 0 : 1 },
            },
            { upsert: true, new: true } // Create a new record if it doesn't exist
          );

          if (updateResult.nModified === 0 && updateResult.upserted) {
            // The document was inserted, not updated
            console.log(
              `Created new MasterDatasetModel for created_date: ${created_date}`
            );
          } else if (updateResult.nModified > 0) {
            // The document was updated
            // Check if the record needs to update total_company
            const existingMasterRecord = await MasterDatasetModel.findOne({
              created_date,
            });

            if (!clusterExists && existingMasterRecord.total_company === 0) {
              await MasterDatasetModel.updateOne(
                { created_date },
                { $inc: { total_company: 1 } }
              );
            }
          }
        }
      } catch (error) {
        console.error("Error:", error);
      }

      // ########################################### End MasterDataSet ###########################################3

      // Aggregate to get unique created_dates with tickers

      const uniqueDatesTickers = await InputDataModel.aggregate([
        {
          // Project the necessary fields
          $project: {
            created_date: 1,
            ticker: 1,
          },
        },
        {
          // Group by both created_date and ticker to remove duplicates
          $group: {
            _id: { created_date: "$created_date", ticker: "$ticker" },
            created_date: { $first: "$created_date" },
            ticker: { $first: "$ticker" },
          },
        },
        {
          // Project the final pairs in the desired format
          $project: {
            _id: 0,
            created_date: 1,
            ticker: 1,
          },
        },
      ]);


      // Loop through the unique (created_date, ticker pairs) and now breaking their into batches
      let errObject;
      for (const { created_date, ticker } of uniqueDatesTickers) {
        // console.log("uniqueDatesTickers: ",created_date, ticker)
        const error = await CommonFunction.FillBatchesHistory(created_date, ticker);
        if (error?.err) {
          errObject = error?.err;
          break;
        }
      }
      if (errObject) {
        return res.status(404).json({ message: errObject });
      }

      res.status(200).json({ message: "Records transferred successfully" });
    } catch (err) {
      console.error("Error transferring data:", err);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      isTransferDataInProgress = false; // Release the lock
    }
  },

  getFileNameListing: async (req, res) => {
    const { categoryFlag } = req.body;
    try {
      const data = await ClusterDataModel.find({});
      const tickerNames = [];

      data.forEach((item) => {
        const jsonData = item.data;
        if (jsonData.category_flag === categoryFlag) {
          tickerNames.push(jsonData.ticker);
        }
      });

      const uniquetickerNames = [...new Set(tickerNames)];

      uniquetickerNames.sort();

      res.status(200).json(uniquetickerNames);
    } catch (error) {
      console.error("Error fetching ticker names:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getBatchNameListing: async (req, res) => {
    const { categoryFlag, ticker } = req.body;
    try {
      const data = await ClusterDataModel.find(
        { "data.ticker": ticker, "data.category_flag": categoryFlag },
        { _id: 0, batchId: 1 }
      ).lean();

      const batchIds = data.map((item) => item.batchId);

      // Find unique batchIds
      const uniqueBatchIds = [...new Set(batchIds.map((id) => id.toString()))];

      // Find batch names for unique batchIds
      const batchNameList = await BatchesHistory.find(
        { batchId: { $in: uniqueBatchIds }, is_active: 1 },
        { _id: 0, batchId: 1, batchName: 1 }
      ).lean();
      // .then((batches) => batches.map((batch) => batch.batchName));

      // console.log("my rwst", batchNameList)
      // const result = await ClusterDataModel.aggregate([
      //     {
      //       $match: { "data.ticker": ticker, "data.category_flag": categoryFlag }
      //     },
      //     {
      //       $group: {
      //         _id: null,
      //         uniqueBatchIds: { $addToSet: "$batchId" }
      //       }
      //     },
      //     {
      //       $project: {
      //         _id: 0,
      //         uniqueBatchIds: 1
      //       }
      //     },
      //     {
      //       $lookup: {
      //         from: "BatchesHistory", // The collection name of BatchesHistoryModel
      //         localField: "uniqueBatchIds",
      //         foreignField: "batchId",
      //         as: "batchInfo"
      //       }
      //     },
      //     {
      //       $unwind: "$batchInfo"
      //     },
      //     {
      //       $match: {
      //         "batchInfo.is_active": 1
      //       }
      //     },
      //     {
      //       $group: {
      //         _id: null,
      //         batchNames: { $addToSet: "$batchInfo.batchname" }
      //       }
      //     },
      //     {
      //       $project: {
      //         _id: 0,
      //         batchNames: 1
      //       }
      //     }
      //   ]);

      //   const activeBatchNames = result.length > 0 ? result[0].batchNames : [];
      //   console.log(activeBatchNames);

      res.status(200).json(batchNameList);
    } catch (error) {
      console.error("Error fetching ticker names:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getFileData: async (req, res) => {
    const {
      filename,
      email,
      batchId,
      category_flag,
      ManufacturerCatalogNumber,
    } = req.body;

    try {
      const user = await userModel.findOne({ email }).select("_id");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const userId = user._id;
      const batchData = await BatchesHistory.findOne({ batchId });
      if (!batchData) {
        return res.status(404).json({ error: "Batch not found" });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = 10;

      const companyLock = await CompanyLockModel.findOne({
        company_name: filename,
        category_flag: category_flag,
        batchId: batchId,
        is_Open: "true",
      });

      // console.log("this company is locked ", companyLock)

      // if (!companyLock) {
      //     return res.status(404).json({ error: 'No lock found for the provided filename, category_flag, batchId, and userId.' });
      // }

      if (companyLock && companyLock.email !== email) {
        return res
          .status(403)
          .json({
            error: `${batchData?.batchName} is locked by ${companyLock?.name} for ${companyLock?.company_name}.`,
          });
      }

      let query = {
        "data.ticker": filename,
        batchId: batchId,
      };
      if (category_flag) {
        query["data.category_flag"] = category_flag;
      }

      if (ManufacturerCatalogNumber === true) {
        query["data.ManufacturerCatalogNumber"] = { $exists: true };
      }

      const totalCount = await ClusterDataModel.countDocuments(query);
      const skip = (page - 1) * limit;

      let sortOptions = {};
      if (ManufacturerCatalogNumber === true) {
        sortOptions["data.ManufacturerCatalogNumber"] = -1;
      } else {
        sortOptions["data.ManufacturerCatalogNumber"] = 1;
      }

      const data = await ClusterDataModel.find(query)
        .collation({ locale: "en", strength: 2 })
        .skip(skip)
        .limit(limit)
        .sort(sortOptions);

      if (!data || data.length === 0) {
        return res
          .status(404)
          .json({
            message: "Records not found. Please go to the update data screen.",
          });
      }

      const populateChildObjects = (parentData, childPoints) => {
        const {
          ManufacturerId,
          ItemDescription,
          ManufacturerCatalogNumber,
          Company,
        } = parentData;
        return Array.isArray(childPoints)
          ? childPoints.map((point) => ({
            ManufacturerId: point.ManufacturerId || ManufacturerId,
            ItemDescription: point.ItemDescription || ItemDescription,
            ManufacturerCatalogNumber:
              point.ManufacturerCatalogNumber || ManufacturerCatalogNumber,
            Company: point.Company || Company,
            ...point,
          }))
          : {
            ManufacturerId: childPoints.ManufacturerId || ManufacturerId,
            ItemDescription: childPoints.ItemDescription || ItemDescription,
            ManufacturerCatalogNumber:
              childPoints.ManufacturerCatalogNumber ||
              ManufacturerCatalogNumber,
            Company: childPoints.Company || Company,
            ...childPoints,
          };
      };

      const tickerData = data.map((item) => {
        const { _id, data, ...rest } = item.toObject();

        if (Array.isArray(data.Exact_point)) {
          data.Exact_point = populateChildObjects(data, data.Exact_point);
        } else if (data.Exact_point) {
          data.Exact_point = populateChildObjects(data, data.Exact_point);
        }

        if (Array.isArray(data.Clustered_point)) {
          data.Clustered_point = populateChildObjects(
            data,
            data.Clustered_point
          );
        } else if (data.Clustered_point) {
          data.Clustered_point = populateChildObjects(
            data,
            data.Clustered_point
          );
        }

        return {
          _id: _id.toString(),
          data: { ...data },
          ...rest,
        };
      });

      const totalPages = Math.ceil(totalCount / limit);

      res.status(200).json({
        tickerData,
        pagination: {
          totalCount,
          totalPages,
          rowperpage: limit,
          currentPage: page,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error(
        "Error fetching data by filename and category_flag:",
        error
      );
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // working
  // getFileData: async (req, res) => {

  //     const { filename, email, batchId, category_flag, ManufacturerCatalogNumber } = req.body;

  //     try {
  //         const user = await userModel.findOne({ email }).select('_id');
  //         if (!user) {
  //             return res.status(404).json({ error: 'User not found' });
  //         }
  //         const userId = user._id;

  //         const page = parseInt(req.query.page) || 1;
  //         const limit = 10;

  //         const companyLock = await CompanyLockModel.findOne({
  //             company_name: filename,
  //             category_flag: category_flag,
  //             batchId: batchId,
  //             // email: email,
  //             is_Open: "true",
  //         });

  //         console.log("this company is locked ", companyLock)

  //         // if (!companyLock) {
  //         //     return res.status(404).json({ error: 'No lock found for the provided filename, category_flag, batchId, and userId.' });
  //         // }

  //         if (companyLock && companyLock.email !== email) {
  //             return res.status(403).json({ error: `This Company is locked by ${companyLock.name}.` });
  //         }

  //         let query = {
  //             "data.ticker": filename,
  //             batchId: batchId,
  //             // userId: userId
  //         };
  //         if (category_flag) {
  //             query["data.category_flag"] = category_flag;
  //         }

  //         if (ManufacturerCatalogNumber === true) {
  //             query["data.ManufacturerCatalogNumber"] = { $exists: true };
  //         }

  //         const totalCount = await ClusterDataModel.countDocuments(query);
  //         const skip = (page - 1) * limit;

  //         let sortOptions = {};
  //         if (ManufacturerCatalogNumber === true) {
  //             sortOptions["data.ManufacturerCatalogNumber"] = -1;
  //         } else {
  //             sortOptions["data.ManufacturerCatalogNumber"] = 1;
  //         }

  //         const data = await ClusterDataModel.find(query)
  //             .collation({ locale: "en", strength: 2 })
  //             .skip(skip)
  //             .limit(limit)
  //             .sort(sortOptions);

  //         if (!data || data.length === 0) {
  //             return res.status(404).json({ message: "Records not found. Please go to the update data screen." });
  //         }

  //         const tickerData = data.map((item) => {
  //             const { _id, ...rest } = item.toObject();
  //             return { _id: _id.toString(), ...rest };
  //         });

  //         const totalPages = Math.ceil(totalCount / limit);

  //         res.status(200).json({
  //             tickerData,
  //             pagination: {
  //                 totalCount,
  //                 totalPages,
  //                 rowperpage: limit,
  //                 currentPage: page,
  //                 hasNextPage: page < totalPages,
  //                 hasPrevPage: page > 1,
  //             },
  //         });
  //     } catch (error) {
  //         console.error("Error fetching data by filename and category_flag:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  // getFileData: async (req, res) => {
  //     const { filename, email,batchId, category_flag, ManufacturerCatalogNumber } =
  //         req.body;

  //         const user = await userModel.findOne({ email }).select('_id');
  //         let userId = user._id

  //     const page = parseInt(req.query.page) || 1;
  //     const limit = 10;

  //     try {
  //         const companyLock = await CompanyLockModel.findOne({
  //             company_name: filename,
  //             category_flag: category_flag,
  //             batchId:batchId,
  //             userId:userId,
  //             is_Open: "true",
  //         });

  //         if (!companyLock) {
  //             // return res.status(404).json({ error: 'No lock found for the provided filename and category_flag.' });
  //         }

  //         if (companyLock && companyLock.email !== email) {
  //             const companyLockUser = await CompanyLockModel.findOne({
  //                 company_name: filename,
  //                 category_flag: category_flag,
  //                 batchId:batchId,
  //                 userId:userId,
  //                 is_Open: true,
  //             });
  //             return res
  //                 .status(403)
  //                 .json({ error: `This Company is locked by ${companyLockUser.name}` });
  //         }

  //         let query = { "data.ticker": filename };
  //         if (category_flag) {
  //             query["data.category_flag"] = category_flag;
  //         }

  //         if (ManufacturerCatalogNumber === true) {
  //             query["data.ManufacturerCatalogNumber"] = { $exists: true };
  //         }

  //         const totalCount = await ClusterDataModel.countDocuments(query);
  //         const skip = (page - 1) * limit;

  //         let sortOptions = {};

  //         if (ManufacturerCatalogNumber === true) {
  //             sortOptions["data.ManufacturerCatalogNumber"] = -1;
  //         } else {
  //             sortOptions["data.ManufacturerCatalogNumber"] = 1;
  //         }

  //         const data = await ClusterDataModel.find(query)
  //             .collation({ locale: "en", strength: 2 })
  //             .skip(skip)
  //             .limit(limit)
  //             .sort(sortOptions);

  //         if (!data || data.length === 0) {
  //             return res
  //                 .status(404)
  //                 .json({
  //                     message: "Data not found , Please go to update data screen.",
  //                 });
  //         }

  //         const tickerData = data.map((item) => {
  //             const { _id, ...rest } = item.toObject();
  //             return { _id: _id.toString(), ...rest };
  //         });

  //         const totalPages = Math.ceil(totalCount / limit);

  //         res.status(200).json({
  //             tickerData,
  //             pagination: {
  //                 totalCount,
  //                 totalPages,
  //                 rowperpage: limit,
  //                 currentPage: page,
  //                 hasNextPage: page < totalPages,
  //                 hasPrevPage: page > 1,
  //             },
  //         });
  //     } catch (error) {
  //         console.error(
  //             "Error fetching data by filename and category_flag:",
  //             error
  //         );
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  deleteCluster: async (req, res) => {
    const { obj_id, uniqueId } = req.body;
    try {
      const document = await ClusterDataModel.findById(obj_id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const data = document.data;
      let clusterPoints = data.Clustered_point || data.Exact_point;

      if (!clusterPoints) {
        return res.status(404).json({
          message:
            "Neither clustered_point nor exact_point found in the document",
        });
      }

      const indexToDelete = clusterPoints.findIndex(
        (item) => item.uniqueId === parseInt(uniqueId)
      );
      if (indexToDelete === -1) {
        return res.status(404).json({
          message: "Item with the provided uniqueId not found",
          clusterPoints: clusterPoints,
        });
      }
      clusterPoints.splice(indexToDelete, 1);
      document.markModified("data");
      await document.save();

      res.status(200).json({
        message: "Record deleted successfully",
        clusterPoints: clusterPoints,
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  addAndeditData: async (req, res) => {
    const { obj_id, uniqueId, action, details } = req.body;

    try {
      let document = await ClusterDataModel.findById(obj_id);

      if (!document) {
        document = new ClusterDataModel({ _id: obj_id, data: {} });
      }

      const data = document.data || {};
      let clusteredPoints = data.Clustered_point || data.Exact_point || [];

      if (!clusteredPoints && action !== "add") {
        return res.status(404).json({
          message:
            "Neither clustered_point nor exact_point found in the document",
        });
      }

      if (action === "copy") {
        const itemToCopy = clusteredPoints.find(
          (item) => item.uniqueId === uniqueId
        );
        if (itemToCopy) {
          const newUniqueId =
            Math.max(...clusteredPoints.map((item) => item.uniqueId)) + 1;
          clusteredPoints.push({
            ...itemToCopy,
            uniqueId: newUniqueId,
            ...details,
          });
        } else {
          return res
            .status(404)
            .json({ message: "Item with provided uniqueId not found" });
        }
      } else if (action === "add") {
        const maxUniqueId = clusteredPoints.reduce(
          (max, item) => (item.uniqueId > max ? item.uniqueId : max),
          0
        );
        const newUniqueId = maxUniqueId + 1;
        clusteredPoints.push({ ...details, uniqueId: newUniqueId });
      } else if (action === "edit") {
        const index = clusteredPoints.findIndex(
          (item) => item.uniqueId === uniqueId
        );
        if (index !== -1) {
          clusteredPoints[index] = { ...clusteredPoints[index], ...details };
        } else {
          return res
            .status(404)
            .json({ message: "Item with provided uniqueId not found" });
        }
      } else {
        return res.status(400).json({ message: "Invalid action" });
      }

      if (data.Clustered_point) {
        data.Clustered_point = clusteredPoints;
      } else if (data.Exact_point) {
        data.Exact_point = clusteredPoints;
      }

      document.markModified("data");
      await document.save();

      const message =
        action === "edit"
          ? "Records updated successfully"
          : "Records added successfully";
      return res.status(200).json({ message, clusteredPoints });
    } catch (error) {
      console.error("Error updating data:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  saveAndApproveCluster: async (req, res) => {
    const { obj_id, uniqueId, action, details, created_date, batchId, email } = req.body;
    const user = await userModel.findOne({ email }).select("_id");
    let userId = user._id;

    try {
      let document = await ClusterDataModel.findById(obj_id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const data = document.data || {};
      const clusteredPoints = data.Clustered_point || data.Exact_point || [];

      if (action === "saveAndApprove") {
        if (!uniqueId) {
          details.created_date = created_date;
          const maxUniqueId = clusteredPoints.reduce(
            (max, item) => (item.uniqueId > max ? item.uniqueId : max),
            0
          );
          const newUniqueId = maxUniqueId + 1;
          clusteredPoints.push({ ...details, uniqueId: newUniqueId });
        } else {
          const index = clusteredPoints.findIndex(
            (item) => item.uniqueId === uniqueId
          );
          if (index !== -1) {
            clusteredPoints[index] = { ...clusteredPoints[index], ...details };
          } else {
            return res
              .status(404)
              .json({ message: "Item with provided batchId or uniqueId not found" });
          }
        }

        data.Clustered_point = clusteredPoints;
        document.markModified("data");
        await document.save();
        const { ticker, category_flag } = document.data || {};
        details.ticker = ticker;
        details.category_flag = category_flag;
        details.batchId = batchId;
        details.userId = userId;

        const approvedDocument = new ApproveClusterDataModel(details);

        await approvedDocument.save();
        await ClusterDataModel.deleteOne({ _id: obj_id });

        // Ensure total_approved is set to 0 if it is null
        await BatchesHistory.updateOne(
          { batchId: batchId, total_approved: null },
          { $set: { total_approved: 0 } }
        );

        // Increment total_approved in BatchesHistory
        const batchDocument = await BatchesHistory.findOneAndUpdate(
          { batchId: batchId },
          { $inc: { total_approved: 1 } },
          { new: true }
        );

        // Check if total_records equals total_approved
        if (batchDocument.total_records === batchDocument.total_approved) {
          batchDocument.batchEndDate = new Date();
          batchDocument.is_active = 0
          await batchDocument.save();
        }

        return res
          .status(200)
          .json({ message: "Records saved and approved successfully" });
      } else if (action === "approve") {
        if (!document.data) {
          return res
            .status(404)
            .json({ message: "Records not found for approval" });
        }

        const clusteredPoint = clusteredPoints.find(
          (point) => point.uniqueId === uniqueId
        );

        if (!clusteredPoint) {
          return res
            .status(404)
            .json({ message: "Clustered point not found for approval" });
        }

        const { ticker, category_flag } = document.data || {};

        clusteredPoint.ticker = ticker;
        clusteredPoint.category_flag = category_flag;
        clusteredPoint.approvel_status = 1;
        clusteredPoint.batchId = batchId;
        clusteredPoint.userId = userId;
        const approvedDocument = new ApproveClusterDataModel(clusteredPoint);
        await approvedDocument.save();

        await ClusterDataModel.deleteOne({ _id: obj_id });

        // Ensure total_approved is set to 0 if it is null
        await BatchesHistory.updateOne(
          { batchId: batchId, total_approved: null },
          { $set: { total_approved: 0 } }
        );

        // Increment total_approved in BatchesHistory
        const batchDocument = await BatchesHistory.findOneAndUpdate(
          { batchId: batchId },
          { $inc: { total_approved: 1 } },
          { new: true }
        );

        // Check if total_records equals total_approved
        if (batchDocument.total_records === batchDocument.total_approved) {
          batchDocument.batchEndDate = new Date();
          batchDocument.is_active = 0
          await batchDocument.save();
        }

        return res.status(200).json({
          message: "Records approved and moved to approved table successfully",
        });
      } else {
        res.status(500).json({ error: "Invalid Action Pass!" });
      }
    } catch (error) {
      console.error("Error saving and approving data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },


  // saveAndApproveCluster: async (req, res) => {
  //   const { obj_id, uniqueId, action, details, created_date, batchId, email } =
  //     req.body;
  //   const user = await userModel.findOne({ email }).select("_id");
  //   let userId = user._id;

  //   try {
  //     let document = await ClusterDataModel.findById(obj_id);

  //     if (!document) {
  //       return res.status(404).json({ message: "Document not found" });
  //     }

  //     const data = document.data || {};
  //     const clusteredPoints = data.Clustered_point || data.Exact_point || [];

  //     if (action === "saveAndApprove") {
  //       if (!uniqueId) {
  //         details.created_date = created_date;
  //         const maxUniqueId = clusteredPoints.reduce(
  //           (max, item) => (item.uniqueId > max ? item.uniqueId : max),
  //           0
  //         );
  //         const newUniqueId = maxUniqueId + 1;
  //         clusteredPoints.push({ ...details, uniqueId: newUniqueId });
  //       } else {
  //         const index = clusteredPoints.findIndex(
  //           (item) => item.uniqueId === uniqueId
  //         );
  //         if (index !== -1) {
  //           clusteredPoints[index] = { ...clusteredPoints[index], ...details };
  //         } else {
  //           return res
  //             .status(404)
  //             .json({
  //               message: "Item with provided batchId or uniqueId not found",
  //             });
  //         }
  //       }

  //       data.Clustered_point = clusteredPoints;
  //       document.markModified("data");
  //       await document.save();
  //       const { ticker, category_flag } = document.data || {};
  //       details.ticker = ticker;
  //       details.category_flag = category_flag;
  //       details.batchId = batchId;
  //       details.userId = userId;

  //       const approvedDocument = new ApproveClusterDataModel(details);

  //       await approvedDocument.save();
  //       await ClusterDataModel.deleteOne({ _id: obj_id });

  //       return res
  //         .status(200)
  //         .json({ message: "Records saved and approved successfully" });
  //     } else if (action === "approve") {
  //       if (!document.data) {
  //         return res
  //           .status(404)
  //           .json({ message: "Records not found for approval" });
  //       }

  //       const clusteredPoint = clusteredPoints.find(
  //         (point) => point.uniqueId === uniqueId
  //       );

  //       if (!clusteredPoint) {
  //         return res
  //           .status(404)
  //           .json({ message: "Clustered point not found for approval" });
  //       }

  //       const { ticker, category_flag } = document.data || {};

  //       clusteredPoint.ticker = ticker;
  //       clusteredPoint.category_flag = category_flag;
  //       clusteredPoint.approvel_status = 1;
  //       clusteredPoint.batchId = batchId;
  //       clusteredPoint.userId = userId;
  //       const approvedDocument = new ApproveClusterDataModel(clusteredPoint);
  //       await approvedDocument.save();

  //       await ClusterDataModel.deleteOne({ _id: obj_id });

  //       return res.status(200).json({
  //         message: "Records approved and moved to approved table successfully",
  //       });
  //     } else {
  //       res.status(500).json({ error: "Invalid Action Pass!" });
  //     }
  //   } catch (error) {
  //     console.error("Error saving and approving data:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // },

  checkDataInfile: async (req, res) => {
    try {
      const count = await ClusterDataModel.estimatedDocumentCount();
      const count1 = await InputDataModel.estimatedDocumentCount();

      if (count === 0 && count1 !== 0) {
        res.status(200).json({ status: 1, message: "Table is empty" });
      } else {
        res.status(200).json({ status: 0, message: "Table has data" });
      }
    } catch (error) {
      console.error("Error checking data in files:", error);
      res.status(500).json({ status: 500, error: "Internal server error" });
    }
  },

  ApproveFileName: async (req, res) => {
    try {
      // Find all documents and project only the 'ticker' field
      const data = await ApproveClusterDataModel.find(
        { published: { $exists: false } },
        { ticker: 1, _id: 0 }
      ).lean();
      // Extract the ticker values
      const tickers = data.map((item) => item.ticker);

      // Remove duplicates and sort the ticker values alphabetically
      const uniqueTickers = Array.from(new Set(tickers)).sort();

      // Send the sorted, unique tickers as a response
      res.status(200).json(uniqueTickers);
    } catch (error) {
      console.error("Error fetching ticker names:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // approve by category flag
  // ApproveFileName: async (req, res) => {
  //     try {
  //         const { category_flag } = req.body;

  //         // Initialize the query object
  //         let query = {};

  //         // If category_flag is not "ALL", add the condition to the query
  //         if (category_flag !== "All") {
  //             query.category_flag = category_flag;
  //         }

  //         const data = await ApproveClusterDataModel.find(query);

  //         const tickerNames = [];

  //         data.forEach((item) => {
  //             const jsonData = item;

  //             if (jsonData.ticker !== null) {
  //                 tickerNames.push(jsonData.ticker);
  //             }
  //         });

  //         const uniqueTickerNames = [...new Set(tickerNames)];

  //         // Sort the unique ticker names alphabetically
  //         uniqueTickerNames.sort();

  //         res.status(200).json(uniqueTickerNames);
  //     } catch (error) {
  //         console.error("Error fetching ticker names:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  // ApproveFileName: async (req, res) => {
  //     try {
  //         const { category_flag } = req.body;
  //         const data = await ApproveClusterDataModel.find({
  //             category_flag: category_flag,
  //         });

  //         const tickerNames = [];

  //         data.forEach((item) => {
  //             const jsonData = item;

  //             if (jsonData.ticker !== null) {
  //                 tickerNames.push(jsonData.ticker);
  //             }
  //         });

  //         const uniqueTickerNames = [...new Set(tickerNames)];

  //         // Sort the unique ticker names alphabetically
  //         uniqueTickerNames.sort();

  //         res.status(200).json(uniqueTickerNames);
  //     } catch (error) {
  //         console.error("Error fetching ticker names:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  // ApproveBatchesList: async (req, res) => {
  //     try {
  //         const { ticker, category_flag } = req.body;
  //         let query = { ticker: ticker };
  //         if (category_flag && category_flag !== "All") {
  //             query["category_flag"] = category_flag;
  //         }

  //         const data = await ApproveClusterDataModel.find(query, { _id: 0, batchId: 1 }).lean();
  //         const batchIds = data.map((item) => item.batchId);

  //         // Find unique batchIds
  //         const uniqueBatchIds = [...new Set(batchIds.map((id) => id.toString()))];

  //         // Find batch names for unique batchIds
  //         const batchNameList = await BatchesHistory.find(
  //             { batchId: { $in: uniqueBatchIds }, is_active: 1 },
  //             { _id: 0, batchId: 1, batchName: 1 }
  //         )
  //             .lean()

  //         // Sort the unique ticker names alphabetically
  //         // uniqueTickerNames.sort();

  //         // console.log("batches",batchNameList)

  //         res.status(200).json(batchNameList);
  //     } catch (error) {
  //         console.error("Error fetching ticker names:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  // AM

  // ApproveBatchesList: async (req, res) => {
  //     try {
  //         const { ticker, category_flag } = req.body;
  //         let query = { ticker: ticker };

  //         if (category_flag && category_flag !== "All") {
  //             query["category_flag"] = category_flag;
  //         }

  //         const data = await ApproveClusterDataModel.find(query, { _id: 0, batchId: 1 }).lean();
  //         console.log(data)
  //         if (!data || data.length === 0) {
  //             return res.status(404).send("Batch not found");
  //         }

  //         const batchIds = data.map((item) => item.batchId);

  //         // Find unique batchIds
  //         const uniqueBatchIds = [...new Set(batchIds.map((id) => id.toString()))];

  //         // Find batch names for unique batchIds
  //         const batchNameList = await BatchesHistory.find(
  //             { batchId: { $in: uniqueBatchIds }, is_active: 1 },
  //             { _id: 0, batchId: 1, batchName: 1 }
  //         ).lean();

  //         if (!batchNameList || batchNameList.length === 0) {
  //             return res.status(404).send("No active batches found");
  //         }

  //         res.status(200).json(batchNameList);
  //     } catch (error) {
  //         console.error("Error fetching ticker names:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  // ####################
  // ApproveBatchesList: async (req, res) => {
  //     try {
  //         const { ticker, category_flag } = req.body;
  //         let query = { ticker: ticker };

  //         if (category_flag && category_flag !== "All") {
  //             query["category_flag"] = category_flag;
  //         }

  //         const data = await ApproveClusterDataModel.find(query, { _id: 0, batchId: 1 }).lean();
  //         console.log("dadad", data);

  //         if (Array.isArray(data) && data.every(item => Object.keys(item).length === 0)) {
  //             return res.status(200).send([]);
  //         }

  //         // Continue with your logic if not all elements are empty objects

  //         // const data = await ApproveClusterDataModel.find(query, { _id: 0, batchId: 1 }).lean();
  //         // console.log("dadad",data);

  //         // if (Array.isArray(data) && data.length === 1 && Object.keys(data[0]).length === 0) {
  //         //     return res.status(200).send([]);
  //         // }

  //         // // if (!data || data.length === 0) {
  //         // //     return res.status(200).send([]);
  //         // // }

  //         const batchIds = data.map((item) => item.batchId);

  //         // Find unique batchIds
  //         const uniqueBatchIds = [...new Set(batchIds.map((id) => id.toString()))];

  //         // Find batch names for unique batchIds
  //         const batchNameList = await BatchesHistory.find(
  //             { batchId: { $in: uniqueBatchIds }, is_active: 1 },
  //             { _id: 0, batchId: 1, batchName: 1 }
  //         ).lean();

  //         if (!batchNameList || batchNameList.length === 0) {
  //             return res.status(404).send("No active batches found");
  //         }

  //         res.status(200).json(batchNameList);
  //     } catch (error) {
  //         console.error("Error fetching ticker names:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  ApproveBatchesList: async (req, res) => {
    try {
      const { ticker, category_flag } = req.body;
      let query = { ticker: ticker, published: {$exists: false} };

      if (category_flag && category_flag !== "All") {
        query["category_flag"] = category_flag;
      }

      // Fetch data from ApproveClusterDataModel
      const data = await ApproveClusterDataModel.find(query, {
        _id: 0,
        batchId: 1,
      }).lean();

      // Filter out empty objects
      const validData = data.filter((item) => Object.keys(item).length !== 0);

      if (validData.length === 0) {
        return res.status(200).send([]);
      }

      // Extract batchIds
      const batchIds = validData.map((item) => item.batchId);
      // console.log(batchIds)
      // Find unique batchIds
      const uniqueBatchIds = [...new Set(batchIds.map((id) => id.toString()))];
      console.log(uniqueBatchIds)
      // Fetch batch names for unique batchIds
      const batchNameList = await BatchesHistory.find(
        // { batchId: { $in: uniqueBatchIds }, is_active: 1 },
        { batchId: { $in: uniqueBatchIds } },

        { _id: 0, batchId: 1, batchName: 1 }
      ).lean();

      if (!batchNameList || batchNameList.length === 0) {
        return res.status(404).send({ message: "No active batches found" });
      }

      res.status(200).json(batchNameList);
    } catch (error) {
      console.error("Error fetching ticker names:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // ApproveBatchesList: async (req, res) => {
  //     try {
  //         const { ticker, category_flag } = req.body;

  //         let query = { ticker: ticker };
  //         if (category_flag && category_flag !== "All") {
  //             query["category_flag"] = category_flag;
  //         }

  //         // If category_flag is not "Exact" or "Clustered", return the data based on ticker only
  //         if (category_flag !== "Exact" && category_flag !== "Clustered") {
  //             const dataBothCategory_flag = await ApproveClusterDataModel.find({ ticker }).lean();
  //             return res.status(200).json(dataBothCategory_flag);
  //         }

  //         // Fetch data with the constructed query
  //         let data = await ApproveClusterDataModel.find(query, { _id: 0, batchId: 1 }).lean();

  //         // If no data found, fetch all data without projection
  //         if (data.length === 0) {
  //             data = await ApproveClusterDataModel.find(query).lean();
  //             return res.status(200).json(data);
  //         }

  //         // Filter out empty objects from the data
  //         const filteredData = data.filter(item => Object.keys(item).length !== 0);

  //         // If there are no non-empty objects, fetch all data without projection
  //         if (filteredData.length === 0) {
  //             const dataWithoutBatchId = await ApproveClusterDataModel.find(query).lean();
  //             return res.status(200).json(dataWithoutBatchId);
  //         }

  //         // Extract batchIds from the filtered data
  //         const batchIds = filteredData.map(item => item.batchId);

  //         // Find unique batchIds
  //         const uniqueBatchIds = [...new Set(batchIds.map(id => id.toString()))];

  //         // Find batch names for unique batchIds
  //         const batchNameList = await BatchesHistory.find(
  //             { batchId: { $in: uniqueBatchIds }, is_active: 1 },
  //             { _id: 0, batchId: 1, batchName: 1 }
  //         ).lean();

  //         res.status(200).json(batchNameList);
  //     } catch (error) {
  //         console.error("Error fetching ticker names:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // }

  // abhi
  // ApproveBatchesList: async (req, res) => {

  //     try {
  //         const { ticker, category_flag } = req.body;

  //         // Check if category_flag is valid

  //         let query = { ticker: ticker };
  //         if (category_flag !== "All") {
  //             query["category_flag"] = category_flag;
  //         }

  //         // If category_flag is not "Exact" or "Clustered", return the data based on ticker only
  //         if (category_flag !== "Exact" && category_flag !== "Clustered") {
  //             const dataBothCategory_flag = await ApproveClusterDataModel.find({ ticker }).lean();
  //             return res.status(200).json(dataBothCategory_flag);
  //         }

  //         // Fetch data with the constructed query
  //         let data = await ApproveClusterDataModel.find(query, { _id: 0, batchId: 1 }).lean();
  //         if (!data || data.length === 0) {
  //             return res.status(404).send("Batch not found");
  //         }
  //         // If no data found, fetch all data without projection
  //         if (data.length === 0) {
  //             data = await ApproveClusterDataModel.find(query).lean();
  //             return res.status(200).json(data);
  //         }

  //         // Filter out empty objects from the data
  //         const filteredData = data.filter(item => Object.keys(item).length !== 0);

  //         // If there are no non-empty objects, fetch all data without projection
  //         if (filteredData.length === 0) {
  //             const dataWithoutBatchId = await ApproveClusterDataModel.find(query).lean();
  //             return res.status(200).json(dataWithoutBatchId);
  //         }

  //         // Extract batchIds from the filtered data
  //         const batchIds = filteredData.map(item => item.batchId);

  //         // Find unique batchIds
  //         const uniqueBatchIds = [...new Set(batchIds.map(id => id.toString()))];

  //         // Find batch names for unique batchIds
  //         const batchNameList = await BatchesHistory.find(
  //             { batchId: { $in: uniqueBatchIds }, is_active: 1 },
  //             { _id: 0, batchId: 1, batchName: 1 }
  //         ).lean();

  //         if (!batchNameList || batchNameList.length === 0) {
  //             return res.status(404).send("No active batches found");
  //         }
  //         res.status(200).json(batchNameList);
  //     } catch (error) {
  //         console.error("Error fetching ticker names:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // }

  // ApproveFiledata: async (req, res) => {
  //     const { ticker, category_flag, batchId } = req.body;
  //     const page = parseInt(req.query.page) || 1;
  //     const limit = 10;

  //     try {
  //         let query = { ticker: ticker };
  //         if (batchId !== null) {
  //             query.batchId = batchId;
  //         }
  //         if (category_flag && category_flag !== "All") {
  //             query.category_flag = category_flag;
  //         }

  //         const totalCount = await ApproveClusterDataModel.countDocuments(query);
  //         const skip = (page - 1) * limit;
  //         const data = await ApproveClusterDataModel.find(query)
  //             .skip(skip)
  //             .limit(limit);
  //         if (!data || data.length === 0) {
  //             return res
  //                 .status(404)
  //                 .json({ message: "Records not found for selected options" });
  //         }
  //         const tickerData = data.map((item) => item.toObject());
  //         res.status(200).json({
  //             data: tickerData,
  //             pagination: {
  //                 totalCount,
  //                 totalPages: Math.ceil(totalCount / limit),
  //                 currentPage: page,
  //                 rowPerPage: limit,
  //                 hasNextPage: page * limit < totalCount,
  //                 hasPrevPage: page > 1,
  //             },
  //         });
  //     } catch (error) {
  //         console.error("Error fetching ticker data:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  ApproveFiledata: async (req, res) => {
    const { ticker, category_flag, batchId, search_text } = req.body;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    try {
      let query = { ticker: ticker, published: { $ne: true } };
      if (batchId !== null) {
        query.batchId = batchId;
      }
      if (category_flag && category_flag !== "All") {
        query.category_flag = category_flag;
      }
      if(search_text) {
        // Append search query, regex- matching the string pattern and options-i making the case insensitive
        query.$or = [
          { Model: { $regex: search_text, $options: 'i' } },
          { ProductFamily: { $regex: search_text, $options: 'i' } },
          { ProductCategory: { $regex: search_text, $options: 'i' } },
          { ItemDescription: { $regex: search_text, $options: 'i' } }
        ];
      }
      const totalCount = await ApproveClusterDataModel.countDocuments(query);
      console.log(totalCount)
      const skip = (page - 1) * limit;
      const data = await ApproveClusterDataModel.find(query)
        .skip(skip)
        .limit(limit);
      if (!data || data.length === 0) {
        return res
          .status(404)
          .json({ message: "Records not found for selected options" });
      }
      const tickerData = data.map((item) => item.toObject());
      res.status(200).json({
        data: tickerData,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          rowPerPage: limit,
          hasNextPage: page * limit < totalCount,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching ticker data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // ApproveFiledata: async (req, res) => {
  //     const { ticker, category_flag, batchId} = req.body;
  //     const page = parseInt(req.query.page) || 1;
  //     const limit = 10;

  //     try {
  //         let query = { ticker: ticker, batchId:batchId};
  //         if (category_flag && category_flag !== "All") {
  //             query["category_flag"] = category_flag;
  //         }

  //         const totalCount = await ApproveClusterDataModel.countDocuments(query);
  //         const skip = (page - 1) * limit;
  //         const data = await ApproveClusterDataModel.find(query)
  //             .skip(skip)
  //             .limit(limit);
  //         if (!data || data.length === 0) {
  //             return res
  //                 .status(404)
  //                 .json({ message: "Data not found for selected options" });
  //         }
  //         const tickerData = data.map((item) => item.toObject());
  //         res.status(200).json({
  //             data: tickerData,
  //             pagination: {
  //                 totalCount,
  //                 totalPages: Math.ceil(totalCount / limit),
  //                 currentPage: page,
  //                 rowPerPage: limit,
  //                 hasNextPage: page * limit < totalCount,
  //                 hasPrevPage: page > 1,
  //             },
  //         });
  //     } catch (error) {
  //         console.error("Error fetching ticker data:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  storeUserDetails: async (req, res) => {
    try {
      const { email, company_name, name, category_flag, batchId } = req.body;
      if (!email || !company_name || !name || !category_flag || !batchId) {
        return res.status(400).json({
          success: false,
          error:
            "email, company_name, name, batchId and category_flag are required",
        });
      }

      const currentTime = new Date();
      const timeThreshold = new Date(currentTime - 24 * 60 * 60 * 1000);

      // Check if any record with the same company_name and category_flag has is_Open set to true
      const isFileOpenForCompany = await CompanyLockModel.exists({
        company_name,
        category_flag,
        is_Open: "true",
        batchId,
      });

      const is_Open = !isFileOpenForCompany; // Set is_Open to true if no record found with is_Open=true

      const existingUser = await CompanyLockModel.findOneAndUpdate(
        { email, company_name, category_flag, batchId },
        { $set: { is_Open: !!is_Open, lastAccessed: currentTime } },
        { new: true }
      );

      if (!existingUser) {
        const newUserDetails = new CompanyLockModel({
          email,
          company_name,
          name,
          category_flag,
          batchId,
          is_Open: !!is_Open,
          lastAccessed: currentTime,
        });

        await newUserDetails.save();
      }

      res.json({ success: true, message: "User details stored successfully" });
    } catch (error) {
      console.error(`Error storing user details: ${error.message}`);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  },

  deleteUserDetails: async (req, res) => {
    try {
      const { email, company_name, category_flag, batchId } = req.body;
      if (!email || !company_name || !batchId) {
        return res.status(400).json({
          success: false,
          error: "Email and company_name are required",
        });
      }
      await CompanyLockModel.deleteOne({
        email,
        company_name,
        category_flag,
        batchId,
      });

      res.json({ success: true, message: "User details deleted successfully" });
    } catch (error) {
      console.error(`Error deleting user details: ${error.message}`);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  },

  editExactData: async (req, res) => {
    try {
      const { obj_id, uniqueId, details } = req.body;
      let document = await ClusterDataModel.findById(obj_id);
      if (!document) {
        document = new ClusterDataModel({
          _id: obj_id,
          data: { Exact_point: {} },
        });
      }
      if (
        !document.data.Exact_point ||
        document.data.Exact_point.uniqueId !== uniqueId
      ) {
        return res.status(404).json({
          message: "Item with provided uniqueId not found in the document",
        });
      }
      document.data.Exact_point = { ...document.data.Exact_point, ...details };
      document.markModified("data");
      const updatedDocument = await document.save();

      res.json({
        success: true,
        message: "Edit successfully",
        data: updatedDocument,
      });
    } catch (error) {
      console.error("Error editing data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  approveExactData: async (req, res) => {
    const { obj_id, uniqueId, action, created_date, batchId, email } = req.body;

    const user = await userModel.findOne({ email }).select("_id");
    let userId = user._id;

    try {
      let document = await ClusterDataModel.findById(obj_id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const { data } = document;

      if (!data || !data.Exact_point) {
        return res.status(404).json({ message: "Records or Exact_point not found for approval" });
      }

      const { Exact_point, ticker, category_flag } = data;

      let clusteredPoint;
      if (Array.isArray(Exact_point)) {
        clusteredPoint = Exact_point.find(point => point.uniqueId === uniqueId);
      } else if (typeof Exact_point === "object" && Exact_point.uniqueId === uniqueId) {
        clusteredPoint = Exact_point;
      } else {
        return res.status(404).json({ message: "Exact_point not found for approval" });
      }

      clusteredPoint.ticker = ticker;
      clusteredPoint.category_flag = category_flag;
      clusteredPoint.approval_status = 1;
      clusteredPoint.created_date = created_date;
      clusteredPoint.batchId = batchId;
      clusteredPoint.userId = userId;

      const approvedDocument = new ApproveClusterDataModel(clusteredPoint);
      await approvedDocument.save();

      await ClusterDataModel.deleteOne({ _id: obj_id });

      await BatchesHistory.updateOne(
        { batchId: batchId, total_approved: null },
        { $set: { total_approved: 0 } }
      );

      // Increment total_approved in BatchesHistory
      const batchDocument = await BatchesHistory.findOneAndUpdate(
        { batchId: batchId },
        { $inc: { total_approved: 1 } },
        { new: true }
      );

      // Check if total_records equals total_approved
      if (batchDocument.total_records === batchDocument.total_approved) {
        batchDocument.batchEndDate = new Date();
        batchDocument.is_active = 0
        await batchDocument.save();
      }


      return res.status(200).json({
        message: "Records approved and moved to approved table successfully",
      });
    } catch (error) {
      console.error("Error approving data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  ,


  // approveExactData: async (req, res) => {
  //   const { obj_id, uniqueId, action, created_date, batchId, email } = req.body;

  //   const user = await userModel.findOne({ email }).select("_id");
  //   let userId = user._id;

  //   try {
  //     let document = await ClusterDataModel.findById(obj_id);

  //     if (!document) {
  //       return res.status(404).json({ message: "Document not found" });
  //     }

  //     const { data } = document;

  //     if (!data || !data.Exact_point) {
  //       return res
  //         .status(404)
  //         .json({ message: "Records or Exact_point not found for approval" });
  //     }

  //     const { Exact_point, ticker, category_flag } = data;

  //     let clusteredPoint;
  //     if (Array.isArray(Exact_point)) {
  //       clusteredPoint = Exact_point.find(
  //         (point) => point.uniqueId === uniqueId
  //       );
  //     } else if (
  //       typeof Exact_point === "object" &&
  //       Exact_point.uniqueId === uniqueId
  //     ) {
  //       clusteredPoint = Exact_point;
  //     } else {
  //       return res
  //         .status(404)
  //         .json({ message: "Exact_point not found for approval" });
  //     }

  //     clusteredPoint.ticker = ticker;
  //     clusteredPoint.category_flag = category_flag;
  //     clusteredPoint.approval_status = 1;
  //     clusteredPoint.created_date = created_date;
  //     clusteredPoint.batchId = batchId;
  //     clusteredPoint.userId = userId;

  //     const approvedDocument = new ApproveClusterDataModel(clusteredPoint);
  //     await approvedDocument.save();

  //     await ClusterDataModel.deleteOne({ _id: obj_id });

  //     return res.status(200).json({
  //       message: "Records approved and moved to approved table successfully",
  //     });
  //   } catch (error) {
  //     console.error("Error approving data:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // },

  // approveExactData: async (req, res) => {
  //     const { obj_id, uniqueId, action } = req.body;

  //     try {
  //         let document = await ClusterDataModel.findById(obj_id);

  //         if (!document) {
  //             return res.status(404).json({ message: 'Document not found' });
  //         }

  //         const { data } = document;

  //         if (!data || !data.Exact_point) {
  //             return res.status(404).json({ message: 'Data or Exact_point not found for approval' });
  //         }

  //         const { Exact_point, ticker, category_flag } = data;

  //         let clusteredPoint;
  //         if (Array.isArray(Exact_point)) {
  //             clusteredPoint = Exact_point.find(point => point.uniqueId === uniqueId);
  //         } else if (typeof Exact_point === 'object' && Exact_point.uniqueId === uniqueId) {
  //             clusteredPoint = Exact_point;
  //         } else {
  //             return res.status(404).json({ message: 'Exact_point not found for approval' });
  //         }

  //         clusteredPoint.ticker = ticker;
  //         clusteredPoint.category_flag = category_flag;
  //         clusteredPoint.approval_status = 1;

  //         const approvedDocument = new ApproveClusterDataModel(clusteredPoint);
  //         await approvedDocument.save();

  //         await ClusterDataModel.deleteOne({ _id: obj_id });

  //         return res.status(200).json({ message: 'Data approved and moved to approved table successfully' });
  //     } catch (error) {
  //         console.error('Error approving data:', error);
  //         res.status(500).json({ error: 'Internal server error' });
  //     }
  // },

  // approveExactData: async (req, res) => {
  //     const { obj_id, uniqueId, action, created_date,batchId, email } = req.body;

  //     try {
  //         let document = await ClusterDataModel.findById(obj_id);

  //         if (!document) {
  //             return res.status(404).json({ message: "Document not found" });
  //         }

  //         const { data } = document;

  //         if (!data || !data.Exact_point) {
  //             return res
  //                 .status(404)
  //                 .json({ message: "Data or Exact_point not found for approval" });
  //         }

  //         const { Exact_point, ticker, category_flag } = data;

  //         let clusteredPoint;
  //         if (Array.isArray(Exact_point)) {
  //             clusteredPoint = Exact_point.find(
  //                 (point) => point.uniqueId === uniqueId
  //             );
  //         } else if (
  //             typeof Exact_point === "object" &&
  //             Exact_point.uniqueId === uniqueId
  //         ) {
  //             clusteredPoint = Exact_point;
  //         } else {
  //             return res
  //                 .status(404)
  //                 .json({ message: "Exact_point not found for approval" });
  //         }

  //         clusteredPoint.ticker = ticker;
  //         clusteredPoint.category_flag = category_flag;
  //         clusteredPoint.approval_status = 1;
  //         clusteredPoint.created_date = created_date; // Adding created_date to the clusteredPoint

  //         const approvedDocument = new ApproveClusterDataModel(clusteredPoint);
  //         await approvedDocument.save();

  //         await ClusterDataModel.deleteOne({ _id: obj_id });

  //         return res
  //             .status(200)
  //             .json({
  //                 message: "Data approved and moved to approved table successfully",
  //             });
  //     } catch (error) {
  //         console.error("Error approving data:", error);
  //         res.status(500).json({ error: "Internal server error" });
  //     }
  // },

  cancleExactData: async (req, res) => {
    const { obj_id, uniqueId } = req.body;

    try {
      let document = await ClusterDataModel.findById(obj_id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const { data } = document;

      if (!data || !data.Exact_point) {
        return res
          .status(404)
          .json({
            message: "Records or Exact point not found for cancellation",
          });
      }

      const { Exact_point } = data;
      let clusteredPoint;
      if (Array.isArray(Exact_point)) {
        clusteredPoint = Exact_point.find(
          (point) => point.uniqueId === uniqueId
        );
      } else if (
        typeof Exact_point === "object" &&
        Exact_point.uniqueId === uniqueId
      ) {
        clusteredPoint = Exact_point;
      } else {
        return res
          .status(404)
          .json({ message: "Exact point not found for cancellation" });
      }

      return res.status(200).json({
        message: "Discard changes successful.",
        data: clusteredPoint,
      });
    } catch (error) {
      console.error("Error cancelling data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  logout: async (req, res) => {
    try {
      const { email } = req.body;
      const result = await CompanyLockModel.deleteMany({
        email: email,
        is_Open: true,
      });
      console.log("Records deleted successfully for email:", email);
      return res.status(200).json({
        message: "Usr Logout successfully",
      });
    } catch (err) {
      console.error("Error deleting records:", err);
    }
  },

  editApproveData: async (req, res) => {
    try {
      const { id, newData } = req.body;

      // Check if required fields are provided
      if (!id || !newData) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Find the document by ID and update all fields from newData
      const updatedData = await ApproveClusterDataModel.findByIdAndUpdate(
        id,
        newData,
        { new: true }
      );

      if (!updatedData) {
        return res.status(404).json({ error: "Records not found" });
      }

      // Retrieve the updated document to return all data
      const allData = await ApproveClusterDataModel.findById(id);

      return res
        .status(200)
        .json({ message: "Record updated successfully", data: allData });
    } catch (error) {
      console.error("Error editing and approving data:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
};

module.exports = JsonController;
