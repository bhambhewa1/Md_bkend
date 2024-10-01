const InputDataModel = require("../model/InputDataModel");
const ClusterDataModel = require("../model/ClusterDataModel");
const CompaniesModel = require("../model/CompaniesModel");
const CompanyModel = require("../model/CompanyModel");
const MasterDatasetModel = require("../model/master_dataset");
const CommonFunction = require("../middleware/CommonFunction");
const DisapproveHistory = require("../model/disapprove_history");
const UserModel = require('../model/userModel');


// Lock flag for the API
let isDataInProgress = false; 

const RefeshController =
{
  ApproveSingleTicker: async (req, res) => {
    if (isDataInProgress) {
      return res.status(429).json({ message: 'Another request is in progress, unable to proceed.' });
    }

    isDataInProgress = true; // Set the lock to proceed a request
    const { ticker, created_date } = req.body;
    if (!ticker || !created_date) {
      return res
        .status(400)
        .json({ error: "Both ticker and created_date fields are required." });
    }

    try {
      try {
        // Convert the created_date to match the format in the database
        const formattedCreatedDate = new Date(created_date)
          .toISOString()
          .split("T")[0];

        // Aggregation pipeline to get data only for the specified created_date and ticker
        const aggregatedData = await InputDataModel.aggregate([
          {
            $match: { created_date: formattedCreatedDate, ticker: ticker }, // Filter by the specific created_date and ticker
          },
          {
            $group: {
              _id: "$created_date",
              totalRecords: { $sum: 1 },
              uniqueTickers: { $addToSet: "$ticker" },
            },
          },
          {
            $project: {
              created_date: "$_id",
              totalRecords: 1,
              uniqueTickerCount: { $size: "$uniqueTickers" },
              uniqueTickers: 1,
            },
          },
        ]);

        if (aggregatedData.length > 0) {
          const { created_date, totalRecords, uniqueTickerCount } =
            aggregatedData[0];

          // Check if the created_date and ticker combination exists in ClusterDataModel
          const clusterExists = await ClusterDataModel.exists({
            "data.created_date": formattedCreatedDate,
            "data.ticker": ticker,
          });

          const existingMasterRecord = await MasterDatasetModel.findOne({
            created_date,
          });

          if (existingMasterRecord) {
            let updateFields = { $inc: { total_records: totalRecords } };

            // Only increment total_company if the ticker does not exist in ClusterDataModel
            if (!clusterExists) {
              updateFields.$inc.total_company = uniqueTickerCount;
            }

            // Update the existing record
            await MasterDatasetModel.updateOne({ created_date }, updateFields);
            // Debug: Log update action
            console.log(
              `Updated MasterDatasetModel for created_date: ${created_date}`
            );
          } else {
            // Create a new record if it doesn't exist
            await MasterDatasetModel.create({
              created_date,
              total_records: totalRecords,
              total_company: clusterExists ? 0 : uniqueTickerCount,
            });
            // Debug: Log creation action
            console.log(
              `Created new MasterDatasetModel for created_date: ${created_date}`
            );
          }
        } else {
          console.log(
            `No Records found for created_date: ${formattedCreatedDate} and ticker: ${ticker}`
          );
        }
      } catch (error) {
        console.error("Error:", error);
      }

    //####### Entries in BatchesHistory, ClusterdatasArchives, ClusterDataModel, CompaniesModel #####################
      let errObject = await CommonFunction.FillBatchesHistory(created_date, ticker);
      if(errObject?.err){
        return res.status(404).json({ message: errObject?.err });
      }

      return res
        .status(200)
        .json({ message: "Records transferred successfully" });
    } catch (err) {
      console.error("Error transferring data:", err);
      return res.status(500).json({ error: "Internal server error" });
    } finally {
      isDataInProgress = false; // Release the lock
    }
  },

  tickernameListing: async (req, res) => {
    const { status } = req.body;
    try {
      const query = {};
      if(status !== undefined){
        query.status = status;
      }

      let inputDataTickers=[];
      if(status === undefined || status === "Pending") {
        // Fetch ticker names from InputDataModel
        inputDataTickers = await InputDataModel.distinct("ticker");
      }

      // Fetch ticker names from CompaniesModel
      const companiesTickers = await CompaniesModel.distinct("ticker",query);

      // Merge both arrays and remove duplicates
      const allTickersSet = new Set([...inputDataTickers, ...companiesTickers]);
      const allTickers = Array.from(allTickersSet);

      // Sort the unique ticker names alphabetically
      allTickers.sort();

      // console.log("helow response,", allTickers)

      res.json({
        success: true,
        message: "Unique Ticker Name listing retrieved successfully",
        data: allTickers,
      });
    } catch (error) {
      console.error("Error fetching ticker listing:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  
  // org
  //     tickerListingCountdata: async (req, res) => {
  //         try {
  //             const { ticker } = req.body;
  //             const page = parseInt(req.query.page) || 1;
  //             const limit = 10;

  //             // Fetch counts from InputDataModel for the specified ticker
  //             const pendingInputDatas = await InputDataModel.find({ ticker });
  //             const pendingInputDatas1 = await InputDataModel.distinct('created_date', { ticker });

  // console.log(pendingInputDatas)
  //             console.log(pendingInputDatas1)
  //             return

  //             // Prepare data from InputDataModel if count is greater than zero
  //             let inputDataFormatted = null;
  //             if (pendingInputDatas.length > 0) {
  //                 const companyName = await getFullName(ticker);
  //                 const currentDate = new Date().toISOString().split('T')[0];
  //                 inputDataFormatted = {
  //                     ticker: ticker,
  //                     company: companyName,
  //                     fetch_date: currentDate,
  //                     total_record_fetch: pendingInputDatas.length,
  //                     status: 'Pending'
  //                 };
  //             }

  //             // Fetch entry from CompaniesModel for the specified ticker
  //             const existingEntry = await CompaniesModel.find({ ticker });

  //             // Prepare data from CompaniesModel
  //             let existingEntryFormatted = null;
  //             if (existingEntry) {
  //                 existingEntryFormatted = existingEntry.map(entry => ({
  //                     _id: entry._id,
  //                     ticker: entry.ticker,
  //                     company: entry.company,
  //                     fetch_date: entry.fetch_date,
  //                     total_record_fetch: entry.total_record_fetch,
  //                     status: entry.status
  //                 }));
  //             }

  //             // Combine data
  //             const combinedData = inputDataFormatted ? [inputDataFormatted, ...existingEntryFormatted] : existingEntryFormatted;

  //             // Paginate combined data
  //             const startIndex = (page - 1) * limit;
  //             const endIndex = page * limit;
  //             const paginatedData = combinedData.slice(startIndex, endIndex);

  //             // Calculate pagination details
  //             const totalCount = combinedData.length;
  //             const totalPages = Math.ceil(totalCount / limit);
  //             const finalTotalPages = totalCount <= limit ? 1 : totalPages;

  //             // Send response with paginated data and pagination details
  //             res.json({
  //                 success: true,
  //                 message: 'Data retrieved successfully',
  //                 data: paginatedData,
  //                 pagination: {
  //                     totalCount,
  //                     totalPages: finalTotalPages,
  //                     rowPerPage: limit,
  //                     currentPage: page,
  //                     hasNextPage: finalTotalPages > 1 && page < finalTotalPages,
  //                     hasPrevPage: page > 1
  //                 }
  //             });

  //         } catch (error) {
  //             console.error('Error fetching data:', error);
  //             res.status(500).json({ error: 'Internal server error' });
  //         }
  //     }

  // tickerListingCountdata: async (req, res) => {
  //     try {
  //         const { ticker } = req.body;
  //         const page = parseInt(req.query.page) || 1;
  //         const limit = 10;

  //         const uniqueDatesPipeline = [
  //             // Match documents with the specified ticker
  //             { $match: { ticker } },
  //             // Group documents by the created_date field
  //             {
  //                 $group: {
  //                     _id: "$created_date",
  //                     data: { $push: "$$ROOT" } // Store the entire document in an array
  //                 }
  //             },
  //             // Project only the necessary fields
  //             {
  //                 $project: {
  //                     _id: 0,
  //                     created_date: "$_id",
  //                     data: 1
  //                 }
  //             }
  //         ];

  //         // Execute the aggregation pipeline
  //         const uniqueDatesResult = await InputDataModel.aggregate(uniqueDatesPipeline);

  //         // Create an object to store arrays dynamically
  //         const dateArrays = {};

  //         // Iterate through the result and populate dateArrays
  //         uniqueDatesResult.forEach(({ created_date, data }) => {
  //             dateArrays[created_date] = data;
  //         });

  //         console.log(uniqueDatesResult)

  //         return

  //         // Prepare data from InputDataModel if count is greater than zero
  //         let inputDataFormatted = null;
  //         if (pendingInputDatas.length > 0) {
  //             const companyName = await getFullName(ticker);
  //             const currentDate = new Date().toISOString().split('T')[0];
  //             inputDataFormatted = {
  //                 ticker: ticker,
  //                 company: companyName,
  //                 fetch_date: currentDate,
  //                 total_record_fetch: pendingInputDatas.length,
  //                 status: 'Pending'
  //             };
  //         }

  //         // Fetch entry from CompaniesModel for the specified ticker
  //         const existingEntry = await CompaniesModel.find({ ticker });

  //         // Prepare data from CompaniesModel
  //         let existingEntryFormatted = null;
  //         if (existingEntry) {
  //             existingEntryFormatted = existingEntry.map(entry => ({
  //                 _id: entry._id,
  //                 ticker: entry.ticker,
  //                 company: entry.company,
  //                 fetch_date: entry.fetch_date,
  //                 total_record_fetch: entry.total_record_fetch,
  //                 status: entry.status
  //             }));
  //         }

  //         // Combine data
  //         const combinedData = inputDataFormatted ? [inputDataFormatted, ...existingEntryFormatted] : existingEntryFormatted;

  //         // Paginate combined data
  //         const startIndex = (page - 1) * limit;
  //         const endIndex = page * limit;
  //         const paginatedData = combinedData.slice(startIndex, endIndex);

  //         // Calculate pagination details
  //         const totalCount = combinedData.length;
  //         const totalPages = Math.ceil(totalCount / limit);
  //         const finalTotalPages = totalCount <= limit ? 1 : totalPages;

  //         // Send response with paginated data and pagination details
  //         res.json({
  //             success: true,
  //             message: 'Data retrieved successfully',
  //             data: paginatedData,
  //             pagination: {
  //                 totalCount,
  //                 totalPages: finalTotalPages,
  //                 rowPerPage: limit,
  //                 currentPage: page,
  //                 hasNextPage: finalTotalPages > 1 && page < finalTotalPages,
  //                 hasPrevPage: page > 1
  //             }
  //         });

  //     } catch (error) {
  //         console.error('Error fetching data:', error);
  //         res.status(500).json({ error: 'Internal server error' });
  //     }
  // }

  //  working

  // tickerListingCountdata: async (req, res) => {
  //     try {
  //         const { ticker } = req.body;
  //         const page = parseInt(req.query.page) || 1;
  //         const limit = 10;

  //         const uniqueDatesPipeline = [
  //             { $match: { ticker } },
  //             {
  //                 $group: {
  //                     _id: "$created_date",
  //                     data: { $push: "$$ROOT" }
  //                 }
  //             },
  //             {
  //                 $project: {
  //                     _id: 0,
  //                     created_date: "$_id",
  //                     data: 1
  //                 }
  //             }
  //         ];

  //         // Execute the aggregation pipeline
  //         const uniqueDatesResult = await InputDataModel.aggregate(uniqueDatesPipeline);

  //         // Create an object to store arrays dynamically
  //         const dateArrays = {};

  //         // Iterate through the result and populate dateArrays
  //         uniqueDatesResult.forEach(({ created_date, data }) => {
  //             dateArrays[created_date] = data;
  //         });

  //         const pendingInputDatas =uniqueDatesResult

  //         // Map pendingInputDatas and create inputDataFormatted objects
  //         const inputDataFormattedArray = pendingInputDatas.length > 0 ? pendingInputDatas.map(async (data) => {
  //             const companyName = await getFullName(ticker);
  //             return {
  //                 ticker: ticker,
  //                 fetch_date: data.created_date, // Include created_date field
  //                 company: companyName,
  //                 total_record_fetch: pendingInputDatas.length,
  //                 status: 'Pending'

  //             };
  //         }) : [];

  //         // Resolve promises in inputDataFormattedArray
  //         const inputDataFormatted = await Promise.all(inputDataFormattedArray);

  //         // Fetch entry from CompaniesModel for the specified ticker
  //         const existingEntry = await CompaniesModel.find({ ticker });

  //         // Prepare data from CompaniesModel
  //         let existingEntryFormatted = [];
  //         if (existingEntry) {
  //             existingEntryFormatted = existingEntry.map(entry => ({
  //                 _id: entry._id,
  //                 ticker: entry.ticker,
  //                 company: entry.company,
  //                 fetch_date: entry.fetch_date,
  //                 total_record_fetch: entry.total_record_fetch,
  //                 status: entry.status
  //             }));
  //         }

  //         // Combine data from inputDataFormatted and existingEntryFormatted
  //         const combinedData = [...inputDataFormatted, ...existingEntryFormatted];

  //         // Paginate combined data
  //         const startIndex = (page - 1) * limit;
  //         const endIndex = page * limit;
  //         const paginatedData = combinedData.slice(startIndex, endIndex);

  //         // Calculate pagination details
  //         const totalCount = combinedData.length;
  //         const totalPages = Math.ceil(totalCount / limit);
  //         const finalTotalPages = totalCount <= limit ? 1 : totalPages;

  //         // Send response with paginated data and pagination details
  //         res.json({
  //             success: true,
  //             message: 'Data retrieved successfully',
  //             data: paginatedData,
  //             pagination: {
  //                 totalCount,
  //                 totalPages: finalTotalPages,
  //                 rowPerPage: limit,
  //                 currentPage: page,
  //                 hasNextPage: finalTotalPages > 1 && page < finalTotalPages,
  //                 hasPrevPage: page > 1
  //             }
  //         });

  //     } catch (error) {
  //         console.error('Error fetching data:', error);
  //         res.status(500).json({ error: 'Internal server error' });
  //     }
  // }

  // tickerListingCountdata: async (req, res) => {
  //   try {
  //     const { ticker } = req.body;
  //     // console.log(ticker)

  //     const page = parseInt(req.query.page) || 1;
  //     const limit = 10;

  //     const pendingInputDatas = await InputDataModel.find({ ticker });

  //     // console.log(pendingInputDatas)
  //     // console.log(pendingInputDatas.length)
  //     if (pendingInputDatas.length === 0) {
  //       const existingEntry = await CompaniesModel.find({ ticker }).sort({
  //         fetch_date: -1,
  //       });

  //       // Prepare data from CompaniesModel
  //       let existingEntryFormatted = [];
  //       if (existingEntry) {
  //         existingEntryFormatted = existingEntry.map((entry) => ({
  //           _id: entry._id,
  //           ticker: entry.ticker,
  //           company: entry.company,
  //           fetch_date: entry.fetch_date,
  //           total_record_fetch: entry.total_record_fetch,
  //           status: entry.status,
  //         }));
  //       }

  //       // Combine data from inputDataFormatted and existingEntryFormatted
  //       const combinedData = [...existingEntryFormatted];

  //       // Paginate combined data
  //       const startIndex = (page - 1) * limit;
  //       const endIndex = page * limit;
  //       const paginatedData = combinedData.slice(startIndex, endIndex);

  //       // Calculate pagination details
  //       const totalCount = combinedData.length;
  //       const totalPages = Math.ceil(totalCount / limit);
  //       const finalTotalPages = totalCount <= limit ? 1 : totalPages;

  //       // Send response with paginated data and pagination details
  //       res.json({
  //         success: true,
  //         message: "Records retrieved successfully",
  //         data: paginatedData,
  //         pagination: {
  //           totalCount,
  //           totalPages: finalTotalPages,
  //           rowPerPage: limit,
  //           currentPage: page,
  //           hasNextPage: finalTotalPages > 1 && page < finalTotalPages,
  //           hasPrevPage: page > 1,
  //         },
  //       });
  //     } else {
  //       const uniqueDatesPipeline = [
  //         { $match: { ticker } },
  //         {
  //           $group: {
  //             _id: "$created_date",
  //             data: { $push: "$$ROOT" },
  //           },
  //         },
  //         {
  //           $project: {
  //             _id: 0,
  //             created_date: "$_id",
  //             data: 1,
  //           },
  //         },
  //         {
  //           $group: {
  //             _id: null,
  //             uniqueDatesResult: { $push: "$$ROOT" },
  //             pendingInputDatasLength: { $sum: { $size: "$data" } },
  //           },
  //         },
  //         {
  //           $project: {
  //             _id: 0,
  //             uniqueDatesResult: 1,
  //             pendingInputDatasLength: 1,
  //           },
  //         },
  //       ];

  //       // Execute the aggregation pipeline
  //       const aggregationResult = await InputDataModel.aggregate(
  //         uniqueDatesPipeline
  //       );

  //       // Extract uniqueDatesResult and pendingInputDatasLength from aggregation result
  //       const { uniqueDatesResult, pendingInputDatasLength } =
  //         aggregationResult[0];

  //       // Create an object to store arrays dynamically
  //       const dateArrays = {};

  //       // Iterate through the result and populate dateArrays
  //       uniqueDatesResult.forEach(({ created_date, data }) => {
  //         dateArrays[created_date] = data;
  //       });

  //       const inputDataFormattedArray =
  //         uniqueDatesResult.length > 0
  //           ? uniqueDatesResult.map(async (dateData) => {
  //             const companyName = await CommonFunction.getFullName(ticker);
  //             // sourcery skip: use-object-destructuring
  //             const created_date = dateData.created_date;
  //             const dataLength = dateData.data.length;
  //             return {
  //               ticker: ticker,
  //               fetch_date: created_date, // Include created_date field
  //               company: companyName,
  //               total_record_fetch: dataLength,
  //               status: "Pending",
  //             };
  //           })
  //           : [];

  //       // Resolve promises in inputDataFormattedArray
  //       const inputDataFormatted = await Promise.all(inputDataFormattedArray);

  //       // Fetch entry from CompaniesModel for the specified ticker
  //       // const existingEntry = await CompaniesModel.find({ ticker });
  //       const existingEntry = await CompaniesModel.find({ ticker }).sort({
  //         fetch_date: -1,
  //       });

  //       // Prepare data from CompaniesModel
  //       let existingEntryFormatted = [];
  //       if (existingEntry) {
  //         existingEntryFormatted = existingEntry.map((entry) => ({
  //           _id: entry._id,
  //           ticker: entry.ticker,
  //           company: entry.company,
  //           fetch_date: entry.fetch_date,
  //           total_record_fetch: entry.total_record_fetch,
  //           status: entry.status,
  //         }));
  //       }

  //       // Combine data from inputDataFormatted and existingEntryFormatted
  //       const combinedData = [...inputDataFormatted, ...existingEntryFormatted];

  //       // Convert fetch_date values to consistent format
  //       combinedData.forEach((item) => {
  //         if (item.fetch_date) {
  //           // If fetch_date is in "YYYY-MM-DD" format, convert it to a Date object
  //           if (
  //             typeof item.fetch_date === "string" &&
  //             item.fetch_date.includes("-")
  //           ) {
  //             item.fetch_date = new Date(item.fetch_date);
  //           } else {
  //             // If fetch_date is in another format, parse it to a Date object
  //             item.fetch_date = new Date(item.fetch_date);
  //           }
  //         }
  //       });

  //       // Sort combinedData array in descending order based on fetch_date
  //       combinedData.sort((a, b) => {
  //         return b.fetch_date - a.fetch_date;
  //       });

  //       // Sort combinedData array in descending order based on created_date
  //       combinedData.sort((a, b) => {
  //         return new Date(b.created_date) - new Date(a.created_date);
  //       });

  //       // Paginate combined data
  //       const startIndex = (page - 1) * limit;
  //       const endIndex = page * limit;
  //       const paginatedData = combinedData.slice(startIndex, endIndex);

  //       // Calculate pagination details
  //       const totalCount = combinedData.length;
  //       const totalPages = Math.ceil(totalCount / limit);
  //       const finalTotalPages = totalCount <= limit ? 1 : totalPages;

  //       // Send response with paginated data and pagination details
  //       res.json({
  //         success: true,
  //         message: "Records retrieved successfully",
  //         data: paginatedData,
  //         pagination: {
  //           totalCount,
  //           totalPages: finalTotalPages,
  //           rowPerPage: limit,
  //           currentPage: page,
  //           hasNextPage: finalTotalPages > 1 && page < finalTotalPages,
  //           hasPrevPage: page > 1,
  //         },
  //       });
  //     }
  //   } catch (error) {
  //     console.error("Error fetching data:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // },


  tickerListingCountdata: async (req, res) => {
    try {
      const { ticker, status } = req.body;
      const page = parseInt(req.query.page) || 1;
      const limit = 10;

      let inputDataFormatted=[];
      const query = { ticker }
      if (status !== undefined) {
        query.status = status;
      }

      if(status === undefined || status === "Pending") {  
        const uniqueDatesPipeline = [
          { $match: { ticker } },
          {
            $group: {
              _id: "$created_date",
              data: { $push: "$$ROOT" },
            },
          },
          {
            $project: {
              _id: 0,
              created_date: "$_id",
              data: 1,
            },
          },
          {
            $group: {
              _id: null,
              uniqueDatesResult: { $push: "$$ROOT" },
              pendingInputDatasLength: { $sum: { $size: "$data" } },
            },
          },
          {
            $project: {
              _id: 0,
              uniqueDatesResult: 1,
              pendingInputDatasLength: 1,
            },
          },
        ];

        // Execute the aggregation pipeline
        const aggregationResult = await InputDataModel.aggregate(uniqueDatesPipeline);

        if(aggregationResult?.length !== 0) {
            // Extract uniqueDatesResult and pendingInputDatasLength from aggregation result
            const { uniqueDatesResult, pendingInputDatasLength } = aggregationResult[0];

            // Create an object to store arrays dynamically
            const dateArrays = {};

            // Iterate through the result and populate dateArrays
            uniqueDatesResult.forEach(({ created_date, data }) => {
              dateArrays[created_date] = data;
            });

            const inputDataFormattedArray =
              uniqueDatesResult.length > 0
                ? uniqueDatesResult.map(async (dateData) => {
                  const companyName = await CommonFunction.getFullName(ticker);
                  // sourcery skip: use-object-destructuring
                  const created_date = dateData.created_date;
                  const dataLength = dateData.data.length;
                  return {
                    ticker: ticker,
                    fetch_date: created_date, // Include created_date field
                    company: companyName,
                    total_record_fetch: dataLength,
                    status: "Pending",
                  };
                })
                : [];

            // Resolve promises in inputDataFormattedArray
            inputDataFormatted = await Promise.all(inputDataFormattedArray);
          }
      }

        // Fetch entry from CompaniesModel for the specified ticker
        const existingEntry = await CompaniesModel.find(query).sort({
          fetch_date: -1,
        });

        // Prepare data from CompaniesModel
        let existingEntryFormatted = [];
        if (existingEntry) {
          existingEntryFormatted = existingEntry.map((entry) => ({
            _id: entry._id,
            ticker: entry.ticker,
            company: entry.company,
            fetch_date: entry.fetch_date,
            total_record_fetch: entry.total_record_fetch,
            status: entry.status,
          }));
        }

        // Combine data from inputDataFormatted and existingEntryFormatted
        const combinedData = [...inputDataFormatted, ...existingEntryFormatted];

        // Convert fetch_date values to consistent format
        combinedData.forEach((item) => {
          if (item.fetch_date) {
            // If fetch_date is in "YYYY-MM-DD" format, convert it to a Date object
            if (
              typeof item.fetch_date === "string" &&
              item.fetch_date.includes("-")
            ) {
              item.fetch_date = new Date(item.fetch_date);
            } else {
              // If fetch_date is in another format, parse it to a Date object
              item.fetch_date = new Date(item.fetch_date);
            }
          }
        });

        // Sort combinedData array in descending order based on fetch_date
        combinedData.sort((a, b) => {
          return b.fetch_date - a.fetch_date;
        });

        // Sort combinedData array in descending order based on created_date
        combinedData.sort((a, b) => {
          return new Date(b.created_date) - new Date(a.created_date);
        });

        // Paginate combined data
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedData = combinedData.slice(startIndex, endIndex);

        // Calculate pagination details
        const totalCount = combinedData.length;
        const totalPages = Math.ceil(totalCount / limit);
        const finalTotalPages = totalCount <= limit ? 1 : totalPages;

        // Send response with paginated data and pagination details
        res.json({
          success: true,
          message: "Records retrieved successfully",
          data: paginatedData,
          pagination: {
            totalCount,
            totalPages: finalTotalPages,
            rowPerPage: limit,
            currentPage: page,
            hasNextPage: finalTotalPages > 1 && page < finalTotalPages,
            hasPrevPage: page > 1,
          },
        });

    } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  DisapproveApproveTicker: async (req, res) => {
    if (isDataInProgress) {
      return res.status(429).json({ message: 'Another request is in progress, unable to proceed.' });
    }

    isDataInProgress = true; // Set the lock to proceed a request
    const { ticker, created_date, email } = req.body;
    if (!ticker || !created_date || !email) {
      return res
        .status(400)
        .json({ error: "ticker, email and created_date fields are required." });
    }

    try {
      const datetimeString = created_date;
      const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(datetimeString);
      const dateString = isValidFormat
        ? datetimeString
        : datetimeString.split("T")[0];
      const currentDate = new Date().toISOString().split("T")[0];
      const companyName = await CommonFunction.getFullName(ticker);
      if (!companyName || companyName.length === 0) {
        return res.status(404).json({ message: "Company name is missing or not found" });
      }

      const user = await UserModel.findOne({ email }).select('_id');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      let userId = user._id;

      const disapproveDatas = await InputDataModel.find({ ticker, created_date: dateString }).lean();

      for (const disapproveData of disapproveDatas) {
        const disapproveDocument = {
          userId,
          ManufacturerId: disapproveData?.ManufacturerId,
          ManufacturerCatalogNumber: disapproveData?.ManufacturerCatalogNumber,
          ItemDescription: disapproveData?.ItemDescription,
          ticker: disapproveData?.ticker,
          category_flag: disapproveData?.category_flag,
          created_date: dateString,
        };

        if (disapproveData?.category_flag === "Exact") {
          disapproveDocument.Exact_point = disapproveData?.Exact_point || {};
        }
        if (disapproveData?.category_flag === "Clustered") {
          disapproveDocument.Clustered_point = disapproveData?.Clustered_point || {};
        }
        // console.log("Added doc", disapproveDocument)

        await DisapproveHistory.create(disapproveDocument);
      }
      const tickerCount = await InputDataModel.countDocuments({
        ticker,
        created_date: dateString,
      });
      await CompaniesModel.create({
        ticker,
        company: companyName,
        total_record_fetch: tickerCount,
        fetch_date: currentDate,
        created_date: dateString,
        status: "Disapprove",
      });

      // Delete transferred data from InputDataModel
      await InputDataModel.deleteMany({ ticker, created_date: dateString });

      return res
        .status(200)
        .json({ message: "Record disapprove successfully" });
    } catch (err) {
      console.error("Error transferring data:", err);
      return res.status(500).json({ error: "Internal server error" });
    } finally {
      isDataInProgress = false; // Release the lock
    }
  },
};

module.exports = RefeshController;
