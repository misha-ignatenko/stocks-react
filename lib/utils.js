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


        let _beforeCutoffTime = _timeStr < (cutoffTime || StocksReactUtils.getTradingDayCutoffTime());
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
    },
    getTradingDayCutoffTime: function () {
        let _settings = Settings.findOne();
        var _4PMEST_IN_ISO = _settings.clientSettings.ratingChanges.fourPmInEstTimeString;
        return _4PMEST_IN_ISO;
    },
    ratingChanges: {

        generateAverageAnalystRatingTimeSeries: function(symbol, startDate, endDate) {
            var _allRatingChangesForSymbol = RatingChanges.find({symbol: symbol}).fetch();
            var _ratingChangesOfInterest = RatingChanges.find({
                symbol: symbol,
                $and: [
                    {dateString: {$gte: startDate}},
                    {dateString: {$lte: endDate}}
                ]
            }, {sort: {dateString: 1}}).fetch();
            console.log("_ratingChangesOfInterest", _ratingChangesOfInterest.length);
            console.log(_ratingChangesOfInterest[0]);
            console.log(_ratingChangesOfInterest[_ratingChangesOfInterest.length - 1]);
            console.log("------------------");

            _ratingChangesOfInterest = StocksReactUtils.ratingChanges.excludeRatingChangesWhoseFirmsInitiatedOrSuspendedOrDroppedCoverage(_ratingChangesOfInterest);

            //_ratingChangesOfInterest is already sorted with dates in increasing order

            //determine the number of unique research firms
            var _uniqueFirms = _.uniq(_.pluck(_ratingChangesOfInterest, "researchFirmId"));




            var _result = [];

            var _zeroSeries = [];
            _uniqueFirms.forEach(function(uniqueFirmId) {
                var i = 0;
                while (i < _ratingChangesOfInterest.length) {
                    if (_ratingChangesOfInterest[i].researchFirmId === uniqueFirmId) {
                        _zeroSeries.push(_ratingChangesOfInterest[i].oldRatingId);
                        break;
                    }
                    i++;
                }
            });

            //_result.push({
            //    date: new Date(startDate).toUTCString(),
            //    ratingScalesIds: _zeroSeries
            //});




            // console.log("all rating changes of interest: ", _ratingChangesOfInterest);
            var _uniqDates = [new Date(startDate).toUTCString()];
            var _uniqDatesAddition = _.uniq(_.pluck(_ratingChangesOfInterest, "date"));
            _uniqDates = _uniqDates.concat(_.pluck(_ratingChangesOfInterest, "date"));

            //figure out date for finalSeries
            var _dateForFinalSeries;
            var _today = moment(new Date()).format("YYYY-MM-DD");
            if (moment(_today).isBefore(endDate)) {
                _dateForFinalSeries = new Date().toUTCString()
            } else {
                _dateForFinalSeries = new Date(endDate).toUTCString()
            }
            _uniqDates.push(_dateForFinalSeries);
            _uniqDates = _.uniq(_uniqDates);
            // console.log("unique dates: ", _uniqDates);

            _uniqDates.forEach(function(uniqDate) {
                var __arrayOfConnectedRatingChanges = [];
                _uniqueFirms.forEach(function(firmId){
                    var _id = StocksReactUtils.ratingChanges.getLatestRatingScaleIdFor(_allRatingChangesForSymbol, symbol, firmId, uniqDate);
                    __arrayOfConnectedRatingChanges.push(_id);
                });

                _result.push({
                    date: uniqDate,
                    ratingScalesIds: __arrayOfConnectedRatingChanges
                });
            });
            // console.log("RESULT from avg ratings: ", _result);

            var _final = [];
            _result.forEach(function(res) {
                var _sum = 0;
                var _divisor = res.ratingScalesIds.length;
                var _ratingScalesArr = [];
                res.ratingScalesIds.forEach(function(ratingScaleId) {
                    var _rSc = StocksReactUtils.ratingChanges.getRatingScaleById(ratingScaleId);
                    if (_rSc.universalScaleValue === "beforeCoverageInitiatedString" || _rSc.universalScaleValue === "coverageDroppedString" || _rSc.universalScaleValue === "coverageTemporarilySuspendedString") {
                        _divisor -= 1;
                    } else {
                        _sum += _rSc.universalScaleValue;
                    }

                    _ratingScalesArr.push({
                        _id: ratingScaleId,
                        researchFirmId: _rSc.researchFirmId,
                        universalScaleValue: _rSc.universalScaleValue
                    });
                });
                //TODO omit ratingScalesIds -- extra info
                _final.push(_.extend(res, {
                    avg: parseFloat(_sum / _divisor),
                    ratingScales: _ratingScalesArr
                }))
            })

            return _final;
        },

        excludeRatingChangesWhoseFirmsInitiatedOrSuspendedOrDroppedCoverage: function(ratingsChangesArray) {
            var _firmIdsWhoseRatingsToReject = [];

            ratingsChangesArray.forEach(function(rChange) {
                var _newRScale = StocksReactUtils.ratingChanges.getRatingScaleById(rChange.newRatingId);
                var _oldRScale = StocksReactUtils.ratingChanges.getRatingScaleById(rChange.oldRatingId);
                var _newRScaleValue = _newRScale.universalScaleValue;
                var _oldRScaleValue = _oldRScale.universalScaleValue;
                if (_newRScaleValue === "beforeCoverageInitiatedString" ||
                    _newRScaleValue === "coverageDroppedString" ||
                    _newRScaleValue === "coverageTemporarilySuspendedString" ||
                    _oldRScaleValue === "beforeCoverageInitiatedString" ||
                    _oldRScaleValue === "coverageDroppedString" ||
                    _oldRScaleValue === "coverageTemporarilySuspendedString"
                ) {
                    _firmIdsWhoseRatingsToReject.push(_newRScale.researchFirmId);
                    _firmIdsWhoseRatingsToReject.push(_oldRScale.researchFirmId);
                }
            });
            _firmIdsWhoseRatingsToReject = _.uniq(_firmIdsWhoseRatingsToReject);

            if (_firmIdsWhoseRatingsToReject.length > 0) {
                ratingsChangesArray = _.reject(ratingsChangesArray, function(ratingsChange) {
                    return _firmIdsWhoseRatingsToReject.indexOf(ratingsChange.researchFirmId) > -1;
                });
            }

            return ratingsChangesArray;
        },

        getRatingScaleById: _.memoize(function(ratingScaleId) {
            return RatingScales.findOne(ratingScaleId);
        }),

        getLatestRatingScaleIdFor: function(allRatingChanges, symbol, researchFirmId, requestedDate) {
            var _ratingChanges = _.filter(allRatingChanges, function (rCh) {
                return rCh.researchFirmId === researchFirmId && rCh.symbol === symbol;
            });
            var _format = "YYYY-MM-DD";
            var rDate = moment(new Date(requestedDate)).format(_format);

            var _ratingScaleId;
            if (_ratingChanges && _ratingChanges.length > 0) {
                var _onOrBeforeUnsorted = _.filter(_ratingChanges, function(rChange) {
                    var _extractedDateStringNoTimezone = moment(new Date(rChange.date)).format(_format);
                    return (
                        moment(_extractedDateStringNoTimezone).isSame(rDate) ||
                        moment(_extractedDateStringNoTimezone).isBefore(rDate)
                    );
                });
                var _afterUnsorted = _.filter(_ratingChanges, function(rChange) {
                    var _extractedDateStringNoTimezone = moment(new Date(rChange.date)).format(_format);
                    return (moment(_extractedDateStringNoTimezone).isAfter(rDate));
                });
                var _onOrBeforeSorted = _.sortBy(_onOrBeforeUnsorted, function(obj) {
                    return moment(new Date(obj.date));
                });
                var _afterSorted = _.sortBy(_afterUnsorted, function(obj) {
                    return moment(new Date(obj.date));
                });

                if (_onOrBeforeSorted && _onOrBeforeSorted.length > 0) {
                    //case 1
                    //check if anything is for date or before
                    //if yes, grab the newRatingId of the last item in that array
                    _ratingScaleId = _onOrBeforeSorted[_onOrBeforeSorted.length - 1].newRatingId;
                } else if (_afterSorted && _afterSorted.length > 0) {
                    //case 2
                    //if there's something that's after the requested date, then
                    // return oldRatingId of the rating change that's closest to requested date (index 0)
                    _ratingScaleId = _afterSorted[0].oldRatingId;
                }

            }

            return _ratingScaleId;
        },

    }
};