const { response } = require("express");
const mongoose = require("mongoose");
const APPROVED_MATCHES = require("../model/ApproveModel");
const BATCH_MODEL = require("../model/batchesHistory");
const MASTERDATA_SET = require("../model/master_dataset");
const EVENT_HISTORY = require("../model/eventsHistory");
const USER_MODEL = require("../model/userModel");

const moment = require("moment");
const { Model } = require("mongoose");
const { get } = require("lodash");
const { requiredKeys } = require("../middleware/CommonFunction");
const limit = 5;

async function getBatchWeekRange(currentDate) {
  const currentMoment = moment(currentDate);
  const currentDayOfWeek = currentMoment.day();

  let startOfCurrentWeek, endOfCurrentWeek, startOfLastWeek, endOfLastWeek;

  if (currentDayOfWeek < 4) {
    // If current day is before Thursday
    startOfCurrentWeek = currentMoment
      .clone()
      .subtract(currentDayOfWeek + 3, "days"); // Last Thursday
  } else {
    // If current day is Thursday or after
    startOfCurrentWeek = currentMoment
      .clone()
      .subtract(currentDayOfWeek - 4, "days"); // This Thursday
  }

  endOfCurrentWeek = startOfCurrentWeek.clone().add(6, "days"); // Upcoming Wednesday
  startOfLastWeek = startOfCurrentWeek.clone().subtract(7, "days"); // Last Thursday
  endOfLastWeek = endOfCurrentWeek.clone().subtract(7, "days"); // Last Wednesday

  return {
    currentWeek: {
      startOfWeek: startOfCurrentWeek.format("YYYY-MM-DD"),
      endOfWeek: endOfCurrentWeek.format("YYYY-MM-DD"),
    },
    lastWeek: {
      startOfWeek: startOfLastWeek.format("YYYY-MM-DD"),
      endOfWeek: endOfLastWeek.format("YYYY-MM-DD"),
    },
  };
}

let current_status_graph_1;
async function getDashboardData(dateRanges, fromDate, toDate) {
  // const fromDateParsed = new Date(fromDate);
  // const toDateParsed = new Date(toDate);

  const fromDateParsed = new Date(fromDate);
  fromDateParsed.setUTCHours(0, 0, 0, 0);

  const toDateParsed = new Date(toDate);
  toDateParsed.setUTCHours(23, 59, 59, 999);

  console.log("fromDateParsed:", fromDateParsed);
  console.log("toDateParsed:", toDateParsed);

  // get fillall data use batch to event

  let totalRecords_fillall;
  try {
    // Step 1: Fetch Batch History Records within the created_date Range
    const batchHistoryRecords = await BATCH_MODEL.find({
      created_date: {
        $gte: fromDateParsed,
        $lte: toDateParsed,
      },
    }).select("batchId"); // Only select batchId field to minimize data transfer

    // Step 2: Extract Batch IDs
    const batchIds = batchHistoryRecords.map((record) => record.batchId);
    // console.log("batheslist", batchIds)
    // Step 3: Fetch Event History Count with batchId and eventName Conditions
    const eventHistoryCount = await EVENT_HISTORY.countDocuments({
      batchId: { $in: batchIds },
      eventName: "FILL_ALL_FIELDS_CLUSTERED",
    });

    console.log(`Total Records eventHistoryCount: ${eventHistoryCount}`);

    totalRecords_fillall = eventHistoryCount;
  } catch (error) {
    console.error("Error fetching event history count:", error);
  }

  console.log("totalRecords_fillall", totalRecords_fillall);

  // const totalRecords_APPROVED_MATCHES = await APPROVED_MATCHES.countDocuments({
  //   created_at: {
  //     $gte: fromDateParsed,
  //     $lte: toDateParsed
  //   },
  //   published: { $exists: false }
  // });

  //  Batch History
  const batchPipeline = [
    {
      $facet: {
        currentWeek: [
          {
            $match: {
              created_date: {
                $gte: new Date(dateRanges.currentWeek.startOfWeek),
                $lte: new Date(dateRanges.currentWeek.endOfWeek),
              },
            },
          },
          {
            $group: {
              _id: null,
              uniqueTickers: { $addToSet: "$ticker" },
              totalRecords: { $sum: "$total_records" },
              total_approved: { $sum: "$total_approved" },
              totalClustered: { $sum: "$total_clustered" },
              totalExact: { $sum: "$total_exact" },
              activeBatches: {
                $sum: { $cond: [{ $eq: ["$is_active", 1] }, 1, 0] },
              },
            },
          },
          {
            $project: {
              uniqueTickersCount: { $size: "$uniqueTickers" },
              totalRecords: 1,
              total_approved: 1,
              totalClustered: 1,
              totalExact: 1,
              activeBatches: 1,
            },
          },
        ],
        lastWeek: [
          {
            $match: {
              created_date: {
                $gte: new Date(dateRanges.lastWeek.startOfWeek),
                $lte: new Date(dateRanges.lastWeek.endOfWeek),
              },
            },
          },
          {
            $group: {
              _id: null,
              uniqueTickers: { $addToSet: "$ticker" },
              totalRecords: { $sum: "$total_records" },
              total_approved: { $sum: "$total_approved" },
              totalClustered: { $sum: "$total_clustered" },
              totalExact: { $sum: "$total_exact" },
              activeBatches: {
                $sum: { $cond: [{ $eq: ["$is_active", 1] }, 1, 0] },
              },
            },
          },
          {
            $project: {
              uniqueTickersCount: { $size: "$uniqueTickers" },
              totalRecords: 1,
              total_approved: 1,
              totalClustered: 1,
              totalExact: 1,
              activeBatches: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        currentWeek: { $arrayElemAt: ["$currentWeek", 0] },
        lastWeek: { $arrayElemAt: ["$lastWeek", 0] },
        flags: {
          uniqueTickersFlag: {
            $cond: {
              if: {
                $gte: [
                  "$currentWeek.uniqueTickersCount",
                  "$lastWeek.uniqueTickersCount",
                ],
              },
              then: "up",
              else: "down",
            },
          },
          totalRecordsFlag: {
            $cond: {
              if: {
                $gte: ["$currentWeek.totalRecords", "$lastWeek.totalRecords"],
              },
              then: "up",
              else: "down",
            },
          },
          totalClusteredFlag: {
            $cond: {
              if: {
                $gte: [
                  "$currentWeek.totalClustered",
                  "$lastWeek.totalClustered",
                ],
              },
              then: "up",
              else: "down",
            },
          },
          totalExactFlag: {
            $cond: {
              if: { $gte: ["$currentWeek.totalExact", "$lastWeek.totalExact"] },
              then: "up",
              else: "down",
            },
          },
          activeBatchesFlag: {
            $cond: {
              if: {
                $gte: ["$currentWeek.activeBatches", "$lastWeek.activeBatches"],
              },
              then: "up",
              else: "down",
            },
          },
        },
      },
    },
  ];

  // const batchPipeline = [
  //   {
  //     $facet: {
  //       currentWeek: [
  //         {
  //           $match: {
  //             created_date: {
  //               $gte: new Date(dateRanges.currentWeek.startOfWeek),
  //               $lte: new Date(dateRanges.currentWeek.endOfWeek)
  //             }
  //           }
  //         },
  //         {
  //           $group: {
  //             _id: null,
  //             uniqueTickers: { $addToSet: "$ticker" },
  //             totalRecords: { $sum: "$total_records" },
  //             total_approved: {
  //               $sum: {
  //                 $cond: [
  //                   { $not: ["$published"] },
  //                   "$total_approved",
  //                   0
  //                 ]
  //               }
  //             },
  //             totalClustered: { $sum: "$total_clustered" },
  //             totalExact: { $sum: "$total_exact" },
  //             activeBatches: { $sum: { $cond: [{ $eq: ["$is_active", 1] }, 1, 0] } }
  //           }
  //         },
  //         {
  //           $project: {
  //             uniqueTickersCount: { $size: "$uniqueTickers" },
  //             totalRecords: 1,
  //             total_approved: 1,
  //             totalClustered: 1,
  //             totalExact: 1,
  //             activeBatches: 1
  //           }
  //         }
  //       ],
  //       lastWeek: [
  //         {
  //           $match: {
  //             created_date: {
  //               $gte: new Date(dateRanges.lastWeek.startOfWeek),
  //               $lte: new Date(dateRanges.lastWeek.endOfWeek)
  //             }
  //           }
  //         },
  //         {
  //           $group: {
  //             _id: null,
  //             uniqueTickers: { $addToSet: "$ticker" },
  //             totalRecords: { $sum: "$total_records" },
  //             total_approved: {
  //               $sum: {
  //                 $cond: [
  //                   { $not: ["$published"] },
  //                   "$total_approved",
  //                   0
  //                 ]
  //               }
  //             },
  //             totalClustered: { $sum: "$total_clustered" },
  //             totalExact: { $sum: "$total_exact" },
  //             activeBatches: { $sum: { $cond: [{ $eq: ["$is_active", 1] }, 1, 0] } }
  //           }
  //         },
  //         {
  //           $project: {
  //             uniqueTickersCount: { $size: "$uniqueTickers" },
  //             totalRecords: 1,
  //             total_approved: 1,
  //             totalClustered: 1,
  //             totalExact: 1,
  //             activeBatches: 1
  //           }
  //         }
  //       ]
  //     }
  //   },
  //   {
  //     $project: {
  //       currentWeek: { $arrayElemAt: ["$currentWeek", 0] },
  //       lastWeek: { $arrayElemAt: ["$lastWeek", 0] },
  //       flags: {
  //         uniqueTickersFlag: {
  //           $cond: {
  //             if: { $gte: ["$currentWeek.uniqueTickersCount", "$lastWeek.uniqueTickersCount"] },
  //             then: "up",
  //             else: "down"
  //           }
  //         },
  //         totalRecordsFlag: {
  //           $cond: {
  //             if: { $gte: ["$currentWeek.totalRecords", "$lastWeek.totalRecords"] },
  //             then: "up",
  //             else: "down"
  //           }
  //         },
  //         totalClusteredFlag: {
  //           $cond: {
  //             if: { $gte: ["$currentWeek.totalClustered", "$lastWeek.totalClustered"] },
  //             then: "up",
  //             else: "down"
  //           }
  //         },
  //         totalExactFlag: {
  //           $cond: {
  //             if: { $gte: ["$currentWeek.totalExact", "$lastWeek.totalExact"] },
  //             then: "up",
  //             else: "down"
  //           }
  //         },
  //         activeBatchesFlag: {
  //           $cond: {
  //             if: { $gte: ["$currentWeek.activeBatches", "$lastWeek.activeBatches"] },
  //             then: "up",
  //             else: "down"
  //           }
  //         }
  //       }
  //     }
  //   }
  // ];

  //  APPROVED_MATCHES
  // const approvedMatchesPipeline = [
  //   {
  //     $facet: {
  //       approvedMatchesCurrentWeek: [
  //         {
  //           $match: {
  //             approveDate: {
  //               $gte: new Date(dateRanges.currentWeek.startOfWeek),
  //               $lte: new Date(dateRanges.currentWeek.endOfWeek)
  //             }
  //           }
  //         },
  //         {
  //           $group: {
  //             _id: null,
  //             totalApprovedMatches: { $sum: 1 },
  //             totalPublishedMatches: { $sum: { $cond: [{ $eq: ["$published", true] }, 1, 0] } }
  //           }
  //         }
  //       ],
  //       approvedMatchesLastWeek: [
  //         {
  //           $match: {
  //             approveDate: {
  //               $gte: new Date(dateRanges.lastWeek.startOfWeek),
  //               $lte: new Date(dateRanges.lastWeek.endOfWeek)
  //             }
  //           }
  //         },
  //         {
  //           $group: {
  //             _id: null,
  //             totalApprovedMatches: { $sum: 1 },
  //             totalPublishedMatches: { $sum: { $cond: [{ $eq: ["$published", true] }, 1, 0] } }
  //           }
  //         }
  //       ]
  //     }
  //   },
  //   {
  //     $project: {
  //       approvedMatchesCurrentWeek: { $arrayElemAt: ["$approvedMatchesCurrentWeek", 0] },
  //       approvedMatchesLastWeek: { $arrayElemAt: ["$approvedMatchesLastWeek", 0] }
  //     }
  //   },
  //   {
  //     $addFields: {
  //       "approvedMatchesCurrentWeek.totalApprovedMatches": {
  //         $ifNull: ["$approvedMatchesCurrentWeek.totalApprovedMatches", 0]
  //       },
  //       "approvedMatchesCurrentWeek.totalPublishedMatches": {
  //         $ifNull: ["$approvedMatchesCurrentWeek.totalPublishedMatches", 0]
  //       },
  //       "approvedMatchesLastWeek.totalApprovedMatches": {
  //         $ifNull: ["$approvedMatchesLastWeek.totalApprovedMatches", 0]
  //       },
  //       "approvedMatchesLastWeek.totalPublishedMatches": {
  //         $ifNull: ["$approvedMatchesLastWeek.totalPublishedMatches", 0]
  //       }
  //     }
  //   }
  // ];

  const approvedMatchesPipeline = [
    {
      $facet: {
        approvedMatchesCurrentWeek: [
          {
            $match: {
              created_date: {
                $gte: new Date(dateRanges.currentWeek.startOfWeek),
                $lte: new Date(dateRanges.currentWeek.endOfWeek),
              },
            },
          },
          {
            $group: {
              _id: null,
              totalApprovedMatches: { $sum: 1 },
              totalPublishedMatches: { $sum: 1 }, // Count all matches, no condition on `published`
              totalonlyPublishedMatches: {
                $sum: { $cond: [{ $eq: ["$published", true] }, 1, 0] },
              }, // Count only matches where `published` is true
            },
          },
        ],
        approvedMatchesLastWeek: [
          {
            $match: {
              created_date: {
                $gte: new Date(dateRanges.lastWeek.startOfWeek),
                $lte: new Date(dateRanges.lastWeek.endOfWeek),
              },
            },
          },
          {
            $group: {
              _id: null,
              totalApprovedMatches: { $sum: 1 },
              totalPublishedMatches: { $sum: 1 }, // Count all matches, no condition on `published`
              totalonlyPublishedMatches: {
                $sum: { $cond: [{ $eq: ["$published", true] }, 1, 0] },
              }, // Count only matches where `published` is true
            },
          },
        ],
      },
    },
    {
      $project: {
        approvedMatchesCurrentWeek: {
          $arrayElemAt: ["$approvedMatchesCurrentWeek", 0],
        },
        approvedMatchesLastWeek: {
          $arrayElemAt: ["$approvedMatchesLastWeek", 0],
        },
      },
    },
    {
      $addFields: {
        "approvedMatchesCurrentWeek.totalApprovedMatches": {
          $ifNull: ["$approvedMatchesCurrentWeek.totalApprovedMatches", 0],
        },
        "approvedMatchesCurrentWeek.totalPublishedMatches": {
          $ifNull: ["$approvedMatchesCurrentWeek.totalPublishedMatches", 0],
        },
        "approvedMatchesCurrentWeek.totalonlyPublishedMatches": {
          $ifNull: ["$approvedMatchesCurrentWeek.totalonlyPublishedMatches", 0],
        },
        "approvedMatchesLastWeek.totalApprovedMatches": {
          $ifNull: ["$approvedMatchesLastWeek.totalApprovedMatches", 0],
        },
        "approvedMatchesLastWeek.totalPublishedMatches": {
          $ifNull: ["$approvedMatchesLastWeek.totalPublishedMatches", 0],
        },
        "approvedMatchesLastWeek.totalonlyPublishedMatches": {
          $ifNull: ["$approvedMatchesLastWeek.totalonlyPublishedMatches", 0],
        },
      },
    },
  ];

  // get separate publish true data count

  const batchHistoryRecords = await BATCH_MODEL.find({
    created_date: {
      $gte: fromDateParsed,
      $lte: toDateParsed,
    },
  }).select("batchId");

  console.log(">>>>>>>>>>>>>>>>", batchHistoryRecords);

  // console.log("cheheh", batchHistoryRecords)
  // Step 2: Extract Batch IDs
  const batchIds = batchHistoryRecords.map((record) => record.batchId);

  // Step 3: Count approvedcluster Documents where published is true and batchId is in the extracted list
  let approvedClusterCount = await APPROVED_MATCHES.countDocuments({
    batchId: { $in: batchIds },
    published: true,
  });

  let approvedClusterCount_approve = await APPROVED_MATCHES.countDocuments({
    batchId: { $in: batchIds },
  });

  const approvedClusterCount_clustered = await APPROVED_MATCHES.countDocuments({
    batchId: { $in: batchIds }, category_flag: "Clustered"
  });

  console.log("Approved Cluster ", approvedClusterCount);

  // Execute both pipelines
  const batchResults = await BATCH_MODEL.aggregate(batchPipeline).exec();
  const approvedMatchesResults = await APPROVED_MATCHES.aggregate(
    approvedMatchesPipeline
  ).exec();

  // Ensure batchResults and approvedMatchesResults are not empty
  const batchResultsCurrentWeek = batchResults[0]?.currentWeek || {};
  const batchResultsLastWeek = batchResults[0]?.lastWeek || {};
  const approvedMatchesCurrentWeek =
    approvedMatchesResults[0]?.approvedMatchesCurrentWeek || {};
  const approvedMatchesLastWeek =
    approvedMatchesResults[0]?.approvedMatchesLastWeek || {};
  const differences = {
    totalRecordsDiff:
      (batchResultsCurrentWeek.totalRecords || 0) -
      (batchResultsLastWeek.totalRecords || 0),
    totalClusteredDiff:
      (batchResultsCurrentWeek.totalClustered || 0) -
      (batchResultsLastWeek.totalClustered || 0),
    totalExactDiff:
      (batchResultsCurrentWeek.totalExact || 0) -
      (batchResultsLastWeek.totalExact || 0),
    activeBatchesDiff:
      (batchResultsCurrentWeek.activeBatches || 0) -
      (batchResultsLastWeek.activeBatches || 0),
    uniqueTickersCountDiff:
      (batchResultsCurrentWeek.uniqueTickersCount || 0) -
      (batchResultsLastWeek.uniqueTickersCount || 0),
    approvedMatchesDiff:
      (approvedMatchesCurrentWeek.totalApprovedMatches || 0) -
      (approvedMatchesLastWeek.totalApprovedMatches || 0),
    publishedRecordsDiff:
      (approvedMatchesCurrentWeek.totalPublishedMatches || 0) -
      (approvedMatchesLastWeek.totalPublishedMatches || 0),
  };

  // (Manually) Additional Condition for Extra Approved Records
  if (approvedClusterCount_approve > batchResultsCurrentWeek.totalRecords) {
    approvedClusterCount_approve = batchResultsCurrentWeek.totalRecords;
  }
  // (Manually) Additional Condition for Extra Approved Records
  if (approvedClusterCount > batchResultsCurrentWeek.totalRecords) {
    approvedClusterCount = batchResultsCurrentWeek.totalRecords
  }

  // Get the count of documents in APPROVED_MATCHES within the date range
  const current_status_graph = {
    current_status_graph: {
      "totalRecords": batchResultsCurrentWeek.totalRecords || 0,
      "approvedMatches": approvedClusterCount_approve ?? 0,
      "Total_Remaining": ((batchResultsCurrentWeek.totalRecords || 0) - approvedClusterCount_approve ?? 0)
    }
  };

  current_status_graph_1 = current_status_graph;
  // console.log("totalRecords_fillall", totalRecords_fillall);
  // console.log(
  //   "batchResultsCurrentWeek.total_approved ?? 0",
  //   batchResultsCurrentWeek.total_approved ?? 0
  // );

  const response = {
    cardArray: [
      {
        // uniqueTickersCount
        Icon: "AL",
        Heading: "All Companies",
        TotalValue: batchResultsCurrentWeek.uniqueTickersCount || 0,
        IncPerviousLoad:
          batchResultsCurrentWeek.uniqueTickersCount >
            batchResultsLastWeek.uniqueTickersCount
            ? true
            : false,
        value: differences.uniqueTickersCountDiff,
      },
      {
        // totalRecords
        Icon: "TR",
        Heading: "Total Records",
        TotalValue: batchResultsCurrentWeek.totalRecords || 0,
        IncPerviousLoad:
          batchResultsCurrentWeek.totalRecords >
            batchResultsLastWeek.totalRecords
            ? true
            : false,
        value: differences.totalRecordsDiff,
      },
      {
        // approvedMatches
        Icon: "AM",
        Heading: "Approved Matches",
        TotalValue: approvedClusterCount_approve ?? 0,
        // IncPerviousLoad: (approvedMatchesCurrentWeek.totalApprovedMatches > approvedMatchesLastWeek.totalApprovedMatches) ? true : false,
        // value: differences.approvedMatchesDiff
      },
      {
        // totalClustered
        Icon: "CM",
        Heading: "Clustered Matches",
        TotalValue: batchResultsCurrentWeek.totalClustered || 0,
        IncPerviousLoad:
          batchResultsCurrentWeek.totalClustered >
            batchResultsLastWeek.totalClustered
            ? true
            : false,
        value: differences.totalClusteredDiff,
      },
      {
        // totalExact
        Icon: "EM",
        Heading: "Exact Matches",
        TotalValue: batchResultsCurrentWeek.totalExact || 0,
        IncPerviousLoad:
          batchResultsCurrentWeek.totalExact > batchResultsLastWeek.totalExact
            ? true
            : false,
        value: differences.totalExactDiff,
      },
      {
        // fillAllPercentage
        Icon: "FAP",
        Heading: "Fill All Percentage",
        // TotalValue: Math.floor((totalRecords_fillall / (batchResultsCurrentWeek.total_approved ?? 0)) * 100 || 0)
        TotalValue: Math.min(
          Math.floor(
            (((totalRecords_fillall ?? 0) / (approvedClusterCount_clustered ?? 0)) || 0) *
            100
          ),
          100
        ),
      },
      {
        // activeBatches
        Icon: "AB",
        Heading: "Active Batches",
        TotalValue: batchResultsCurrentWeek.activeBatches || 0,
        // IncPerviousLoad: (batchResultsCurrentWeek.activeBatches > batchResultsLastWeek.activeBatches) ? true : false,
        // value: differences.activeBatchesDiff
      },
      {
        // publishedRecords
        Icon: "PR",
        Heading: "Published Records",
        TotalValue: approvedClusterCount ?? 0,
        // IncPerviousLoad: (approvedMatchesCurrentWeek.totalPublishedMatches > approvedMatchesLastWeek.totalPublishedMatches) ? true : false,
        // publishedRecvalueords_differences: differences.publishedRecordsDiff
      },
    ],
  };

  return response;
}

// Exported function to get dashboard data
const dashboardData = {
  get_dashboard_data_v1: async (req, res) => {
    const { fromDate, toDate, weekType } = req.body;

    const fromDateParsed = new Date(fromDate);
    const toDateParsed = new Date(toDate);
    const fromDateParsed_1 = new Date(fromDate);
    const toDateParsed_1 = new Date(toDate);
    try {
      if (!fromDate || !toDate || weekType === undefined) {
        return res
          .status(404)
          .json({ error: "fromDate, toDate, and weekType are required" });
      }

      let dateRanges;
      if (weekType === 0 || weekType === 1) {
        dateRanges = await getBatchWeekRange(toDate);
      }
      if (weekType === 2) {
        dateRanges = {
          currentWeek: { startOfWeek: fromDate, endOfWeek: toDate },
          lastWeek: { startOfWeek: "0000-00-00", endOfWeek: "0000-00-00" },
        };
      }

      const response = await getDashboardData(dateRanges, fromDate, toDate);
      if (!response || response.length === 0) {

        return res.status(404).json({ message: "No Records found", success: false })
      }
      res.status(200).json({
        success: true,
        ...response,
        ...current_status_graph_1,
      });
    } catch (error) {
      console.error("Error retrieving dashboard data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  get_dashboard_data_v2: async (req, res) => {
    const { fromDate, toDate } = req.body;
    try {
      // Parse the dates and set time components
      const fromDateParsed = new Date(fromDate);
      fromDateParsed.setUTCHours(0, 0, 0, 0);

      const toDateParsed = new Date(toDate);
      toDateParsed.setUTCHours(23, 59, 59, 999);

      console.log("fromDateParsed:", fromDateParsed);
      console.log("toDateParsed:", toDateParsed);

      // Step 1: Aggregate fill all counts
      // const fillAllCounts = await EVENT_HISTORY.aggregate([
      //   {
      //     $match: {
      //       created_at: { $gte: fromDateParsed, $lte: toDateParsed },
      //       eventName: "FILL_ALL_FIELDS_CLUSTERED"
      //     }
      //   },
      //   {
      //     $group: {
      //       _id: "$userId",
      //       fillAllCount: { $sum: 1 }
      //     }
      //   }
      // ]);

      // Step 1: Fetch Batch History Records within the created_date Range
      const batchHistoryRecords = await BATCH_MODEL.find({
        created_date: {
          $gte: fromDateParsed,
          $lte: toDateParsed,
        },
      }).select("batchId");

      // Step 2: Extract Batch IDs
      const batchIds = batchHistoryRecords.map((record) => record.batchId);

      // Step 3: Aggregate Event History Count grouped by userId with batchId and eventName Conditions
      const fillAllCounts = await EVENT_HISTORY.aggregate([
        {
          $match: {
            batchId: { $in: batchIds },
            eventName: "FILL_ALL_FIELDS_CLUSTERED",
          },
        },
        {
          $group: {
            _id: "$userId",
            fillAllCount: { $sum: 1 },
          },
        },
      ]);

      // console.log("fillAllCounts:", fillAllCounts);

      // Step 2: Aggregate approved matches counts
      const approvedMatchesCounts = await APPROVED_MATCHES.aggregate([
        {
          $match: {
            created_date: { $gte: fromDateParsed, $lte: toDateParsed },
          },
        },
        {
          $group: {
            _id: "$userId",
            totalApprovedMatches: { $sum: 1 },
            totalApprovedCluster: { $sum: { $cond: [{ $eq: ["$category_flag", "Clustered"] }, 1, 0] } },
          },
        },
      ]);

      // console.log("approvedMatchesCounts:", approvedMatchesCounts);

      // Step 3: Get all users
      const allUsers = await USER_MODEL.find({}).select("name");
      // console.log("allUsers:", allUsers);

      // Step 4: Create maps for quick lookup
      const fillAllCountsMap = new Map(
        fillAllCounts.map((item) => [item._id.toString(), item.fillAllCount])
      );

      const approvedMatchesCountsMap = new Map(
        approvedMatchesCounts.map((item) => [
          item._id ? item._id.toString() : null,
          {
            totalApprovedMatches: item.totalApprovedMatches,
            totalApprovedCluster: item.totalApprovedCluster
          }
        ])
      );

      // Step 5: Prepare the final data object with fillAllPercentage calculation
      const data = allUsers.map((user) => {
        const userIdStr = user._id.toString();
        const fillAllCount = fillAllCountsMap.get(userIdStr) || 0;
        const { totalApprovedMatches, totalApprovedCluster } =
          approvedMatchesCountsMap.get(userIdStr) || 0;
        const fillAllPercentage =
          totalApprovedCluster > 0
            ? Math.min(
              Math.max(fillAllCount / totalApprovedCluster) * 100,
              100)
            : 0;

        // console.log(userIdStr, fillAllCount, totalApprovedMatches);

        return {
          username: user.name,
          totalApprovedMatches,
          totalApprovedCluster,
          fillAllPercentage: Math.round(fillAllPercentage),
        };
      });

      // Step 6: Sort data by fillAllPercentage in descending order
      data.sort((a, b) => b.fillAllPercentage - a.fillAllPercentage);
      if (!data || data.length === 0) {

        return res.status(404).json({ message: "No Records found", success: false })
      }

      res.status(200).json({ message: "success", response: data });
    } catch (error) {
      console.error("Error retrieving dashboard data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // Grids API
  get_unique_ticker_allcompany: async (req, res) => {
    const { fromDate, toDate } = req.body;
    const fromDateParsed = new Date(fromDate);
    const toDateParsed = new Date(toDate);

    try {
      const uniqueTickers = await BATCH_MODEL.aggregate([
        {
          $match: {
            created_date: {
              $gte: fromDateParsed,
              $lte: toDateParsed,
            },
          },
        },
        {
          $group: {
            _id: "$ticker",
          },
        },
        {
          $group: {
            _id: null,
            tickers: { $addToSet: "$_id" },
          },
        },
        {
          $project: {
            _id: 0,
            tickers: 1,
          },
        },
        {
          $unwind: "$tickers",
        },
        {
          $sort: {
            tickers: 1, // Sort in ascending order
          },
        },
        {
          $group: {
            _id: null,
            tickers: { $push: "$tickers" },
          },
        },
        {
          $project: {
            _id: 0,
            tickers: 1,
          },
        },
      ]);
      console.log(uniqueTickers)
      if (!uniqueTickers || uniqueTickers.length === 0) {
        return res.status(404).json({ message: "Between these dates, no ticker was found.", success: false })

      }

      if (!uniqueTickers[0].tickers || uniqueTickers[0].tickers.length === 0) {

        return res.status(404).json({ message: "Between these dates, no ticker was found.", success: false })
      }
      res
        .status(200)
        .json({ message: "success", response: uniqueTickers[0].tickers });
    } catch (error) {
      console.error("Error retrieving unique tickers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  get_batch_name_with_ticker: async (req, res) => {
    const { fromDate, toDate, ticker } = req.body;

    const fromDateParsed = new Date(fromDate);
    const toDateParsed = new Date(toDate);
    try {
      // Query the BATCH_MODEL to get documents with the specified ticker
      const batchDocuments = await BATCH_MODEL.find({
        ticker: ticker,
        created_date: {
          $gte: fromDateParsed,
          $lte: toDateParsed,
        },
      })
        .select(
          "batchName companyName total_records total_clustered total_exact"
        )
        .exec();

      // Transform the response to match the desired output format
      const response = batchDocuments.map((doc) => doc.batchName);
      if (!response || response.length === 0) {

        return res.status(404).json({ message: "No Records found", success: false })
      }
      res.status(200).json({ message: "success", response: response });
    } catch (error) {
      console.error("Error retrieving batch documents:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  get_users_listing: async (req, res) => {
    try {
      const getusers = await USER_MODEL.find({}, "_id name").sort({ name: 1 });
      console.log(getusers);
      res.json(getusers); // Sending response back to the client if needed
    } catch (error) {
      console.log(error);
    }
  },
  // get_All_Companies_grid: async (req, res) => {
  //   const { fromDate, toDate, ticker, batch_name, page } = req.body;
  //   let limit = 10
  //   const fromDateParsed = new Date(fromDate);
  //   const toDateParsed = new Date(toDate);

  //   try {
  //     // Build the query object with mandatory fields
  //     const query = {
  //       ticker: ticker,
  //       created_date: {
  //         $gte: fromDateParsed,
  //         $lte: toDateParsed
  //       }
  //     };

  //     // Add the optional batch_name field to the query if it is provided
  //     if (batch_name) {
  //       query.batchName = batch_name;
  //     }

  //     // Calculate pagination parameters
  //     const skip = (page - 1) * limit;

  //     // Query the BATCH_MODEL to get documents matching the criteria
  //     const batchDocuments = await BATCH_MODEL.find(query)
  //       .select('batchName companyName total_records total_clustered total_exact')
  //       .skip(skip)
  //       .limit(limit)
  //       .exec();

  //     // Get the total count of documents matching the query (for pagination)
  //     const totalDocuments = await BATCH_MODEL.countDocuments(query);

  //     // Transform the response to match the desired output format
  //     const response = batchDocuments.map(doc => ({
  //       BatchName: doc.batchName,
  //       CompanyName: doc.companyName,
  //       TotalRecords: doc.total_records,
  //       ClusteredMatches: doc.total_clustered,
  //       ExactMatches: doc.total_exact
  //     }));

  //     res.status(200).json({
  //       message: "success",
  //       response: response,
  //       totalPages: Math.ceil(totalDocuments / limit),
  //       currentPage: page,
  //     });
  //   } catch (error) {
  //     console.error("Error retrieving batch documents:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // },

  // all company

  // get_All_Companies_grid_Data: async (req, res) => {
  //   const { fromDate, toDate, ticker, page } = req.body;
  //   // const fromDateParsed = new Date(fromDate);
  //   // const toDateParsed = new Date(toDate);
  //   const fromDateParsed = new Date(fromDate);
  //   fromDateParsed.setUTCHours(0, 0, 0, 0);

  //   const toDateParsed = new Date(toDate);
  //   toDateParsed.setUTCHours(23, 59, 59, 999);

  //   console.log("fromDateParsed:", fromDateParsed);
  //   console.log("toDateParsed:", toDateParsed);
  //   try {
  //     // Build the match object with mandatory fields
  //     const match = {
  //       created_date: {
  //         $gte: fromDateParsed,
  //         $lte: toDateParsed,
  //       },
  //     };

  //     // Add the ticker field to the match object if it is provided
  //     if (ticker) {
  //       match.ticker = ticker;
  //     }

  //     // Calculate pagination parameters
  //     const skip = (page - 1) * limit;

  //     // Aggregate data based on the match criteria
  //     // const aggregatedData = await BATCH_MODEL.aggregate([
  //     //   { $match: match },
  //     //   {
  //     //     $group: {
  //     //       _id: "$ticker",
  //     //       total_records: { $sum: "$total_records" },
  //     //       total_clustered: { $sum: "$total_clustered" },
  //     //       total_exact: { $sum: "$total_exact" },
  //     //     },
  //     //   },
  //     //   {
  //     //     $project: {
  //     //       _id: 0,
  //     //       Company: "$_id",
  //     //       total_records: 1,
  //     //       total_clustered: 1,
  //     //       total_exact: 1,
  //     //     },
  //     //   },
  //     //   { $sort: { Company: 1 } }, // Add this line to sort by Company in ascending order
  //     //   { $skip: skip },
  //     //   { $limit: limit },
  //     // ]);

  //     // // Get the total count of documents matching the query (for pagination)
  //     // const totalDocuments = await BATCH_MODEL.countDocuments(match);

  //     // Aggregation pipeline to get the data
  //     const aggregatedData = await BATCH_MODEL.aggregate([
  //       { $match: match },
  //       {
  //         $group: {
  //           _id: "$ticker",
  //           total_records: { $sum: "$total_records" },
  //           total_clustered: { $sum: "$total_clustered" },
  //           total_exact: { $sum: "$total_exact" },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           Company: "$_id",
  //           total_records: 1,
  //           total_clustered: 1,
  //           total_exact: 1,
  //         },
  //       },
  //       { $sort: { Company: 1 } }, // Sort by Company in ascending order
  //       { $skip: skip },
  //       { $limit: limit },
  //     ]);

  //     // Aggregation pipeline to get the total count
  //     const countPipeline = [
  //       { $match: match },
  //       {
  //         $group: {
  //           _id: "$ticker",
  //           total_records: { $sum: "$total_records" },
  //           total_clustered: { $sum: "$total_clustered" },
  //           total_exact: { $sum: "$total_exact" },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           Company: "$_id",
  //           total_records: 1,
  //           total_clustered: 1,
  //           total_exact: 1,
  //         },
  //       },
  //       { $sort: { Company: 1 } }, // Sort by Company in ascending order
  //       { $count: "totalCount" }, // Count the total documents after grouping
  //     ];

  //     const countResult = await BATCH_MODEL.aggregate(countPipeline);
  //     const totalDocuments = countResult.length > 0 ? countResult[0].totalCount : 0;

  //     console.log({ aggregatedData, totalDocuments });
  //     if (!aggregatedData || aggregatedData.length === 0) {

  //       return res.status(404).json({ message: "No Records found", success: false })
  //     }

  //     res.status(200).json({
  //       message: "success",
  //       aggregatedData: aggregatedData,
  //       totalPages: Math.ceil(totalDocuments / limit),
  //       currentPage: page,
  //       rowsPerPage: limit,
  //     });
  //   } catch (error) {
  //     console.error("Error retrieving aggregate data:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // },

  // get_All_Companies_grid_Data: async (req, res) => {
  //   const { fromDate, toDate, ticker, page } = req.body;
  //   const fromDateParsed = new Date(fromDate);
  //   fromDateParsed.setUTCHours(0, 0, 0, 0);

  //   const toDateParsed = new Date(toDate);
  //   toDateParsed.setUTCHours(23, 59, 59, 999);

  //   console.log("fromDateParsed:", fromDateParsed);
  //   console.log("toDateParsed:", toDateParsed);
  //   try {
  //     // Build the match object with mandatory fields
  //     const match = {
  //       created_date: {
  //         $gte: fromDateParsed,
  //         $lte: toDateParsed,
  //       },
  //     };

  //     // Add the ticker field to the match object if it is provided
  //     if (ticker) {
  //       match.ticker = ticker;
  //     }

  //     // Calculate pagination parameters
  //     const skip = (page - 1) * limit;

  //     // Aggregate data based on the match criteria
  //     const aggregatedData = await BATCH_MODEL.aggregate([
  //       { $match: match },
  //       {
  //         $group: {
  //           _id: "$ticker",
  //           total_records: { $sum: "$total_records" },
  //           total_clustered: { $sum: "$total_clustered" },
  //           total_exact: { $sum: "$total_exact" },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "approveclusters",
  //           localField: "_id",
  //           foreignField: "ticker",
  //           as: "approved_data",
  //         },
  //       },
  //       {
  //         $addFields: {
  //           total_approved: { $size: "$approved_data" },
  //         },
  //       },
  //       {
  //         $addFields: {
  //           status: {
  //             $cond: {
  //               if: { $eq: ["$total_records", "$total_approved"] },
  //               then: "completed",
  //               else: {
  //                 $cond: {
  //                   if: { $eq: ["$total_approved", 0] },
  //                   then: "todo",
  //                   else: "pending",
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           Company: "$_id",
  //           total_records: 1,
  //           total_clustered: 1,
  //           total_exact: 1,
  //           total_approved: 1,
  //           status: 1,
  //         },
  //       },
  //       { $sort: { Company: 1 } },
  //       { $skip: skip },
  //       { $limit: limit },
  //     ]);

  //     // Aggregation pipeline to get the total count
  //     const countPipeline = [
  //       { $match: match },
  //       {
  //         $group: {
  //           _id: "$ticker",
  //           total_records: { $sum: "$total_records" },
  //           total_clustered: { $sum: "$total_clustered" },
  //           total_exact: { $sum: "$total_exact" },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "approveclusters",
  //           localField: "_id",
  //           foreignField: "ticker",
  //           as: "approved_data",
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           Company: "$_id",
  //         },
  //       },
  //       { $count: "totalCount" },
  //     ];

  //     const countResult = await BATCH_MODEL.aggregate(countPipeline);
  //     const totalDocuments = countResult.length > 0 ? countResult[0].totalCount : 0;

  //     console.log({ aggregatedData, totalDocuments });
  //     if (!aggregatedData || aggregatedData.length === 0) {
  //       return res.status(404).json({ message: "No Records found", success: false });
  //     }

  //     res.status(200).json({
  //       message: "success",
  //       aggregatedData: aggregatedData,
  //       totalPages: Math.ceil(totalDocuments / limit),
  //       currentPage: page,
  //       rowsPerPage: limit,
  //     });
  //   } catch (error) {
  //     console.error("Error retrieving aggregate data:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // }


  // get_All_Companies_grid_Data: async (req, res) => {
  //   const { fromDate, toDate, ticker, page } = req.body;
  //   const fromDateParsed = new Date(fromDate);
  //   fromDateParsed.setUTCHours(0, 0, 0, 0);

  //   const toDateParsed = new Date(toDate);
  //   toDateParsed.setUTCHours(23, 59, 59, 999);

  //   console.log("fromDateParsed:", fromDateParsed);
  //   console.log("toDateParsed:", toDateParsed);
  //   try {
  //     // Build the match object with mandatory fields
  //     const match = {
  //       created_date: {
  //         $gte: fromDateParsed,
  //         $lte: toDateParsed,
  //       },
  //     };

  //     // Add the ticker field to the match object if it is provided
  //     if (ticker) {
  //       match.ticker = ticker;
  //     }

  //     // Calculate pagination parameters
  //     const skip = (page - 1) * limit;

  //     // Aggregate data based on the match criteria
  //     const aggregatedData = await BATCH_MODEL.aggregate([
  //       { $match: match },
  //       {
  //         $group: {
  //           _id: "$ticker",
  //           total_records: { $sum: "$total_records" },
  //           total_clustered: { $sum: "$total_clustered" },
  //           total_exact: { $sum: "$total_exact" },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "approveclusters",
  //           let: { ticker: "$_id" },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     { $eq: ["$ticker", "$$ticker"] },
  //                     { $gte: ["$created_date", fromDateParsed] },
  //                     { $lte: ["$created_date", toDateParsed] },
  //                   ],
  //                 },
  //               },
  //             },
  //           ],
  //           as: "approved_data",
  //         },
  //       },
  //       {
  //         $addFields: {
  //           total_approved: { $size: "$approved_data" },
  //         },
  //       },
  //       {
  //         $addFields: {
  //           status: {
  //             $cond: {
  //               if: { $eq: ["$total_records", "$total_approved"] },
  //               then: "completed",
  //               else: {
  //                 $cond: {
  //                   if: { $eq: ["$total_approved", 0] },
  //                   then: "todo",
  //                   else: "pending",
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           Company: "$_id",
  //           total_records: 1,
  //           total_clustered: 1,
  //           total_exact: 1,
  //           total_approved: 1,
  //           status: 1,
  //         },
  //       },
  //       { $sort: { Company: 1 } },
  //       { $skip: skip },
  //       { $limit: limit },
  //     ]);

  //     // Aggregation pipeline to get the total count
  //     const countPipeline = [
  //       { $match: match },
  //       {
  //         $group: {
  //           _id: "$ticker",
  //           total_records: { $sum: "$total_records" },
  //           total_clustered: { $sum: "$total_clustered" },
  //           total_exact: { $sum: "$total_exact" },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "approveclusters",
  //           let: { ticker: "$_id" },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     { $eq: ["$ticker", "$$ticker"] },
  //                     { $gte: ["$created_date", fromDateParsed] },
  //                     { $lte: ["$created_date", toDateParsed] },
  //                   ],
  //                 },
  //               },
  //             },
  //           ],
  //           as: "approved_data",
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           Company: "$_id",
  //         },
  //       },
  //       { $count: "totalCount" },
  //     ];

  //     const countResult = await BATCH_MODEL.aggregate(countPipeline);
  //     const totalDocuments = countResult.length > 0 ? countResult[0].totalCount : 0;

  //     console.log({ aggregatedData, totalDocuments });
  //     if (!aggregatedData || aggregatedData.length === 0) {
  //       return res.status(404).json({ message: "No Records found", success: false });
  //     }

  //     res.status(200).json({
  //       message: "success",
  //       aggregatedData: aggregatedData,
  //       totalPages: Math.ceil(totalDocuments / limit),
  //       currentPage: page,
  //       rowsPerPage: limit,
  //     });
  //   } catch (error) {
  //     console.error("Error retrieving aggregate data:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // }
  get_All_Companies_grid_Data: async (req, res) => {
    const { fromDate, toDate, ticker, page, status: statusFilter } = req.body; // Add statusFilter to the request body
    const fromDateParsed = new Date(fromDate);
    fromDateParsed.setUTCHours(0, 0, 0, 0);

    const toDateParsed = new Date(toDate);
    toDateParsed.setUTCHours(23, 59, 59, 999);

    console.log("fromDateParsed:", fromDateParsed);
    console.log("toDateParsed:", toDateParsed);
    try {
      // Build the match object with mandatory fields
      const match = {
        created_date: {
          $gte: fromDateParsed,
          $lte: toDateParsed,
        },
      };

      // Add the ticker field to the match object if it is provided
      if (ticker) {
        match.ticker = ticker;
      }

      // Calculate pagination parameters
      const skip = (page - 1) * limit;

      // Aggregate data based on the match criteria
      const aggregatedData = await BATCH_MODEL.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$ticker",
            total_records: { $sum: "$total_records" },
            total_clustered: { $sum: "$total_clustered" },
            total_exact: { $sum: "$total_exact" },
            total_approved: { $sum: "$total_approved" },
          },
        },
        {
          $addFields: {
            status: {
              $cond: {
                if: { $eq: ["$total_records", "$total_approved"] },
                then: "completed",
                else: {
                  $cond: {
                    if: { $eq: ["$total_approved", 0] },
                    then: "todo",
                    else: "pending",
                  },
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            Company: "$_id",
            total_records: 1,
            total_clustered: 1,
            total_exact: 1,
            total_approved: 1,
            status: 1,
          },
        },
        {
          $match: statusFilter ? { status: statusFilter } : {}, // Add the status filter
        },
        // $facet allows you to create multiple pipelines within a single aggregation query.
        // The output of $facet will always be an object containing arrays of results from the sub-pipelines.
        {
          $facet: {
            records: [
              { $sort: { Company: 1 } },
              { $skip: skip },
              { $limit: limit }
            ],
            totalDocuments: [
              { $count: "count" }
            ]
          }
        }
      ]);
      
      const records = aggregatedData[0].records;
      const totalDocuments = aggregatedData[0].totalDocuments[0] ? aggregatedData[0].totalDocuments[0].count : 0;

      if (!records || records.length === 0) {
        return res.status(404).json({ message: "No Records found", success: false });
      }

      res.status(200).json({
        message: "success",
        aggregatedData: records,
        totalPages: Math.ceil(totalDocuments / limit),
        currentPage: page,
        rowsPerPage: limit,
      });
    } catch (error) {
      console.error("Error retrieving aggregate data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }



  // total reocds
  ,
  Total_Records_grid: async (req, res) => {
    const { fromDate, toDate, ticker, page } = req.body;
    const fromDateParsed = new Date(fromDate);
    fromDateParsed.setUTCHours(0, 0, 0, 0);

    const toDateParsed = new Date(toDate);
    toDateParsed.setUTCHours(23, 59, 59, 999);

    try {
      // Build the match object with mandatory fields
      const match = {
        created_date: {
          $gte: fromDateParsed,
          $lte: toDateParsed,
        },
      };

      // Add the ticker field to the match object if it is provided
      if (ticker) {
        match.ticker = ticker;
      }

      let aggregatedData = [];

      if (ticker) {
        // Aggregate data for the specific ticker
        aggregatedData = await BATCH_MODEL.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$ticker",
              total_records: { $sum: "$total_records" },
              total_clustered: { $sum: "$total_clustered" },
              total_exact: { $sum: "$total_exact" },
              batches: {
                $push: {
                  BatchName: "$batchName",
                  total_records: "$total_records",
                  total_clustered: "$total_clustered",
                  total_exact: "$total_exact",
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              Company: "$_id",
              total_records: 1,
              total_clustered: 1,
              total_exact: 1,
              batches: 1,
            },
          },
        ]);
      } else {
        // Aggregate data for all tickers within the date range
        const tickers = await BATCH_MODEL.distinct("ticker", match);

        for (const tickerName of tickers) {
          const tickerMatch = { ...match, ticker: tickerName };

          const tickerAggregate = await BATCH_MODEL.aggregate([
            { $match: tickerMatch },
            {
              $group: {
                _id: "$ticker",
                total_records: { $sum: "$total_records" },
                total_clustered: { $sum: "$total_clustered" },
                total_exact: { $sum: "$total_exact" },
                batches: {
                  $push: {
                    BatchName: "$batchName",
                    total_records: "$total_records",
                    total_clustered: "$total_clustered",
                    total_exact: "$total_exact",
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                Company: "$_id",
                total_records: 1,
                total_clustered: 1,
                total_exact: 1,
                batches: 1,
              },
            },
          ]);

          if (tickerAggregate.length > 0) {
            aggregatedData.push(tickerAggregate[0]);
          }
        }
      }

      // Calculate pagination parameters
      const totalDocuments = aggregatedData.length;
      const totalPages = Math.ceil(totalDocuments / limit);
      const paginatedData = aggregatedData.slice(
        (page - 1) * limit,
        page * limit
      );

      if (!paginatedData || paginatedData.length === 0) {

        return res.status(404).json({ message: "No Records found", success: false })
      }

      res.status(200).json({
        message: "success",
        aggregatedData: paginatedData,
        totalPages: totalPages,
        currentPage: page,
        rowsPerPage: limit,
      });
    } catch (error) {
      console.error("Error retrieving aggregate data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // get_approved_listing: async (req, res) => {
  //   const { ticker, batchName, fromDate, toDate, page, datatype } = req.body;
  //   const fromDateParsed = new Date(fromDate);
  //   fromDateParsed.setUTCHours(0, 0, 0, 0);

  //   const toDateParsed = new Date(toDate);
  //   toDateParsed.setUTCHours(23, 59, 59, 999);

  //   let gridtype = datatype
  //   try {
  //     // Build the match object with mandatory fields
  //     const match = {
  //       created_date: {
  //         $gte: fromDateParsed,
  //         $lte: toDateParsed
  //       }
  //     };

  //     if (ticker) {
  //       match.ticker = ticker;
  //     }

  //     if (batchName) {
  //       match.batchName = batchName;
  //     }

  //     let aggregatedData = [];

  //     if (ticker && batchName) {
  //       // Get data for specific ticker and batchName
  //       aggregatedData = await BATCH_MODEL.aggregate([
  //         { $match: match },
  //         {
  //           $group: {
  //             _id: "$batchName",
  //             total_approved: { $sum: "$total_approved" }
  //           }
  //         },
  //         {
  //           $project: {
  //             _id: 0,
  //             Company: "$_id",
  //             total_approved: "$total_approved"
  //           }
  //         }
  //       ]);
  //     } else if (ticker) {
  //       // Get data for specific ticker
  //       aggregatedData = await BATCH_MODEL.aggregate([
  //         { $match: match },
  //         {
  //           $group: {
  //             _id: "$ticker",
  //             [`total_${gridtype}`]: { $sum: `$total_${gridtype}` },
  //             batches: {
  //               $push: {
  //                 BatchName: "$batchName",
  //                 [`total_${gridtype}`]: { $sum: `$total_${gridtype}` }
  //               }
  //             }
  //           }
  //         },
  //         {
  //           $project: {
  //             _id: 0,
  //             Company: "$_id",
  //             [`Total_${gridtype}`]: `$total_${gridtype}`,
  //             batches: 1
  //           }
  //         }
  //       ]);
  //     } else {
  //       // Get data for all tickers
  //       const tickers = await BATCH_MODEL.distinct("ticker", match);

  //       for (const tickerName of tickers) {
  //         const tickerMatch = { ...match, ticker: tickerName };

  //         const tickerAggregate = await BATCH_MODEL.aggregate([
  //           { $match: tickerMatch },
  //           {
  //             $group: {
  //               _id: "$ticker",
  //               [`total_${gridtype}`]: { $sum: `$total_${gridtype}` },
  //               batches: {
  //                 $push: {
  //                   BatchName: "$batchName",
  //                   [`total_${gridtype}`]: { $sum: `$total_${gridtype}` },
  //                   ticker: "$ticker"
  //                 }
  //               }
  //             }
  //           },
  //           {
  //             $project: {
  //               _id: 0,
  //               Company: "$_id",
  //               [`total_${gridtype}`]: `$total_${gridtype}`,
  //               batches: "$batches"
  //             }
  //           }
  //         ]);

  //         if (tickerAggregate.length > 0) {
  //           aggregatedData.push(tickerAggregate[0]);
  //         }
  //       }
  //     }

  //     const totalDocuments = aggregatedData.length;
  //     const totalPages = Math.ceil(totalDocuments / limit);
  //     const paginatedData = aggregatedData.slice((page - 1) * limit, page * limit);

  //     res.status(200).json({
  //       message: "success",
  //       aggregatedData: paginatedData,
  //       totalPages: totalPages,
  //       currentPage: page,
  //       rowsPerPage: limit
  //     });
  //   } catch (error) {
  //     console.error("Error retrieving approved listings:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // },

  // get_approved_listing: async (req, res) => {
  //   const { ticker, batchName, fromDate, toDate, page, datatype } = req.body;
  //   const fromDateParsed = new Date(fromDate);
  //   fromDateParsed.setUTCHours(0, 0, 0, 0);

  //   const toDateParsed = new Date(toDate);
  //   toDateParsed.setUTCHours(23, 59, 59, 999);

  //   try {
  //     const match = {
  //       created_date: {
  //         $gte: fromDateParsed,
  //         $lte: toDateParsed
  //       }
  //     };

  //     if (ticker) {
  //       match.ticker = ticker;
  //     }

  //     if (batchName) {
  //       match.batchName = batchName;
  //     }

  //     let aggregatedData = [];

  //     if (ticker && batchName) {
  //       // Aggregate for specific ticker and batchName
  //       aggregatedData = await BATCH_MODEL.aggregate([
  //         { $match: match },
  //         {
  //           $group: {
  //             _id: { Company: "$batchName", BatchName: "$batchName" },
  //             total_approved: { $sum: "$total_approved" },
  //             total_records: { $sum: "$total_records" }
  //           }
  //         },
  //         {
  //           $project: {
  //             _id: 0,
  //             Company: "$_id.Company",
  //             BatchName: "$_id.BatchName",
  //             total_approved: "$total_approved",
  //             total_records: "$total_records"
  //           }
  //         }
  //       ]);
  //     } else if (ticker) {
  //       // Aggregate for specific ticker
  //       aggregatedData = await BATCH_MODEL.aggregate([
  //         { $match: match },
  //         {
  //           $group: {
  //             _id: { Company: "$ticker", BatchName: "$batchName" },
  //             total_approved: { $sum: "$total_approved" },
  //             total_records: { $sum: "$total_records" }
  //           }
  //         },
  //         {
  //           $project: {
  //             _id: 0,
  //             Company: "$_id.Company",
  //             BatchName: "$_id.BatchName",
  //             total_approved: "$total_approved",
  //             total_records: "$total_records"
  //           }
  //         }
  //       ]);
  //     } else {
  //       // Aggregate for all tickers
  //       const tickers = await BATCH_MODEL.distinct("ticker", match);

  //       for (const tickerName of tickers) {
  //         const tickerMatch = { ...match, ticker: tickerName };

  //         const tickerAggregate = await BATCH_MODEL.aggregate([
  //           { $match: tickerMatch },
  //           {
  //             $group: {
  //               _id: { Company: "$ticker", BatchName: "$batchName" },
  //               total_approved: { $sum: "$total_approved" },
  //               total_records: { $sum: "$total_records" }
  //             }
  //           },
  //           {
  //             $project: {
  //               _id: 0,
  //               Company: "$_id.Company",
  //               BatchName: "$_id.BatchName",
  //               total_approved: "$total_approved",
  //               total_records: "$total_records"
  //             }
  //           }
  //         ]);

  //         if (tickerAggregate.length > 0) {
  //           aggregatedData = aggregatedData.concat(tickerAggregate);
  //         }
  //       }
  //     }

  //     // Pagination logic
  //     const totalDocuments = aggregatedData.length;
  //     const totalPages = Math.ceil(totalDocuments / limit);
  //     const paginatedData = aggregatedData.slice((page - 1) * limit, page * limit);

  //     res.status(200).json({
  //       message: "success",
  //       aggregatedData: paginatedData,
  //       totalPages: totalPages,
  //       currentPage: page,
  //       rowsPerPage: limit
  //     });
  //   } catch (error) {
  //     console.error("Error retrieving approved listings:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // },

  get_approved_listing: async (req, res) => {
    const { ticker, batchName, fromDate, toDate, page, datatype } = req.body;
    const fromDateParsed = new Date(fromDate);
    fromDateParsed.setUTCHours(0, 0, 0, 0);

    const toDateParsed = new Date(toDate);
    toDateParsed.setUTCHours(23, 59, 59, 999);
    let gridtype = `total_${datatype}`;

    try {
      const match = {
        created_date: {
          $gte: fromDateParsed,
          $lte: toDateParsed,
        },
      };

      if (ticker) {
        match.ticker = ticker;
      }

      if (batchName) {
        match.batchName = batchName;
      }

      let aggregatedData = [];

      if (ticker && batchName) {
        // Aggregate for specific ticker and batchName
        // aggregatedData = await BATCH_MODEL.aggregate([
        //   { $match: match },
        //   {
        //     $group: {
        //       _id: { Company: "$batchName", BatchName: "$batchName" },
        //       total_approved: { $sum: "$total_approved" },
        //       total_clustered: { $sum: "$total_clustered" },
        //       total_exact: { $sum: "$total_exact" },
        //     },
        //   },
        //   {
        //     $addFields: {
        //       fieldToProject: `$${gridtype}`,
        //     },
        //   },
        //   {
        //     $project: {
        //       _id: 0,
        //       Company: "$_id.Company",
        //       BatchName: "$_id.BatchName",
        //       // [gridtype]: "$fieldToProject"
        //       total_records: "$fieldToProject",
        //     },
        //   },
        // ]);
        // Aggregate for specific ticker and batchName
        aggregatedData = await BATCH_MODEL.aggregate([
          { $match: match },
          {
            $group: {
              _id: { Company: ticker, BatchName: "$batchName" },
              total_approved: { $sum: "$total_approved" },
              total_clustered: { $sum: "$total_clustered" },
              total_exact: { $sum: "$total_exact" },
            },
          },
          {
            $addFields: {
              fieldToProject: `$${gridtype}`,
            },
          },
          {
            $project: {
              _id: 0,
              Company: "$_id.Company",
              BatchName: "$_id.BatchName",
              // [gridtype]: "$fieldToProject"
              total_records: "$fieldToProject",
            },
          }, {
            $sort: { Company: 1, BatchName: 1 } // Sort by Company in ascending order
          }
        ]);

      } else if (ticker) {
        // Aggregate for specific ticker
        aggregatedData = await BATCH_MODEL.aggregate([
          { $match: match },
          {
            $group: {
              _id: { Company: "$ticker", BatchName: "$batchName" },
              total_approved: { $sum: "$total_approved" },
              total_clustered: { $sum: "$total_clustered" },
              total_exact: { $sum: "$total_exact" },
            },
          },
          {
            $addFields: {
              fieldToProject: `$${gridtype}`,
            },
          },
          {
            $project: {
              _id: 0,
              Company: "$_id.Company",
              BatchName: "$_id.BatchName",
              // [gridtype]: "$fieldToProject"
              total_records: "$fieldToProject",
            },
          }, {
            $sort: { Company: 1, BatchName: 1 } // Sort by Company in ascending order
          }
        ]);
      } else {
        // Aggregate for all tickers
        const tickers = await BATCH_MODEL.distinct("ticker", match);

        for (const tickerName of tickers) {
          const tickerMatch = { ...match, ticker: tickerName };

          const tickerAggregate = await BATCH_MODEL.aggregate([
            { $match: tickerMatch },
            {
              $group: {
                _id: { Company: "$ticker", BatchName: "$batchName" },
                total_approved: { $sum: "$total_approved" },
                total_clustered: { $sum: "$total_clustered" },
                total_exact: { $sum: "$total_exact" },
              },
            },
            {
              $addFields: {
                fieldToProject: `$${gridtype}`,
              },
            },
            {
              $project: {
                _id: 0,
                Company: "$_id.Company",
                BatchName: "$_id.BatchName",
                // [gridtype]: "$fieldToProject"
                total_records: "$fieldToProject",
              },
            },
            {
              $sort: { Company: 1, BatchName: 1 } // Sort by Company in ascending order
            }
          ]);

          if (tickerAggregate.length > 0) {
            aggregatedData = aggregatedData.concat(tickerAggregate);
          }
        }
      }

      // Pagination logic
      const totalDocuments = aggregatedData.length;
      const totalPages = Math.ceil(totalDocuments / limit);
      const paginatedData = aggregatedData.slice(
        (page - 1) * limit,
        page * limit
      );

      if (!paginatedData || paginatedData.length === 0) {

        return res.status(404).json({ message: "No Records found", success: false })
      }

      res.status(200).json({
        message: "success",
        aggregatedData: paginatedData,
        totalPages: totalPages,
        currentPage: page,
        rowsPerPage: limit,
      });
    } catch (error) {
      console.error("Error retrieving approved listings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  get_fill_all_Percentage: async (req, res) => {
    try {
      const { fromDate, toDate, page = 1, ticker, batchName } = req.body;
      const fromDateParsed = new Date(fromDate);
      fromDateParsed.setUTCHours(0, 0, 0, 0);
      const toDateParsed = new Date(toDate);
      toDateParsed.setUTCHours(23, 59, 59, 999);

      // Step 1: Construct the query object for fetching Batch History Records
      const query = {
        created_date: {
          $gte: fromDateParsed,
          $lte: toDateParsed,
        },
      };

      // Add optional filters
      if (ticker) {
        query.ticker = ticker;
      }
      if (batchName) {
        query.batchName = batchName;
      }

      // Fetch Batch History Records within the created_date Range
      // const batchHistoryRecords = await BATCH_MODEL.find(query).select(
      //   "batchId batchName ticker total_records"
      // );

      const batchHistoryRecords = await BATCH_MODEL.find(query)
        .select("batchId batchName ticker total_records")
        .sort({ ticker: 1 }); // Sort by ticker in ascending order


      // Group records by ticker
      const tickerData = {};

      batchHistoryRecords.forEach((record) => {
        const { ticker, batchId, total_records = 0, batchName } = record;

        if (!tickerData[ticker]) {
          tickerData[ticker] = {
            total_records: 0,
            batches: [],
          };
        }

        tickerData[ticker].total_records += total_records;
        tickerData[ticker].batches.push({ batchId, batchName, total_records });
      });

      // Get fill all event counts for each batch
      const fillAllEventCounts = await Promise.all(
        Object.keys(tickerData).map(async (ticker) => {
          const fillAllEvents = await EVENT_HISTORY.find({
            eventName: "FILL_ALL_FIELDS_CLUSTERED",
            batchId: {
              $in: tickerData[ticker].batches.map((batch) => batch.batchId),
            },
          }).select("batchId");

          const eventCounts = {};
          fillAllEvents.forEach((event) => {
            const batchIdStr = event.batchId.toString();
            if (!eventCounts[batchIdStr]) {
              eventCounts[batchIdStr] = 0;
            }
            eventCounts[batchIdStr] += 1; // Increment count for each event found
          });

          return { ticker, eventCounts };
        })
      );

      // Calculate fill all percentages
      fillAllEventCounts.forEach(({ ticker, eventCounts }) => {
        tickerData[ticker].batches.forEach((batch) => {
          const batchIdStr = batch.batchId.toString();
          const fillAllCount = eventCounts[batchIdStr] || 0;
          // batch.fillAllPercentage = Math.round(
          //   (fillAllCount / batch.total_records) * 100
          // );
          // (Manually) Additional Condition for Extra Approved Records
          batch.fillAllPercentage = Math.min(Math.round(
            (((fillAllCount ?? 0) / batch.total_records) || 0) * 100
          ), 100);
        });
        const totalFillAllCount = Object.values(eventCounts).reduce(
          (sum, count) => sum + count,
          0
        );
        // tickerData[ticker].fillAllPercentage = Math.round(
        //   (totalFillAllCount / tickerData[ticker].total_records) * 100
        // );
        // (Manually) Additional Condition for Extra Approved Records
        tickerData[ticker].fillAllPercentage = Math.min(Math.round(
          (((totalFillAllCount ?? 0) / tickerData[ticker].total_records) || 0) * 100
        ), 100);
      });

      // Structure the response data
      const responseData = Object.keys(tickerData).map((ticker) => ({
        Company: ticker,
        total_records: tickerData[ticker].total_records,
        FillAllPercentage: tickerData[ticker].fillAllPercentage,
        batches: tickerData[ticker].batches.map((batch) => ({
          BatchName: batch.batchName,
          total_records: batch.total_records,
          FillAllPercentage: batch.fillAllPercentage,
        })),
      }));

      // Implement Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedResponse = responseData.slice(startIndex, endIndex);

      if (!paginatedResponse || paginatedResponse.length === 0) {

        return res.status(404).json({ message: "No Records found", success: false })
      }

      // Return the paginated response along with pagination info
      return res.json({
        currentPage: page,
        rowsPerPage: limit,
        totalPages: Math.ceil(responseData.length / limit),
        totalRecords: responseData.length,
        aggregatedData: paginatedResponse,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  Active_Batches: async (req, res) => {
    try {
      const { ticker, batchName, fromDate, toDate, page = 1 } = req.body;

      const fromDateParsed = new Date(fromDate);
      fromDateParsed.setUTCHours(0, 0, 0, 0);

      const toDateParsed = new Date(toDate);
      toDateParsed.setUTCHours(23, 59, 59, 999);

      let query = { is_active: 1 };

      if (ticker) {
        query.ticker = ticker;
      }

      if (batchName) {
        query.batchName = batchName;
      }

      if (fromDate && toDate) {
        query.created_date = {
          $gte: fromDateParsed,
          $lte: toDateParsed,
        };
      }

      if (!ticker && !batchName) {
        // Get all batches and distinct tickers within the date range
        const allBatches = await BATCH_MODEL.find({
          created_date: {
            $gte: fromDateParsed,
            $lte: toDateParsed,
          },
        }).sort({ ticker: 1 }); // Sort by ticker in ascending order

        const distinctTickers = [
          ...new Set(allBatches.map((batch) => batch.ticker)),
        ];
        query.ticker = { $in: distinctTickers };
      }

      // Aggregate to get the count of active batches per ticker
      const tickerCounts = await BATCH_MODEL.aggregate([
        { $match: query },
        { $group: { _id: "$ticker", count: { $sum: 1 } } },
      ]);

      // Pagination
      const skip = (page - 1) * limit;

      const activeBatches = await BATCH_MODEL.find(query)
        .skip(skip)
        .limit(limit);

      const totalRecords = await BATCH_MODEL.countDocuments(query);

      // Format the response
      const formattedResponse = activeBatches.map((batch) => ({
        BatchName: batch.batchName,
        Company: batch.ticker,
        total_records:
          tickerCounts.find((t) => t._id === batch.ticker)?.count || 0,
      }));
      if (!formattedResponse || formattedResponse.length === 0) {

        return res.status(404).json({ message: "No Records found", success: false })
      }
      res.json({
        aggregatedData: formattedResponse,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        rowsPerPage: limit,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Published_Records: async (req, res) => {
  //   try {
  //     const { fromDate, ticker, toDate, page } = req.body;

  //     const fromDateParsed = new Date(fromDate);
  //     fromDateParsed.setUTCHours(0, 0, 0, 0);

  //     const toDateParsed = new Date(toDate);
  //     toDateParsed.setUTCHours(23, 59, 59, 999);

  //     // Step 1: Get unique tickers and their total count from BATCH_MODEL between dates
  //     let matchConditions = {
  //       created_date: {
  //         $gte: fromDateParsed,
  //         $lte: toDateParsed,
  //       }
  //     };

  //     if (ticker) {
  //       matchConditions.ticker = ticker;
  //     }

  //     const tickerCounts = await BATCH_MODEL.aggregate([
  //       {
  //         $match: matchConditions
  //       },
  //       {
  //         $group: {
  //           _id: "$ticker",
  //           total_records: { $sum: 1 }
  //         }
  //       }
  //     ]);

  //     const tickers = tickerCounts.map(tc => tc._id);

  //     // Step 2: Find approved records in APPROVED_MATCHES with these tickers, published: true
  //     const approvedCounts = await APPROVED_MATCHES.aggregate([
  //       {
  //         $match: {
  //           ticker: { $in: tickers },
  //           published: true
  //         }
  //       },
  //       {
  //         $group: {
  //           _id: "$ticker",
  //           total_records: {
  //             $sum: {
  //               $cond: [
  //                 { $and: [{ $eq: ["$category_flag", "Clustered"] }, { $eq: ["$published", true] }] },
  //                 1,
  //                 0
  //               ]
  //             }
  //           }
  //         }
  //       }
  //     ]);

  //     // Create a map for approved records count
  //     const approvedMap = approvedCounts.reduce((acc, ar) => {
  //       acc[ar._id] = ar.approvedRecords;
  //       return acc;
  //     }, {});

  //     // Combine results
  //     const result = tickerCounts.map(tc => ({
  //       Company: tc._id,
  //       total_records: tc.totalRecords,
  //       total_approved: approvedMap[tc._id] || 0,
  //       total_pending: tc.totalRecords - (approvedMap[tc._id] || 0)
  //     }));

  //     // Pagination
  //     const pageSize = 10;
  //     const totalRecords = result.length;
  //     const totalPages = Math.ceil(totalRecords / pageSize);
  //     const paginatedResult = result.slice((page - 1) * pageSize, page * pageSize);

  //     res.json({
  //       aggregatedData: paginatedResult,
  //       // totalRecords,
  //       totalPages,
  //       currentPage: page,
  //       rowsPerPage: limit,
  //     });
  //   } catch (err) {
  //     res.status(500).json({ error: err.message });
  //   }
  // }

  Published_Records: async (req, res) => {
    try {
      const { fromDate, ticker, toDate, page } = req.body;

      const fromDateParsed = new Date(fromDate);
      fromDateParsed.setUTCHours(0, 0, 0, 0);

      const toDateParsed = new Date(toDate);
      toDateParsed.setUTCHours(23, 59, 59, 999);

      // Step 1: Define match conditions based on request parameters
      let matchConditions = {
        created_date: {
          $gte: fromDateParsed,
          $lte: toDateParsed,
        },
      };

      if (ticker) {
        matchConditions.ticker = ticker;
      }

      // Step 2: Perform aggregation pipeline to get aggregated data
      // const tickerCounts = await BATCH_MODEL.aggregate([
      //   {
      //     $match: matchConditions,
      //   },
      //   {
      //     $group: {
      //       _id: {
      //         ticker: "$ticker",
      //         batchId: "$batchId",
      //         batchName: "$batchName",
      //       },
      //       total_records: { $sum: "$total_records" },
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "approveclusters", // Assuming the collection name is approveclusters
      //       localField: "_id.batchId", // Match with batchId in BATCH_MODEL
      //       foreignField: "batchId", // Match with batchId in approveclusters
      //       as: "approved_matches",
      //     },
      //   },
      //   {
      //     $addFields: {
      //       published_true_count: {
      //         $size: {
      //           $filter: {
      //             input: "$approved_matches",
      //             as: "match",
      //             cond: { $eq: ["$$match.published", true] },
      //           },
      //         },
      //       },
      //     },
      //   },
      //   {
      //     $match: {
      //       published_true_count: { $gt: 0 }, // Only include documents with published_true_count > 0
      //     },
      //   },
      //   {
      //     $project: {
      //       _id: 0,
      //       Company: "$_id.ticker",
      //       BatchName: "$_id.batchName",
      //       batchId: "$_id.batchId",
      //       total_records: "$total_records",
      //       total_approved: "$published_true_count",
      //       total_pending: {
      //         $subtract: ["$total_records", "$published_true_count"],
      //       },
      //     },
      //   },
      //   {
      //     $sort: { Company: 1 },
      //   }, // Sort by Company (ticker) in ascending order
      // ]);



      const tickerCounts = await BATCH_MODEL.aggregate([
        {
          $match: matchConditions,
        },
        {
          $group: {
            _id: {
              ticker: "$ticker",
              batchId: "$batchId",
              batchName: "$batchName",
            },
            total_records: { $sum: "$total_records" },
            total_approved: { $sum: "$total_approved" },

          },
        },
        {
          $lookup: {
            from: "approveclusters",
            localField: "_id.batchId",
            foreignField: "batchId",
            as: "approved_matches",
          },
        },
        {
          $addFields: {
            published_true_count: {
              $size: {
                $filter: {
                  input: "$approved_matches",
                  as: "match",
                  cond: { $eq: ["$$match.published", true] },
                },
              },
            },
            total_approved_count: {
              $size: {
                $filter: {
                  input: "$approved_matches",
                  as: "match",
                  cond: { $eq: ["$$match.approved", true] }, // Assuming 'approved' field indicates approval
                },
              },
            },
          },
        },
        {
          $match: {
            published_true_count: { $gt: 0 },
          },
        },
        // {
        //   $project: {
        //     _id: 0,
        //     Company: "$_id.ticker",
        //     BatchName: "$_id.batchName",
        //     batchId: "$_id.batchId",
        //     total_records: "$total_records",
        //     total_published: "$published_true_count",
        //     total_approved: "$total_approved", // New field for approved count
        //     total_pending: {
        //       $subtract: ["$total_records", "$total_approved"],
        //     },
        //   },
        // },

        // (Manually) Additional Condition for Extra Approved Records
        {
          $project: {
            _id: 0,
            Company: "$_id.ticker",
            BatchName: "$_id.batchName",
            batchId: "$_id.batchId",
            total_records: "$total_records",
            total_published: {
              $cond: {
                if: { $gt: ["$published_true_count", "$total_records"] },
                then: "$total_records",
                else: "$published_true_count"
              }
            },
            total_approved: {
              $cond: {
                if: { $gt: ["$total_approved", "$total_records"] },
                then: "$total_records",
                else: "$total_approved"
              }
            },
            total_pending: {
              $subtract: ["$total_records", {
                $cond: {
                  if: { $gt: ["$total_approved", "$total_records"] },
                  then: "$total_records",
                  else: "$total_approved"
                }
              }]
            }
          }
        },
        {
          $sort: { Company: 1 },
        },
      ]);


      // const tickerCounts = await BATCH_MODEL.aggregate([
      //   {
      //     $match: matchConditions,
      //   },
      //   {
      //     $group: {
      //       _id: {
      //         ticker: "$ticker",
      //         batchId: "$batchId",
      //         batchName: "$batchName",
      //       },
      //       total_records: { $sum: "$total_records" },
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "approveclusters", // Assuming the collection name is approveclusters
      //       let: { batchId: "$_id.batchId" }, // Pass batchId from BATCH_MODEL
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: { $and: [{ $eq: ["$batchId", "$$batchId"] }, { $eq: ["$published", true] }] },
      //           },
      //         },
      //       ],
      //       as: "approved_matches",
      //     },
      //   },
      //   {
      //     $addFields: {
      //       published_true_count: { $size: "$approved_matches" },
      //     },
      //   },
      //   {
      //     $project: {
      //       _id: 0,
      //       Company: "$_id.ticker",
      //       BatchName: "$_id.batchName",
      //       batchId: "$_id.batchId",
      //       total_records: "$total_records",
      //       total_approved: "$published_true_count",
      //       total_pending: { $subtract: ["$total_records", "$published_true_count"] },
      //     },
      //   },
      // ]);

      console.log(tickerCounts);


      console.log("ny new", tickerCounts);

      // Step 3: Pagination logic
      const pageSize = 5; // Adjust as needed
      const totalRecords = tickerCounts.length;
      const totalPages = Math.ceil(totalRecords / pageSize);
      const paginatedResult = tickerCounts.slice(
        (page - 1) * pageSize,
        page * pageSize
      );

      if (!paginatedResult || paginatedResult.length === 0) {

        return res.status(404).json({ message: "No Records found", success: false })
      }

      // Step 4: Respond with aggregated data and pagination information
      res.json({
        aggregatedData: paginatedResult,
        totalPages,
        currentPage: page,
        rowsPerPage: pageSize,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  User_Analytics: async (req, res) => {
    try {
      let { fromDate, toDate, userId, ticker, page } = req.body;
      const resultsPerPage = 10; // Number of results per page
      const ObjectId = require("mongoose").Types.ObjectId; // Assuming you're using Mongoose for MongoDB interactions

      // Default page number if not provided or invalid
      page = parseInt(page) || 1;
      const skip = (page - 1) * resultsPerPage;

      // Parse input dates
      const fromDateParsed = new Date(fromDate);
      fromDateParsed.setUTCHours(0, 0, 0, 0);

      const toDateParsed = new Date(toDate);
      toDateParsed.setUTCHours(23, 59, 59, 999);

      // Step 1: Build match conditions for finding Batches and APPROVED_MATCHES
      const matchConditions = {
        created_date: { $gte: fromDateParsed, $lte: toDateParsed }
      };

      if (ticker) {
        matchConditions.ticker = ticker;
      }

      // Step 2: Fetch unique batchIds within the date range
      const batchIds = await BATCH_MODEL.distinct("batchId", matchConditions);
      matchConditions.batchId = { $in: batchIds };

      if (userId) {
        matchConditions.userId = new ObjectId(userId);
      }

      // Step 3: Aggregate data from APPROVED_MATCHES with pagination
      const approvedMatchesPipeline = [
        {
          $match: matchConditions,
        },
        {
          $group: {
            _id: "$userId",
            total_approved: { $sum: 1 },
            totalApprovedCluster: { $sum: { $cond: [{ $eq: ["$category_flag", "Clustered"] }, 1, 0] } },
            tickers: { $addToSet: "$ticker" },
          },
        },
        {
          $sort: { _id: 1 },
        },
        {
          $skip: skip, // Pagination: skip results for previous pages
        },
        {
          $limit: resultsPerPage, // Pagination: limit results per page
        },
      ];

      const approvedMatchesData = await APPROVED_MATCHES.aggregate(
        approvedMatchesPipeline
      ).exec();

      // console.log("approvedmathcesData", approvedMatchesData)

      // Step 4: Fetch user details for each userId
      const userDetailsPipeline = approvedMatchesData.map(async (user) => {
        const userDetails = await USER_MODEL.findById(user._id).exec();
        return {
          userId: user._id,
          UserName: userDetails ? userDetails.name : "Unknown", // Include user name
          total_approved: user.total_approved,
          totalApprovedCluster: user.totalApprovedCluster,
          Company: user.tickers,
          ApprovedData: user.ApprovedData,
          FillAllPercentage: 0, // Placeholder for fillAllPercentage, will be calculated later
        };
      });

      const userData = await Promise.all(userDetailsPipeline);
      // console.log("userData", userData)

      // Step 5: Join with EVENT_HISTORY to get fillAllCount
      const detailedData = await Promise.all(
        userData.map(async (user) => {
          const fillAllData = await EVENT_HISTORY.aggregate([
            {
              $match: {
                userId: user.userId,
                batchId: { $in: batchIds },
                eventName: "FILL_ALL_FIELDS_CLUSTERED",
              },
            },
            {
              $group: {
                _id: null,
                fillAllCount: { $sum: 1 }, // Count all matched documents
                uniqueBatchIds: { $addToSet: "$batchId" }, // Collect unique batchIds
              },
            },
            {
              $project: {
                _id: 0,
                fillAllCount: 1,
                uniqueBatchIds: 1,
              },
            },
            // {
            //   $count: "fillAllCount"
            // }
          ]).exec();

          // console.log("unquie batch",fillAllData[0]?.uniqueBatchIds.length)
          // console.log("count lhere", fillAllData[0]?.fillAllCount)

          const fillAllCount = fillAllData.length > 0 ? fillAllData[0]?.fillAllCount || 0 : 0;
          console.log("hlo", fillAllCount);
          const FillAllPercentage = user.totalApprovedCluster > 0 ? ((fillAllCount / user.totalApprovedCluster) || 0) * 100 : 0;

          let ApproveFillAllData = [];
          let FilledRows = requiredKeys.reduce((acc, item) => {
            switch (item) {
              case "Model":
              case "comment":
                acc[item] = "-";
                break;
              default:
                acc[item] = "Other";
            }
            return acc;
          }, {});

          // console.log(FilledRows);

          if (fillAllData[0]?.uniqueBatchIds?.length > 0) {
            ApproveFillAllData = await APPROVED_MATCHES.aggregate([
              {
                $match: {
                  userId: user.userId,
                  batchId: { $in: fillAllData[0]?.uniqueBatchIds },
                  category_flag: "Clustered",
                  created_date: matchConditions.created_date,
                  ...FilledRows,
                },
              },
              {
                $project: {
                  _id: 0,
                  ApprovedData: "$$ROOT", // $$ROOT includes the entire document
                },
              },
            ]).exec();
          }

          let ApprovedData = ApproveFillAllData.map(
            (item) => item.ApprovedData
          );

          return {
            ...user,
            FillAllPercentage: Math.min(Math.round(FillAllPercentage.toFixed(2)), 100),
            ApprovedData,
          };
        })
      );

      // Calculate pagination metadata
      const totalUsers = await APPROVED_MATCHES.distinct(
        "userId",
        matchConditions
      ).exec();
      const totalPages = Math.ceil(totalUsers.length / resultsPerPage);

      if (!detailedData || detailedData.length === 0) {

        return res.status(404).json({ message: "No Records found", success: false })
      }

      res.status(200).json({
        aggregatedData: detailedData,
        // pagination: {
        totalPages: totalPages,
        currentPage: page,
        rowsPerPage: resultsPerPage,
        // }
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  },
};
module.exports = dashboardData;
