const { getFullName, trimAndRemoveExtraSpaces, removeIdField } = require("../middleware/CommonFunction");
const ClusterDataModel = require("../model/ClusterDataModel");
const BatchesHistory = require("../model/batchesHistory");
const ClusterdatasArchives = require("../model/clusterdatasArchives");
const approveclusters = require("../model/ApproveModel");
const MasterDataset = require("../model/master_dataset");
const { response } = require("express");
const { ObjectId } = require('mongodb');
const CompaniesModel = require("../model/CompaniesModel");



const FillBatchesHistories_adding_batch = async (created_date, ticker) => {
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
    return { err: "Company name is missing or not found" };
  }
  console.log("dateString", dateString)
  const inputDatas = await approveclusters.find({
    ticker: ticker,
    created_date: dateString,
    batchId: { $exists: false }
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

    console.log("Hi here batchId:", batchId)

    // Looping on the currentbatch of elements from inputDatas
    for (let inputData of inputDatasCurrentElements) {
      // await trimAndRemoveExtraSpaces(inputData.data);
      // await removeIdField(inputData.data);

      // Transfer data from InputDataModel to ClusterDataModel
      const updateTableData = await approveclusters.updateOne(
        { _id: inputData._id }, // Filter to find the document
        { $set: { userId: new ObjectId('667ac21ffc96134aad01f18d'), batchId: batchId } }
      );

      if (updateTableData.matchedCount === 0) {
        console.log("No document matched the provided _id.", batchId);
      } else {
        // console.log("Document updated successfully in approvedcluster.");
      }

      const newDataArchieve = new ClusterdatasArchives({
        batchId: batchId,
        data: inputData.data,
      });
      await newDataArchieve.save();
      //   }
    }
  }

};

const addingbatchController = {

  adding_batch: async (req, res, next) => {
    try {
      const uniqueTickers = await approveclusters.aggregate([
        {
          $group: {
            _id: "$ticker"
          }
        },
        {
          $group: {
            _id: null,
            tickers: { $addToSet: "$_id" }
          }
        },
        {
          $project: {
            _id: 0,
            tickers: 1
          }
        }
      ]);
      // console.log("unique",uniqueTickers[0].tickers)

      for (let ticker of uniqueTickers[0].tickers) {
        const get_dates = await approveclusters.aggregate([
          { $match: { "ticker": ticker } },
          {
            $group: {
              _id: {
                created_date: { $dateToString: { date: "$created_date" } },
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

        // console.log(created_date);

        // Extract dates and tickers from aggregation result


        // Fetch dates with total record count
        const get_dates_with_count = await approveclusters.aggregate([
          { $match: { "ticker": ticker } },
          { $group: { _id: "$created_date", total_records: { $sum: 1 } } }
        ]);

        console.log("Dates with count fetched:", get_dates_with_count);

        // Update or create documents in the MasterDataset collection
        for (const { _id: created_date, total_records } of get_dates_with_count) {
          const datetimeString = created_date;
          const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(datetimeString);
          const dateString = isValidFormat
            ? datetimeString
            : datetimeString.toISOString().split("T")[0];

          const updatedRecord = await MasterDataset.findOneAndUpdate(
            { created_date: dateString },
            {
              $inc: { total_records },
              $setOnInsert: { created_at: new Date() }
            },
            { upsert: true, new: true }
          );
          // console.log("my updated Records:",updatedRecord)

          // Check if the record exists in ClusterDataModel collection
          const clusterRecord = await ClusterDataModel.findOne({ "data.created_date": created_date, "data.ticker": ticker });

          if (!clusterRecord) {
            // If the record doesn't exist in ClusterDataModel, increment total_company
            await MasterDataset.updateOne(
              { created_date: dateString },
              { $inc: { total_company: 1 } }
            );

            // console.log("Total company updated.");
          }
        }

        console.log("All groups for ticker and created_date", get_dates)
        // Call FillBatchesHistories_adding_batch for each date and ticker
        // for (const { created_date, ticker } of get_dates) {
        //   const response = await FillBatchesHistories_adding_batch(get_datadd[0].created_date, get_datadd[0].ticker);
        // }
        for (const { _id: { created_date, ticker } } of get_dates) {
          const response = await FillBatchesHistories_adding_batch(created_date, ticker);
        }
      }


      return res
        .status(200)
        .json({ message: "Created Batches and Records Updated Successfully" });


    } catch (error) {
      console.log(error);
      // Handle error response
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  change_date: async (req, res) => {
    try {
      const startOfDay = new Date("2024-06-26T00:00:00.000Z");
      const endOfDay = new Date("2024-06-26T23:59:59.999Z");
      const newApproveDate = new Date("2024-06-27T00:00:00.000Z");

      const filter = {
        approveDate: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      };
      const update = { approveDate: newApproveDate };

      const updatedDocument = await approveclusters.updateMany(filter, update);

      res.status(200).json(updatedDocument);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  Update_batch_for_approved: async (req, res) => {
    try {

      const filter = {
        ticker: { $nin: ["OMI", "MDXG"] }
      };

      const update = [
        {
          $set: {
            total_approved: "$total_records",
            is_active: 0,
            batchEndDate: "$created_date"
          }
        }
      ];

      const updatedDocuments = await BatchesHistory.updateMany(filter, update);

      console.log('Updated documents:', updatedDocuments);

      const filter2 = {
        ticker: { $in: ["OMI", "MDXG"] }
      };


      // Step 1: Aggregate Counts in `approveclusters`
      const approveclustersCounts = await approveclusters.aggregate([
        {
          $match: {
            ...filter2,
            batchId: { $exists: true }
          }
        },
        {
          $group: {
            _id: "$batchId",
            count: { $sum: 1 }
          }
        }
      ]);

      // Step 2: Conditional Update in `BatchesHistory`
      for (const { _id: batchId, count } of approveclustersCounts) {
        await BatchesHistory.updateMany(
          { ...filter2, batchId },
          [
            {
              $set: {
                total_approved: count
              }
            },
            {
              $set: {
                is_active: {
                  $cond: { if: { $eq: ["$total_records", count] }, then: 0, else: "$is_active" }
                }
              }
            },
            {
              $set: {
                batchEndDate: {
                  $cond: { if: { $eq: ["$total_records", count] }, then: "$created_date", else: "$batchEndDate" }
                }
              }
            }
          ]
        );
      }

      console.log('Update complete', approveclustersCounts);

      res.status(200).json(updatedDocuments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  Update_status_Approve: async (req, res) => {
    try {
      const doc = await CompaniesModel.updateMany(
        { status: { $in: ["Disapproved", "Approved"] } },
        [
          {
            $set: {
              status: {
                $cond: {
                  if: { $eq: ["$status", "Approved"] },
                  then: "Approve",
                  else: "Disapprove"
                }
              }
            }
          }
        ]
      );
      

      console.log("aggerate",doc);



      res.status(200).json({message: "success"});
     
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

}

module.exports = addingbatchController;