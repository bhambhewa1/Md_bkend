const approvedMatchesLogs = require('../model/approvedMatchesLogs');
const UserModel = require('../model/userModel')
const approvedMatches_Logs = {

    aprroved_matches_logs: async (req, res) => {
        try {
            const {
              ticker,
              category_flag,
              manufacturerId,
              manufacturerCatalogNumber,
              itemDescription,
              group,
              company,
              business,
              division,
              therapy,
              specialty,
              anatomy,
              subAnatomy,
              productCategory,
              productFamily,
              model,
              index,
              embedding,
              fuzzy,
              total,
              productCode,
              productCodeName,
              approval_status,
              comment,
              isEditRow,
              batchId,
              approvalDate,
              email,
              actionType,
              approvedHistory
            } = req.body;
            const user = await UserModel.findOne({ email }).select('_id');

            const newLog = new approvedMatchesLogs({
              ticker,
              category_flag,
              manufacturerId,
              manufacturerCatalogNumber,
              itemDescription,
              group,
              company,
              business,
              division,
              therapy,
              specialty,
              anatomy,
              subAnatomy,
              productCategory,
              productFamily,
              model,
              index,
              embedding,
              fuzzy,
              total,
              productCode,
              productCodeName,
              approval_status,
              comment,
              isEditRow,
              batchId,
              approvalDate,
              userId:user._id,
              actionType,
              approvedHistory
            });
        
            await newLog.save();
        
            res.status(201).send(newLog);
          } catch (error) {
            console.log(error)
            res.status(500).send({ error: 'Failed to create log entry', });
          }    
    }
    
};


module.exports = approvedMatches_Logs;
