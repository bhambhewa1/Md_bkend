const { getFullName, trimAndRemoveExtraSpaces, removeIdField } = require("../middleware/CommonFunction");
const ClusterDataModel = require("../model/ClusterDataModel");
const BatchesHistory = require("../model/batchesHistory");
const ClusterdatasArchives = require("../model/clusterdatasArchives");
const approveclusters = require("../model/ApproveModel");
const MasterDataset = require("../model/master_dataset");
const { response } = require("express");
const { ObjectId } = require('mongodb');
const userId = "666304b22b12ba3f72e2664d";



const FillBatchesHistories = async (created_date, ticker) => {
  const BatchesLength = parseInt(process.env.BATCHES_LENGTH) || 100;
  const datetimeString = created_date;
  // ################################################
  const dateObj = new Date(datetimeString);

  // Get the parts of the date
  const year = dateObj.getFullYear();
  const month = dateObj.toLocaleString("en-US", { month: "long" });
  const day = dateObj.getDate().toString().padStart(2, "0");

  // Combine the parts into the desired format
  const formattedDate = `${year} ${month} ${day}`;

  // ################################################

  const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(datetimeString);
  const dateString = isValidFormat
    ? datetimeString
    : datetimeString.split("T")[0];
  const currentDate = new Date().toISOString().split("T")[0];
  let batchId;
  const categoriesCount = {};
  let totalRecordsTransferred = 0;
  const companyName = await getFullName(ticker);

  if (!companyName || companyName.length === 0) {
    return { err: "Company name is missing or not found" };
  }

  const inputDatas = await ClusterDataModel.find({
    "data.ticker": ticker,
    "data.created_date": dateString,
    "batchId": { $exists: false }
  }).lean();



  if (inputDatas.length === 0) {
    return { err: "No data found for the provided ticker" };
  }

  const batch_exists = await BatchesHistory.findOne(
    { created_date: dateString, ticker },
    { batchName: 1 }
  ).sort({ batch_date: -1 });
  let lastVersion = batch_exists
    ? Number(batch_exists.batchName.split("Batch ")[1])
    : 0;


  for (let i = 0; i < inputDatas.length / BatchesLength; i++) {
    lastVersion++;
    const batch_name = `${formattedDate} - Batch ${lastVersion}`;

    // Get the current batch of elements from inputDatas
    const start = i * BatchesLength;
    const end = Math.min(start + BatchesLength, inputDatas.length);
    const inputDatasCurrentElements = inputDatas.slice(start, end);

    // Aggregate data from ClusterDataModel to get count of category_flag of a ticker
    const ClusterExactCount = await ClusterDataModel.aggregate([
      {
        // Match documents with the specific ticker
        $match: { _id: { $in: inputDatasCurrentElements.map((el) => el._id) } },
      },
      {
        // Group by category_flag and count the occurrences
        $group: {
          _id: "$data.category_flag",
          count: { $sum: 1 },
        },
      },
      {
        // Project the result in a readable format
        $project: {
          _id: 0,
          category_flag: "$_id",
          count: 1,
        },
      },
    ]);

    console.log("ClusterExactCount", ClusterExactCount);
    let cluster_count, exact_count;
    for (const data of ClusterExactCount) {
      if (data.category_flag === "Clustered") cluster_count = data.count;
      else exact_count = data.count;
    }

    // Create/save batches of BatchesLength in database
    const newBatch = new BatchesHistory({
      created_date: dateString,
      batch_date: Date.now(),
      batchName: batch_name,
      ticker,
      total_records:
        inputDatas.length - i * BatchesLength < BatchesLength
          ? inputDatas.length - i * BatchesLength
          : BatchesLength,
      total_clustered: cluster_count,
      total_exact: exact_count,
    });
    await newBatch.save();
    batchId = newBatch.batchId;

    // Transfering data in Clusterdatas collection

    // Looping on the currentbatch of elements from inputDatas
    for (let inputData of inputDatasCurrentElements) {
      //   if (
      //     inputData.data instanceof Object &&
      //     !inputData.data.constructor.name.startsWith("Mongoose")
      //   ) {
      // Trim and remove extra spaces from all string fields
      await trimAndRemoveExtraSpaces(inputData.data);
      await removeIdField(inputData.data);

      // Transfer data from InputDataModel to ClusterDataModel
      const updateTableData = await ClusterDataModel.updateOne(
        { _id: inputData._id }, // Filter to find the document
        { $set: { batchId: batchId, created_at: Date.now() } } // Update the batchId, created_at fields
      );

      const newDataArchieve = new ClusterdatasArchives({
        batchId: batchId,
        data: inputData.data,
      });
      await newDataArchieve.save();
      //   }
    }
  }

};


const FillBatchesHistories_adding_batch = async (created_date, ticker, req, res) => {
  console.log(ticker)

  var created_dateddd = new Date(created_date);
  var formatted_date = created_dateddd;
  console.log('created_date:"' + formatted_date + '"');


  // return

  const BatchesLength = parseInt(process.env.BATCHES_LENGTH) || 100;
  const datetimeString = formatted_date;
  const dateObj = new Date(datetimeString);

  // Get the parts of the date
  const year = dateObj.getFullYear();
  const month = dateObj.toLocaleString("en-US", { month: "long" });
  const day = dateObj.getDate().toString().padStart(2, "0");

  // Combine the parts into the desired format
  const formattedDate = `${year} ${month} ${day}`;
  // ################################################

  const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(datetimeString);
  const dateString = isValidFormat
    ? datetimeString
    : datetimeString;
  const currentDate = new Date().toISOString();
  let batchId;
  const categoriesCount = {};
  let totalRecordsTransferred = 0;
  const companyName = await getFullName(ticker);

  if (!companyName || companyName.length === 0) {
    return res
      .status(404)
      .json({ message: "Company name is missing or not found" });
  }
console.log("dateString",dateString)
  const inputDatas = await approveclusters.find({
    "ticker": ticker,
    "created_date": dateString,
    "batchId": { $exists: false }
  }).lean();



  if (inputDatas.length === 0) {
    return { err: "No data found for the provided ticker" };
  }



  const batch_exists = await BatchesHistory.findOne(
    { created_date: dateString, ticker },
    { batchName: 1 }
  ).sort({ batch_date: -1 });
  let lastVersion = batch_exists
    ? Number(batch_exists.batchName.split("Batch ")[1])
    : 0;

  for (let i = 0; i < inputDatas.length / BatchesLength; i++) {
    lastVersion++;
    const batch_name = `${formattedDate} - Batch ${lastVersion}`;

    // Get the current batch of elements from inputDatas
    const start = i * BatchesLength;
    const end = Math.min(start + BatchesLength, inputDatas.length);
    const inputDatasCurrentElements = inputDatas.slice(start, end);

    // Aggregate data from ClusterDataModel to get count of category_flag of a ticker
    const ClusterExactCount = await approveclusters.aggregate([
      {
        // Match documents with the specific ticker
        $match: { _id: { $in: inputDatasCurrentElements.map((el) => el._id) } },
      },
      {
        // Group by category_flag and count the occurrences
        $group: {
          _id: "$category_flag",
          count: { $sum: 1 },
        },
      },
      {
        // Project the result in a readable format
        $project: {
          _id: 0,
          category_flag: "$_id",
          count: 1,
        },
      },
    ]);

    // console.log("ClusterExactCount", ClusterExactCount);
    // let cluster_count, exact_count;
    // for (const data of ClusterExactCount) {
    //   if (data.category_flag === "Clustered") cluster_count = data.count;
    //   else exact_count = data.count;
    // }

    // // Create/save batches of BatchesLength in database
    // const newBatch = new BatchesHistory({
    //   created_date: dateString,
    //   batch_date: Date.now(),
    //   batchName: batch_name,
    //   ticker,
    //   total_records:
    //     inputDatas.length - i * BatchesLength < BatchesLength
    //       ? inputDatas.length - i * BatchesLength
    //       : BatchesLength,
    //   total_clustered: cluster_count,
    //   total_exact: exact_count,
    // });

    console.log("ClusterExactCount", ClusterExactCount);
    let cluster_count, exact_count;
    for (const data of ClusterExactCount) {
      if (data.category_flag === "Clustered") cluster_count = data.count;
      else exact_count = data.count;
    }

    // Calculate total_records
    const total_records =
      inputDatas.length - i * BatchesLength < BatchesLength
        ? inputDatas.length - i * BatchesLength
        : BatchesLength;

    // Set total_approved the same as total_records
    const total_approved = total_records;

    // Set batchEndDate to the current date
    const batchEndDate = new Date();

    // Determine is_active value
    const is_active = total_approved === total_records ? 0 : 1;

    // Create/save batches of BatchesLength in database
    const newBatch = new BatchesHistory({
      created_date: dateString,
      batch_date: Date.now(),
      batchName: batch_name,
      ticker,
      total_records: total_records,
      total_clustered: cluster_count,
      total_exact: exact_count,
      total_approved: total_approved,
      batchEndDate: batchEndDate,
      is_active: is_active,
    });

    await newBatch.save();
    batchId = newBatch.batchId;

    // Transfering data in Clusterdatas collection

    // Looping on the currentbatch of elements from inputDatas
    for (let inputData of inputDatasCurrentElements) {
      // await trimAndRemoveExtraSpaces(inputData.data);
      // await removeIdField(inputData.data);

      // Transfer data from InputDataModel to ClusterDataModel
      const updateTableData = await approveclusters.updateOne(
        { _id: inputData._id }, // Filter to find the document
        { $set: { userId: new ObjectId('65dc8dee3fe8b6a5265928b7'), batchId: batchId, created_at: Date.now() } }
      );

      const newDataArchieve = new ClusterdatasArchives({
        batchId: batchId,
        data: inputData.data,
      });
      await newDataArchieve.save();
      //   }
    }
  }

};

// const FillBatchesHistories_adding_batch = async (created_date, ticker) => {
//   console.log(ticker)

//   var created_dateddd = new Date(created_date);
//   var formatted_date = created_dateddd;
//   console.log('created_date:"' + formatted_date + '"');


//   // return

//   const BatchesLength = parseInt(process.env.BATCHES_LENGTH) || 100;
//   const datetimeString = formatted_date;
//   const dateObj = new Date(datetimeString);

//   // Get the parts of the date
//   const year = dateObj.getFullYear();
//   const month = dateObj.toLocaleString("en-US", { month: "long" });
//   const day = dateObj.getDate().toString().padStart(2, "0");

//   // Combine the parts into the desired format
//   const formattedDate = `${year} ${month} ${day}`;
//   // ################################################

//   const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(datetimeString);
//   const dateString = isValidFormat
//     ? datetimeString
//     : datetimeString;
//   const currentDate = new Date().toISOString();
//   let batchId;
//   const categoriesCount = {};
//   let totalRecordsTransferred = 0;
//   const companyName = await getFullName(ticker);

//   if (!companyName || companyName.length === 0) {
//     return { err: "Company name is missing or not found" };
//   }

//   const inputDatas = await approveclusters.find({
//     "ticker": ticker,
//     "created_date": dateString,
//     "batchId": { $exists: false }
//   }).lean();



//   if (inputDatas.length === 0) {
//     return { err: "No data found for the provided ticker" };
//   }

//   const batch_exists = await BatchesHistory.findOne(
//     { created_date: dateString, ticker },
//     { batchName: 1 }
//   ).sort({ batch_date: -1 });
//   let lastVersion = batch_exists
//     ? Number(batch_exists.batchName.split("Batch ")[1])
//     : 0;


//   for (let i = 0; i < inputDatas.length / BatchesLength; i++) {
//     lastVersion++;
//     const batch_name = `${formattedDate} - Batch ${lastVersion}`;

//     // Get the current batch of elements from inputDatas
//     const start = i * BatchesLength;
//     const end = Math.min(start + BatchesLength, inputDatas.length);
//     const inputDatasCurrentElements = inputDatas.slice(start, end);

//     // Aggregate data from approveclusters to get count of category_flag of a ticker
//     const ClusterExactCount = await approveclusters.aggregate([
//       {
//         // Match documents with the specific ticker
//         $match: { _id: { $in: inputDatasCurrentElements.map((el) => el._id) } },
//       },
//       {
//         // Group by category_flag and count the occurrences
//         $group: {
//           _id: "$category_flag",
//           count: { $sum: 1 },
//         },
//       },
//       {
//         // Project the result in a readable format
//         $project: {
//           _id: 0,
//           category_flag: "$_id",
//           count: 1,
//         },
//       },
//     ]);

//     console.log("ClusterExactCount", ClusterExactCount);
//     let cluster_count, exact_count;
//     for (const data of ClusterExactCount) {
//       if (data.category_flag === "Clustered")
//         cluster_count = data.count;
//       else exact_count = data.count;
//     }
//     console.log(cluster_count, exact_count)
//     let total_records = inputDatas.length - i * BatchesLength < BatchesLength
//       ? inputDatas.length - i * BatchesLength
//       : BatchesLength;

//     let total_approved = cluster_count + exact_count;
//     let is_active = 1;
//     if (total_records === total_approved) {
//       is_active = 0;
//     }


//     // Create/save batches of BatchesLength in database
//     const newBatch = new BatchesHistory({
//       created_date: dateString,
//       batchName: batch_name,
//       ticker,
//       total_records,
//       total_clustered: cluster_count,
//       total_exact: exact_count,
//       total_approved,
//       batchEndDate: is_active === 0 ? currentDate : null,
//       is_active
//     });
//     await newBatch.save();
//     batchId = newBatch.batchId;

//     // Transfering data in Clusterdatas collection

//     // Looping on the currentbatch of elements from inputDatas
//     for (let inputData of inputDatasCurrentElements) {
//       // await trimAndRemoveExtraSpaces(inputData.data);
//       // await removeIdField(inputData.data);

//       // Transfer data from InputDataModel to ClusterDataModel
//       const updateTableData = await approveclusters.updateOne(
//         { _id: inputData._id }, // Filter to find the document
//         { $set: { userId: new ObjectId(userId), batchId: batchId, approveDate: Date.now() } } // Update the batchId, created_at fields
//       );

//       const newDataArchieve = new ClusterdatasArchives({
//         batchId: batchId,
//         data: inputData.data,
//       });
//       await newDataArchieve.save();
//       //   }
//     }
//   }

// };

const OmiController = {

  OmiController_one: async (req, res) => {
    const { ticker } = req.body;
    try {
      const uniqueDatesForOMI = await ClusterDataModel.aggregate([
        {
          // Match documents where the nested ticker field equals "OMI"
          $match: {
            "data.ticker": ticker,
          },
        },
        {
          // Project the necessary fields, including the nested ticker field
          $project: {
            created_date: "$data.created_date",
            ticker: "$data.ticker",
          },
        },
        {
          // Group by created_date to remove duplicates
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

      console.log("uniqueDatesForOMI", uniqueDatesForOMI);

      let aa;
      // Loop through the unique (created_date, ticker pairs) and now breaking their into batches
      for (const { created_date, ticker } of uniqueDatesForOMI) {
        const response = await FillBatchesHistories(created_date, ticker);
        if (response?.err) {
          aa = response.err
          res.send(aa)
          break;
        }
      }

      if (!aa) {
        return res
          .status(200)
          .json({ message: "Created Batches and Records Updated Successfully" });
      }

    } catch (err) {
      console.error("Error transferring data:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  adding_batch: async (req, res, next) => {
    console.log('Request Body:', req.body);

    const { ticker } = req.body;
    try {
      // Get unique dates and tickers from approveclusters collection
      // const get_dates = await approveclusters.aggregate([
      //   { $match: { "ticker": ticker } },
      //   { $group: { _id: { created_date: "$created_date", ticker: "$ticker" } } }
      // ]);
      // console.log(get_dates)

      const get_dates = await approveclusters.aggregate([
        { $match: { "ticker": ticker } },
        {
          $group: {
            _id: {
              created_date: { $dateToString: { format: "%Y-%m-%d", date: "$created_date" } },
              ticker: "$ticker"
            }
          }
        }
      ]);

      // Extract dates and tickers from aggregation result
      const get_datadd = get_dates.map(({ _id }) => ({
        created_date: _id.created_date,
        ticker: _id.ticker
      }));
      console.log(get_datadd)

      console.log(get_datadd[0].created_date);

      // Extract dates and tickers from aggregation result


      // Fetch dates with total record count
      const get_dates_with_count = await approveclusters.aggregate([
        { $match: { "ticker": ticker } },
        { $group: { _id: "$created_date", total_records: { $sum: 1 } } }
      ]);

      console.log("Dates with count fetched:", get_dates_with_count);

      // Update or create documents in the MasterDataset collection
      for (const { _id: created_date, total_records } of get_dates_with_count) {

        // const updatedRecord = await MasterDataset.findOneAndUpdate(
        //   { created_date: get_datadd[0].created_date },
        //   { $set: { total_records }, $setOnInsert: { created_at: new Date() } },
        //   { upsert: true, new: true }
        // );

        const updatedRecord = await MasterDataset.findOneAndUpdate(
          { created_date: get_datadd[0].created_date },
          {
            $inc: { total_records },
            $setOnInsert: { created_at: new Date() }
          },
          { upsert: true, new: true }
        );
      }

      // Check if the record exists in ClusterDataModel collection
      const clusterRecord = await ClusterDataModel.findOne({ "data.created_date": get_datadd[0].created_date, "data.ticker": get_datadd[0].ticker });

      if (!clusterRecord) {
        // If the record doesn't exist in ClusterDataModel, increment total_company
        await MasterDataset.updateOne(
          { created_date: get_datadd[0].created_date },
          { $inc: { total_company: 1 } }
        );

        console.log("Total company updated.");
      }
      let aa
      // Call FillBatchesHistories_adding_batch for each date and ticker
      for (const { created_date, ticker } of get_dates) {
        const response = await FillBatchesHistories_adding_batch(get_datadd[0].created_date, get_datadd[0].ticker, req, res);
        // if (response?.err) {
        //   aa = response.err
        //   res.send(aa)
        //   break;
        // }
      }

      // Return success response
      // if (!aa) {
        return res
          .status(200)
          .json({ message: "Created Batches and Records Updated Successfully" });
      // }


    } catch (error) {
      console.log(error);
      // Handle error response
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  // adding_batch: async (req, res, next) => {
  //   console.log('Request Body:', req.body);

  //   const { ticker } = req.body;
  //   try {
  //     // Get unique dates and tickers from approveclusters collection
  //     // const get_dates = await approveclusters.aggregate([
  //     //   { $match: { "ticker": ticker } },
  //     //   { $group: { _id: { created_date: "$created_date", ticker: "$ticker" } } }
  //     // ]);
  //     // console.log(get_dates)

  //     const get_dates = await approveclusters.aggregate([
  //       { $match: { "ticker": ticker } },
  //       {
  //         $group: {
  //           _id: {
  //             created_date: { $dateToString: { format: "%Y-%m-%d", date: "$created_date" } },
  //             ticker: "$ticker"
  //           }
  //         }
  //       }
  //     ]);

  //     // Extract dates and tickers from aggregation result
  //     const get_datadd = get_dates.map(({ _id }) => ({
  //       created_date: _id.created_date,
  //       ticker: _id.ticker
  //     }));
  //     console.log(get_datadd)

  //     console.log(get_datadd[0].created_date);

  //     // Extract dates and tickers from aggregation result


  //     // Fetch dates with total record count
  //     const get_dates_with_count = await approveclusters.aggregate([
  //       { $match: { "ticker": ticker } },
  //       { $group: { _id: "$created_date", total_records: { $sum: 1 } } }
  //     ]);

  //     console.log("Dates with count fetched:", get_dates_with_count);

  //     // Update or create documents in the MasterDataset collection
  //     for (const { _id: created_date, total_records } of get_dates_with_count) {
  //       // const updatedRecord = await MasterDataset.findOneAndUpdate(
  //       //   { created_date: get_datadd[0].created_date },
  //       //   { $set: { total_records }, $setOnInsert: { created_at: new Date() } },
  //       //   { upsert: true, new: true }
  //       // );
  //       const updatedRecord = await MasterDataset.findOneAndUpdate(
  //         { created_date: get_datadd[0].created_date },
  //         {
  //           $inc: { total_records },
  //           $setOnInsert: { created_at: new Date() }
  //         },
  //         { upsert: true, new: true }
  //       );


  //       console.log("Master dataset record updated/created successfully:", updatedRecord);
  //     }

  //     // Check if the record exists in ClusterDataModel collection
  //     const clusterRecord = await ClusterDataModel.findOne({ "data.created_date": get_datadd[0].created_date, "data.ticker": get_datadd[0].ticker });

  //     if (!clusterRecord) {
  //       // If the record doesn't exist in ClusterDataModel, increment total_company
  //       await MasterDataset.updateOne(
  //         { created_date: get_datadd[0].created_date },
  //         { $inc: { total_company: 1 } }
  //       );

  //       console.log("Total company updated.");
  //     }
  //     let aa
  //     // Call FillBatchesHistories_adding_batch for each date and ticker
  //     for (const { created_date, ticker } of get_dates) {
  //       const response = await FillBatchesHistories_adding_batch(get_datadd[0].created_date, get_datadd[0].ticker);
  //       if (response?.err) {
  //         aa = response.err
  //         res.send(aa)
  //         break;
  //       }
  //     }

  //     // Return success response
  //     if (!aa) {
  //       return res
  //         .status(200)
  //         .json({ message: "Created Batches and Records Updated Successfully" });
  //     }


  //   } catch (error) {
  //     console.log(error);
  //     // Handle error response
  //     return res.status(500).json({ error: "Internal Server Error" });
  //   }
  // },













  // adding_batch: async (req, res, next) => {
  //   console.log('Request Body:', req.body);

  //   const { ticker } = req.body;
  //   try {
  //     // collection approveclusters

  //     const get_dates = await approveclusters.aggregate([
  //       {
  //         // Match documents where the nested ticker field equals "OMI"
  //         $match: {
  //           "ticker": ticker,
  //         },
  //       },
  //       {
  //         // Project the necessary fields, including the nested ticker field
  //         $project: {
  //           created_date: "$created_date",
  //           ticker: "$ticker",
  //         },
  //       },
  //       {
  //         // Group by created_date to remove duplicates
  //         $group: {
  //           _id: { created_date: "$created_date", ticker: "$ticker" },
  //           created_date: { $first: "$created_date" },
  //           ticker: { $first: "$ticker" },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           created_date: 1,
  //           ticker: 1,
  //         },
  //       },
  //     ]);
  //     const get_data = get_dates.map(({ created_date, ticker }) => ({ created_date: created_date.toISOString().split('T')[0], ticker }));
  //     console.log(get_data[0].created_date);    


  //     const get_dates_with_count = await approveclusters.aggregate([
  //       {
  //         $match: {
  //           "ticker": ticker,
  //         },
  //       },
  //       {
  //         $group: {
  //           _id: "$created_date",
  //           total_records: { $sum: 1 } // Calculate total count of documents for each created_date
  //         }
  //       }
  //     ]);

  //     console.log("Dates with count fetched:", get_dates_with_count);

  //     // Update or create the document in the master_dataset collection
  //     for (const { _id: created_date, total_records } of get_dates_with_count) {
  //       const updatedRecord = await MasterDataset.findOneAndUpdate(
  //         { created_date }, 
  //         { $set: { total_records }, $setOnInsert: { created_at: new Date() } }, // Update total_records and set created_at if the document is new
  //         { upsert: true, new: true } // Options: upsert - true to create if not exists, new - return updated document
  //       );

  //       console.log("Master dataset record updated/created successfully:", updatedRecord);
  //     }

  //     // Now, check if the record exists in ClusterDataModel collection
  //     const clusterRecord = await ClusterDataModel.findOne({ "data.created_date": get_data[0].created_date, "data.ticker": get_data[0].ticker });

  //     if (!clusterRecord) {
  //       // If the record doesn't exist in ClusterDataModel, increment total_company
  //       await MasterDataset.updateOne(
  //         { created_date:get_data[0].created_date},
  //         { $inc: { total_company: 1 } }
  //       );

  //       console.log("Total company updated.");
  //     }


  //     for (const { created_date, ticker } of get_dates) {
  //       await FillBatchesHistories_adding_batch(created_date, ticker, req, res);
  //     }
  //     return res
  //       .status(200)
  //       .json({ message: "Created Batches and Records Updated Successfully" });
  //     console.log(get_dates)
  //   } catch (error) {
  //     console.log(error)
  //   }

  // },

  Update_createdDate: async (req, res) => {
    const addFieldToAllDocuments = async () => {
      try {
        const currentDate = new Date('2024-04-04');
        const dateString = currentDate.toISOString();
  
        // First update: Set both created_date and approveDate where neither exist and batchId does not exist
        const updateResult1 = await approveclusters.updateMany(
          {
            batchId: { $exists: false },
            created_date: { $exists: false },
            approveDate: { $exists: false }
          },
          {
            $set: { created_date: dateString, approveDate: dateString }
          }
        );
  
        // Second update: Set only approveDate where created_date exists and batchId does not exist
        const updateResult2 = await approveclusters.updateMany(
          {
            batchId: { $exists: false },
            created_date: { $exists: true }
          },
          {
            $set: { approveDate: dateString }
          }
        );
  
        const totalUpdated = updateResult1.modifiedCount + updateResult2.modifiedCount;
        console.log(`${totalUpdated} documents were updated with the new field.`);
        res.status(200).send(`${totalUpdated} documents were updated with the new field.`);
      } catch (err) {
        console.error('Error updating documents', err);
        res.status(500).send('Error updating documents');
      }
    };
  
    await addFieldToAllDocuments();
  },
  

  // Update_createdDate: async (req, res) => {
  //   const addFieldToAllDocuments = async () => {
  //     try {
  //       const currentDate = new Date('2024-04-04');
  //       const dateString = currentDate.toISOString();
  //       const updateResult = await approveclusters.updateMany(
  //         {
  //           $or: [
  //             { created_date: { $exists: false } },
  //             { approveDate: { $exists: false } }
  //           ]
  //         },
  //         { $set: { created_date: dateString, approveDate: dateString } }
  //       );
  //       console.log(`${updateResult.modifiedCount} documents were updated with the new field.`);
  //       res.status(200).send(`${updateResult.modifiedCount} documents were updated with the new field.`);
  //     } catch (err) {
  //       console.error('Error updating documents', err);
  //       res.status(500).send('Error updating documents');
  //     }
  //   };

  //   await addFieldToAllDocuments();
  // },

  // Update_createdDate: async (req, res) => {
  //   const removeFieldsFromAllDocuments = async () => {
  //     try {
  //       const updateResult = await approveclusters.updateMany(
  //         {},
  //         { $unset: { created_date: "", approved_date: "" } }
  //       );
  //       console.log(`${updateResult.modifiedCount} documents were updated to remove the fields.`);
  //       res.status(200).send(`${updateResult.modifiedCount} documents were updated to remove the fields.`);
  //     } catch (err) {
  //       console.error('Error updating documents', err);
  //       res.status(500).send('Error updating documents');
  //     }
  //   };

  //   await removeFieldsFromAllDocuments();
  // }
}

module.exports = OmiController;
