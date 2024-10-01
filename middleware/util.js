const moment = require('moment');

function getBatchWeekRange(currentDate) {
    const currentMoment = moment(currentDate);
    const currentDayOfWeek = currentMoment.day();

    let startOfCurrentWeek, endOfCurrentWeek, startOfLastWeek, endOfLastWeek;

    if (currentDayOfWeek < 4) { // If current day is before Thursday
        startOfCurrentWeek = currentMoment.clone().subtract(currentDayOfWeek + 3, 'days'); // Last Thursday
    } else { // If current day is Thursday or after
        startOfCurrentWeek = currentMoment.clone().subtract(currentDayOfWeek - 4, 'days'); // This Thursday
    }

    endOfCurrentWeek = startOfCurrentWeek.clone().add(6, 'days'); // Upcoming Wednesday
    startOfLastWeek = startOfCurrentWeek.clone().subtract(7, 'days'); // Last Thursday
    endOfLastWeek = endOfCurrentWeek.clone().subtract(7, 'days'); // Last Wednesday

    return {
        currentWeek: {
            startOfWeek: startOfCurrentWeek.format('YYYY-MM-DD'),
            endOfWeek: endOfCurrentWeek.format('YYYY-MM-DD')
        },
        lastWeek: {
            startOfWeek: startOfLastWeek.format('YYYY-MM-DD'),
            endOfWeek: endOfLastWeek.format('YYYY-MM-DD')
        }
    };
}
module.exports = getBatchWeekRange;
// Example usage:
// const currentDate = '2024-05-14'; // Change this to the current date
// const dateRange = getBatchWeekRange(currentDate);
// console.log(`Batch week starts on: ${dateRange.startOfWeek}`);
// console.log(`Batch week ends on: ${dateRange.endOfWeek}`);
