const knex = require('knex');
const databaseConfig = require('../config/configMySql');
const db = knex(databaseConfig);

const current_mapping = {

    // get_alldata_from_current_mapping: async (req, res) => {

    //     const { ticker, search_content, page } = req.body;

    //     if (!ticker) {
    //         return res.status(400).json({ error: 'Ticker is required' });
    //     }

    //     const pageSize = 10;
    //     const currentPage = page ? parseInt(page) : 1;
    //     if (isNaN(currentPage) || currentPage < 1) {
    //         return res.status(400).json({ error: 'Invalid page number' });
    //     }

    //     const offset = (currentPage - 1) * pageSize;

    //     let query = `SELECT * FROM ra.map_${ticker} WHERE ticker = ?`;
    //     let queryParams = [ticker];

    //     if (search_content) {
    //         query += ' AND (Model LIKE ? OR ProductFamily LIKE ? OR ProductCategory LIKE ?)';
    //         const commanDataPattern = `%${search_content}%`;
    //         queryParams.push(commanDataPattern, commanDataPattern, commanDataPattern);
    //     }

    //     // count
    //     let totalCountQuery = `SELECT COUNT(*) AS totalRowCount FROM ra.map_${ticker} WHERE ticker = ?`;
    //     let totalCountParams = [ticker];

    //     if (search_content) {
    //         totalCountQuery += ' AND (Model LIKE ? OR ProductFamily LIKE ? OR ProductCategory LIKE ?)';
    //         const commonDataPattern = `%${search_content}%`;
    //         totalCountParams.push(commonDataPattern, commonDataPattern, commonDataPattern);
    //     }


    //     const [totalRowCountResult] = await db.raw(totalCountQuery, totalCountParams);
    //     console.log(totalRowCountResult)

    //     query += ` ORDER BY Model OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    //     queryParams.push(offset, pageSize);

    //     try {
    //         const result = await db.raw(query, queryParams);
    //         res.status(200).json({
    //             message: 'Data fetched successfully',
    //             data: result,
    //             pagination: {
    //                 currentPage,
    //                 rowPerPage: pageSize,
    //                 // totalPages: totalPages,
    //                 totalPages:Math.ceil(totalRowCountResult.totalRowCount / pageSize)
    //             }
    //         });
    //     } catch (error) {
    //         console.error("Error executing query:", error);
    //         res.status(500).json({ error: 'Internal server error' });
    //     }
    // },
    
    // get_alldata_from_current_mapping: async (req, res) => {
    //     const { ticker, search_content, page } = req.body;
    
    //     if (!ticker) {
    //         return res.status(400).json({ error: 'Ticker is required' });
    //     }
    
    //     const pageSize = 50;
    //     const currentPage = page ? parseInt(page) : 1;
    //     if (isNaN(currentPage) || currentPage < 1) {
    //         return res.status(400).json({ error: 'Invalid page number' });
    //     }
    
    //     const offset = (currentPage - 1) * pageSize;
    
    //     let query = `SELECT * FROM ra.map_${ticker} WHERE ticker = ?`;
    //     let queryParams = [ticker];
    
    //     if (search_content) {
    //         query += ' AND (Model LIKE ? OR ProductFamily LIKE ? OR ProductCategory LIKE ? OR ItemDescription LIKE ?)';
    //         const commonDataPattern = `%${search_content}%`;
    //         queryParams.push(commonDataPattern, commonDataPattern, commonDataPattern, commonDataPattern);
    //     }
    
    //     // count
    //     let totalCountQuery = `SELECT COUNT(*) AS totalRowCount FROM ra.map_${ticker} WHERE ticker = ?`;
    //     let totalCountParams = [ticker];
    
    //     if (search_content) {
    //         totalCountQuery += ' AND (Model LIKE ? OR ProductFamily LIKE ? OR ProductCategory LIKE ? OR ItemDescription LIKE ?)';
    //         const commonDataPattern = `%${search_content}%`;
    //         totalCountParams.push(commonDataPattern, commonDataPattern, commonDataPattern, commonDataPattern);
    //     }
    
    //     const [totalRowCountResult] = await db.raw(totalCountQuery, totalCountParams);
    
    //     query += ` ORDER BY Model OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    //     queryParams.push(offset, pageSize);
    // console.log(query)
    //     try {
    //         const result = await db.raw(query, queryParams);
    //         res.status(200).json({
    //             message: 'Data fetched successfully',
    //             data: result,
    //             pagination: {
    //                 currentPage,
    //                 rowPerPage: pageSize,
    //                 totalPages: Math.ceil(totalRowCountResult.totalRowCount / pageSize)
    //             }
    //         });
    //     } catch (error) {
    //         console.error("Error executing query:", error);
    //         res.status(500).json({ error: 'Internal server error' });
    //     }
    // },
    
    get_alldata_from_current_mapping: async (req, res) => {
        const { ticker, search_content, page } = req.body;
    
        if (!ticker) {
            return res.status(400).json({ error: 'Ticker is required' });
        }
    
        const pageSize = 50;
        const currentPage = page ? parseInt(page) : 1;
        if (isNaN(currentPage) || currentPage < 1) {
            return res.status(400).json({ error: 'Invalid page number' });
        }
    
        const offset = (currentPage - 1) * pageSize;
    
        let query = `SELECT * FROM ra.map_${ticker} WHERE ticker = ?`;
        let queryParams = [ticker];
    
        if (search_content) {
            // Replace spaces with % in search_content
            const searchContentPattern = search_content.replace(/\s/g, '%');
            query += ' AND (Model LIKE ? OR ProductFamily LIKE ? OR ProductCategory LIKE ? OR ItemDescription LIKE ?)';
            const commonDataPattern = `%${searchContentPattern}%`;
            queryParams.push(commonDataPattern, commonDataPattern, commonDataPattern, commonDataPattern);
        }
    
        // count
        let totalCountQuery = `SELECT COUNT(*) AS totalRowCount FROM ra.map_${ticker} WHERE ticker = ?`;
        let totalCountParams = [ticker];
    
        if (search_content) {
            // Replace spaces with % in search_content for total count query
            const searchContentPattern = search_content.replace(/\s/g, '%');
            totalCountQuery += ' AND (Model LIKE ? OR ProductFamily LIKE ? OR ProductCategory LIKE ? OR ItemDescription LIKE ?)';
            const commonDataPattern = `%${searchContentPattern}%`;
            totalCountParams.push(commonDataPattern, commonDataPattern, commonDataPattern, commonDataPattern);
        }
    
        const [totalRowCountResult] = await db.raw(totalCountQuery, totalCountParams);
    
        query += ` ORDER BY Model OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
        queryParams.push(offset, pageSize);
    
        try {
            const result = await db.raw(query, queryParams);
            res.status(200).json({
                message: 'Records fetched successfully',
                data: result,
                pagination: {
                    currentPage,
                    rowPerPage: pageSize,
                    totalPages: Math.ceil(totalRowCountResult.totalRowCount / pageSize)
                }
            });
        } catch (error) {
            console.error("Error executing query:", error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
    
}


module.exports = current_mapping;