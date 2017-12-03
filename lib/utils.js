StocksReactUtils = {
    getMinMaxFromArrOfObj: function (arrOfObj, key) {
        var _max = -1000000000.00;
        var _min = 1000000000.00;
        if (arrOfObj && arrOfObj.length > 0) {
            arrOfObj.forEach(function (obj) {
                var _val = parseFloat(obj[key]);
                if (_val > _max) {
                    _max = _val;
                }
                if (_val < _min) {
                    _min = _val;
                }
            });

            return [_min, _max];
        } else {
            return [];
        }
    },
    getClosestPreviousWeekDayDateByCutoffTime: function (cutoffTime, OPTIONALrequestMomentDateTimeRightNowNyTime) {
        let requestMomentDateTimeRightNowNyTime = OPTIONALrequestMomentDateTimeRightNowNyTime || moment().tz("America/New_York");

        var _alternativeDateTime = requestMomentDateTimeRightNowNyTime.format("YYYY-MM-DD HH:mm:ss");
        let originalDateYYYY_MM_DD = requestMomentDateTimeRightNowNyTime.format("YYYY-MM-DD");
        var _timeStr = _alternativeDateTime.substring(11, _alternativeDateTime.length);


        let _beforeCutoffTime = _timeStr < cutoffTime;
        let _dayOfWeek = requestMomentDateTimeRightNowNyTime.day();

        var _dayDiffForEndDate = 0;


        if (_dayOfWeek === 1 && _beforeCutoffTime === true) {
            _dayDiffForEndDate = 3;
        } else if (_dayOfWeek === 0) {
            _dayDiffForEndDate = 2;
        } else if (_dayOfWeek === 6) {
            _dayDiffForEndDate = 1;
        } else if (_beforeCutoffTime === true && [2, 3, 4, 5].indexOf(_dayOfWeek) > -1) {
            _dayDiffForEndDate = 1;
        } else {
            _dayDiffForEndDate = 0;
        }


        let _avgRatingEndDate = moment(originalDateYYYY_MM_DD).tz("America/New_York").subtract(_dayDiffForEndDate, "days").format("YYYY-MM-DD");

        return _avgRatingEndDate;
    },
    getClosestNextWeekDayDate: function (requestDateTime) {
        let _dayOfWeek = requestDateTime.day();

        let _daysToAddForStartDate = 0;
        if (_dayOfWeek === 6) {
            _daysToAddForStartDate = 2;
        } else if (_dayOfWeek === 0) {
            _daysToAddForStartDate = 1;
        }

        return requestDateTime.add(_daysToAddForStartDate, "days").format("YYYY-MM-DD");
    }
};