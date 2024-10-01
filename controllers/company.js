const CompanyModel = require('../model/CompanyModel');

const company = {
    // get_all_tickers: async (req, res) => {

        
    //     // try {
    //     //     const tickers = await CompanyModel.find({}, { ticker: 1, _id: 0 });
    //     //     // Send the tickers as a response
    //     //     res.status(200).json({ tickers });
    //     // } catch (error) {
    //     //     // Handle any errors
    //     //     console.error('Error retrieving tickers:', error);
    //     //     res.status(500).json({ error: 'Internal server error' });
    //     // }
    // }

    get_all_tickers: async (req, res) => {
        try {
            // Find all documents and project only the ticker field
            const companies = await CompanyModel.find({}, { ticker: 1, _id: 0 }).sort({ ticker: 1 });

            // Extract ticker names from the documents
            const tickerNames = companies.map(company => company.ticker);

            // Send the ticker names as a response
            res.status(200).json({ tickerNames });
        } catch (error) {
            // Handle any errors
            console.error('Error retrieving tickers:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};


module.exports = company;
