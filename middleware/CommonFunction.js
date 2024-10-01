const ClusterDataModel = require("../model/ClusterDataModel");
const CompaniesModel = require("../model/CompaniesModel");
const CompanyModel = require("../model/CompanyModel");
const InputDataModel = require("../model/InputDataModel");
const BatchesHistory = require("../model/batchesHistory");
const ClusterdatasArchives = require("../model/clusterdatasArchives");

const getFullName = async (ticker) => {
  try {
    const company = await CompanyModel.findOne({ ticker: ticker });

    if (company) {
      return company.company;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching full name:", error);
    return null;
  }
};

const removeIdField = async (obj, visited = new Set()) => {
  if (visited.has(obj)) return;

  visited.add(obj);

  for (let key in obj) {
    if (key === "_id") {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      removeIdField(obj[key], visited);
    }
  }
};

const trimAndRemoveExtraSpaces = async (
  obj,
  depth = 0,
  maxDepth = 10,
  seen = new WeakSet()
) => {
  // Check if the maximum depth has been reached or if the object has been seen before
  if (depth >= maxDepth || seen.has(obj)) {
    return;
  }

  seen.add(obj);

  for (const key in obj) {
    if (
      typeof obj[key] === "string" &&
      key !== "ManufacturerCatalogNumber" &&
      key !== "ItemDescription"
    ) {
      // Trim and remove extra spaces from string values
      obj[key] = obj[key].trim().replace(/\s+/g, " ");
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      // Recursively call trimAndRemoveExtraSpaces for nested objects
      trimAndRemoveExtraSpaces(obj[key], depth + 1, maxDepth, seen);
    }
  }
};



const FillBatchesHistory = async (created_date, ticker) => {
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
  const companyName = await getFullName(ticker);

  if (!companyName || companyName.length === 0) {
    return { err: "Company name is missing or not found" };
  }

  const inputDatas = await InputDataModel.find({
    ticker,
    created_date: dateString,
  }).lean();
  // let inputDatas = inputDatasOriginal;

  if (inputDatas?.length === 0) {
    return { err: "No data found for the provided ticker" };
  }

  const batch_exists = await BatchesHistory.findOne(
    { created_date: dateString, ticker },
    { batchName: 1 }
  ).sort({ batch_date: -1 });
  let lastVersion = batch_exists
    ? Number(batch_exists.batchName.split("Batch ")[1])
    : 0;

  // if(batch_exists?.batchRecords < BatchesLength){
  //     const neededRecords = BatchesLength - batch_exists.batchRecords;
  //     const records = neededRecords >= inputDatas ? batch_exists.batchRecords + inputDatas?.length : BatchesLength;
  //     // The splice() method overwrites the original array
  //     inputDatas.splice(0,neededRecords);
  //     const result = await BatchesHistory.updateOne({ batchRecords: records, batch_date: Date.now() })
  // }



  // ###########################  Outer loop for each batch  ###################################
  for (let i = 0; i < inputDatas?.length / BatchesLength; i++) {
    lastVersion++;
    const batch_name = `${formattedDate} - Batch ${lastVersion}`;

    // Get the current batch of elements from inputDatas
    const start = i * BatchesLength;
    const end = Math.min(start + BatchesLength, inputDatas.length);
    const singleBatchData = inputDatas.slice(start, end);

    // Aggregate data from InputDataModel to get count of category_flag of a ticker
    const ClusterExactCount = await InputDataModel.aggregate([
      {
        // Match documents with the specific ticker
        $match: { _id: { $in: singleBatchData.map((el) => el._id) } },
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
    let cluster_count, exact_count;
    for (const data of ClusterExactCount) {
      if (data.category_flag === "Clustered") cluster_count = data.count;
      else exact_count = data.count;
    }

    // ##################### Create batches on each outer loop (no. batches) #####################
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

    // Transfering data in Archives & Clusterdatas collection

    //#################### Each single record (inputData) loop in singleBatchData ############################
    for (let inputData of singleBatchData) {
      //-------------Transfer data into ClusterdatasArchivesModel----------------
      const newDataArchieve = new ClusterdatasArchives({
        batchId: batchId,
        data: inputData,
      });
      await newDataArchieve.save();

      // Trim and remove extra spaces from all string fields
      trimAndRemoveExtraSpaces(inputData);
      await removeIdField(inputData);

      // Add company name to nested objects within inputData
      inputData.Company = companyName;

      //############## Providing a uniqueId and add missing fields to Clustered_point or Exact_point. ############
      for (let key in inputData) {
        const value = inputData[key];

        const Clustered_point = value;
        if (Array.isArray(Clustered_point)) {
          Clustered_point.forEach((obj) => {
            obj.uniqueId = Math.floor(Math.random() * 1000000000);
            obj.ManufacturerId = obj?.ManufacturerId
              ? obj?.ManufacturerId
              : inputData?.ManufacturerId;
            obj.ManufacturerCatalogNumber = obj?.ManufacturerCatalogNumber
              ? obj?.ManufacturerCatalogNumber
              : inputData?.ManufacturerCatalogNumber;
            obj.ItemDescription = obj?.ItemDescription
              ? obj?.ItemDescription
              : inputData?.ItemDescription;
            obj.Company = obj?.Company ? obj?.Company : companyName;
          });
        } else if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          const exactPoint = value; // Access Exact_point here
          // console.log("my exact------",exactPoint)
          exactPoint.uniqueId = Math.floor(Math.random() * 1000000000);
          exactPoint.ManufacturerId = exactPoint?.ManufacturerId
            ? exactPoint?.ManufacturerId
            : inputData?.ManufacturerId;
          exactPoint.ManufacturerCatalogNumber =
            exactPoint?.ManufacturerCatalogNumber
              ? exactPoint?.ManufacturerCatalogNumber
              : inputData?.ManufacturerCatalogNumber;
          exactPoint.ItemDescription = exactPoint?.ItemDescription
            ? exactPoint?.ItemDescription
            : inputData?.ItemDescription;
          exactPoint.Company = exactPoint?.Company
            ? exactPoint?.Company
            : companyName;
        }
      }
      // ######################## END of providing uniqueID loop #############################

      // ----------------Transfer data from InputDataModel to ClusterDataModel---------------
      const newTableData = new ClusterDataModel({
        batchId: batchId,
        data: inputData,
      });
      await newTableData.save();
    }
    // ######################## END of singleRecord (inputData) in singleBatchData ###############
  }
  // ############################## END of Outer loop for batches ####################################

  //------Create a single entry in CompaniesModel for each company with same created_date with total count-------
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
    status: "Approve",
  });

  //------------------- Delete [transferred data | filtered inputDatas] from  InputDataModel------------------------
  await InputDataModel.deleteMany({ ticker, created_date: dateString });
};





const requiredKeys = [
  "Group",
  "Anatomy",
  "Business",
  "Division",
  "Model",
  "ProductCategory",
  "ProductFamily",
  "Specialty",
  "SubAnatomy",
  "Therapy",
  "productCode",
  "productCodeName",
];

module.exports = {
  FillBatchesHistory,
  getFullName,
  removeIdField,
  trimAndRemoveExtraSpaces,
  requiredKeys,
};
