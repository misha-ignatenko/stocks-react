import { Meteor } from 'meteor/meteor';
import _ from 'underscore';
import moment from 'moment-timezone';
const momentBiz = require('moment-business-days');

// Function to generate a unique key for memoization
const generateKey = (...args) => args.join(',');

// Memoize function with a time limit
const memoizeWithTimeout = (func, timeout) => {
  const memoized = _.memoize(func, generateKey);

  // Override the original memoized function
  const memoizedWithTimeout = (...args) => {
    const key = generateKey(...args);

    // Check if the result is already memoized
    if (_.has(memoized, key)) {
      // If the result is still valid, return it
      return memoized[key];
    }

    // Call the original function and memoize the result
    const result = func(...args);
    memoized[key] = result;

    // Schedule cache deletion after the specified timeout
    Meteor.setTimeout(() => {
      delete memoized[key];
    }, timeout);

    return result;
  };

  return memoizedWithTimeout;
};

const isBusinessDay = memoizeWithTimeout((dateString) => {
    return momentBiz(dateString).isBusinessDay();
}, 30 * 60 * 1000); // 30 min

const businessAdd = memoizeWithTimeout((dateString, daysToAdd) => {
    return momentBiz(dateString).businessAdd(daysToAdd).format(Utils.dateFormat);
}, 30 * 60 * 1000); // 30 min

Meteor.callNoCb = (...args) => {
    const that = this;
    return new Promise((resolve, reject) => {
        const callback = (err, res) => {
            if (err) reject(err);
            resolve(res);
        };
        args.push(callback);

        Meteor.call.apply(that, args);
    });
};

const settingsQuery = {type: 'main'};
const getSetting = (setting) => {
    const settingsObject = Settings.findOne(settingsQuery, {fields: {[setting]: 1}});
    let s = settingsObject;
    setting.split('.').forEach(interimField => {
        if (_.isObject(s) && _.has(s, interimField)) {
            s = s[interimField];
        } else {
            s = undefined;
        }
    });
    return s;
};

const _constantFeatureValue = 60;

// source: https://stackoverflow.com/questions/15547198/export-html-table-to-csv-using-vanilla-javascript
// Quick and simple export target #table_id into a csv
function download_table_as_csv(table_id, separator = ',') {
    // Select rows from table_id
    var rows = document.querySelectorAll('table#' + table_id + ' tr');
    // Construct csv
    var csv = [];
    for (var i = 0; i < rows.length; i++) {
        var row = [], cols = rows[i].querySelectorAll('td, th');
        for (var j = 0; j < cols.length; j++) {
            // Clean innertext to remove multiple spaces and jumpline (break csv)
            var data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' ')
            // Escape double-quote with double-double-quote (see https://stackoverflow.com/questions/17808511/properly-escape-a-double-quote-in-csv)
            data = data.replace(/"/g, '""');
            // Push escaped string
            row.push('"' + data + '"');
        }
        csv.push(row.join(separator));
    }
    var csv_string = csv.join('\n');
    // Download it
    var filename = 'export_' + table_id + '_' + new Date().toLocaleDateString() + '.csv';
    var link = document.createElement('a');
    link.style.display = 'none';
    link.setAttribute('target', '_blank');
    link.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv_string));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

StocksReactUtils = {

    constants: {
        YYYYMMDD: 'YYYYMMDD',
        YYYY_MM_DD: 'YYYY-MM-DD',
        ADJ_CLOSE: 'adjClose',
    },

    sum(arr) {
        return _.reduce(arr, (memo, num) => memo + num, 0);
    },
    avg(arr) {
        return Utils.sum(arr) / arr.length;
    },

    constantFeatureValue: _constantFeatureValue,
    getSetting,
    ratingChangesLookbackMonths: 3,
    dateFormat: 'YYYY-MM-DD',
    monthsAgo(months) {
        return moment().subtract(months, 'months').format(this.dateFormat);
    },
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
    getClosestPreviousWeekDayDateByCutoffTime: function (cutoffTime, OPTIONALrequestMomentDateTimeRightNowNyTime, format=StocksReactUtils.dateFormat) {
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


        let _avgRatingEndDate = requestMomentDateTimeRightNowNyTime.subtract(_dayDiffForEndDate, "days").format(format);

        return _avgRatingEndDate;
    },
    getTradingDayCutoffTime: function () {
        var _4PMEST_IN_ISO = Utils.getSetting('clientSettings.ratingChanges.fourPmInEstTimeString');
        return _4PMEST_IN_ISO;
    },
    getHolidays: function () {
        return momentBiz.localeData()._holidays;
    },
    getMinMaxDate: function (datesOrPrices, field='dateString') {
        const datesAsNums = (typeof datesOrPrices[0] === 'string' ?
            datesOrPrices :
            _.pluck(datesOrPrices, field)
        ).map(this.convertToNumberDate);
        const min = Math.min(...datesAsNums);
        const max = Math.max(...datesAsNums);

        return {
            min: this.convertToStringDate(min),
            max: this.convertToStringDate(max),
        };
    },

    convertToNumberDate(YYYY_MM_DD) {
        return +YYYY_MM_DD.split('-').join('');
    },
    convertToStringDate(YYYYMMDD, delim='-') {
        const dateStr = YYYYMMDD.toString();
        return [
            dateStr.substring(0,4),
            dateStr.substring(4,6),
            dateStr.substring(6,8),
        ].join(delim);
    },
    download_table_as_csv,
    memoizeWithTimeout,
    isBusinessDay,
    businessAdd,
    todaysDate() {
        return momentBiz().format(Utils.dateFormat);
    },

    symbols: {
        getLiveSymbols: function () {
            var _allStockSymbols = Stocks.find({"delisted": {$exists: false}}, {fields: {_id: 1}}).map(stock => stock._id);
            return _allStockSymbols;
        },
    },

    ratingChanges: {

        generateAverageAnalystRatingTimeSeries: function(symbol, startDate, endDate, _allRatingChangesForSymbol) {
            let _ratingChangesOfInterest = _.sortBy(_allRatingChangesForSymbol.filter(r => {
                const d = r.dateString;
                return d >= startDate && d <= endDate;
            }), 'dateString');

            _ratingChangesOfInterest = StocksReactUtils.ratingChanges.excludeRatingChangesWhoseFirmsInitiatedOrSuspendedOrDroppedCoverage(_ratingChangesOfInterest);
            console.log('generateAverageAnalystRatingTimeSeries',
                symbol,
                startDate,
                endDate,
                _allRatingChangesForSymbol.length,
                _ratingChangesOfInterest.length
            );

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

        getRatingScalesForRatingChanges(ratingChanges) {
            const oldRatingIds = _.uniq(_.pluck(ratingChanges, 'oldRatingId'));
            const newRatingIds = _.uniq(_.pluck(ratingChanges, 'newRatingId'));
            const ratingScaleIds = _.union(oldRatingIds, newRatingIds);

            return RatingScales.find({_id: {$in: ratingScaleIds}}, {fields: {_id: 1, universalScaleValue: 1, researchFirmId: 1}}).fetch();
        },

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

        generateAverageAnalystRatingTimeSeriesEveryDay: function(_averageAnalystRatingSeries, historicalData) {
            var _result = [];
            //_result that we return should have the same length as historicalData
            if (_averageAnalystRatingSeries.length > 1) {
                var _avgRatingIndexInProgress = 0 + 1;
                historicalData.forEach(function(histData, index) {
                    var _avgRatingDateInProgress = new Date(_averageAnalystRatingSeries[_avgRatingIndexInProgress].date).toISOString().substring(0,10);
                    var _date = moment(histData.date).tz("America/New_York").format("YYYY-MM-DD");;
                    if (moment(_date).isBefore(_avgRatingDateInProgress)) {
                        //grab data from avgRating with index -1
                        var _obj1 = _.omit(_averageAnalystRatingSeries[_avgRatingIndexInProgress - 1], "date");
                        _result.push(_.extend(_obj1, {date: histData.date, dateString: histData.dateString}));
                    } else {
                        //grab data from index
                        var _obj2 = _.omit(_averageAnalystRatingSeries[_avgRatingIndexInProgress], "date");
                        _result.push(_.extend(_obj2, {date: histData.date, dateString: histData.dateString}));
                        //increment index
                        _avgRatingIndexInProgress++;
                    }
                });
            }
            console.log("the length of average: ", _result.length);

            return _result;
        },

        generateWeightedAnalystRatingsTimeSeriesEveryDay: function(_avgRatingsSeriesEveryDay, _startDateForRegression, _endDateForRegression, historicalData, priceReactionDelayDays, priceType, _pctGoDownPerDayAtMinRating, _pctGoUpPerDayAtMaxRating, _stepSize2, _maxIter2) {
            var _result = {};



            //prepare data and run regression
            var _data = StocksReactUtils.ratingChanges.prepareDataForMultipleRegressionGradientDescentByResearchFirm(
                _avgRatingsSeriesEveryDay,
                historicalData,
                _startDateForRegression,
                _endDateForRegression,
                priceReactionDelayDays,
                priceType
            );

            var _featureMatrix = _data.featureMatrix;
            var _actualOutput = _data.actualOutput;
            var _initialWeights = JSON.stringify(_data.initialWeights);
            if (_featureMatrix && _actualOutput && _initialWeights) {

                var _maxRatingValue = 120;
                var _minRatingValue = 0;
                //the cutoff value is the value at which we consider rating to be positive or negative
                var _cutoffValue = (_maxRatingValue - _minRatingValue) / 2;
                var _tolerance2 = Math.pow(10, 2.5);
                var _maxPossibleWeight = Math.pow(10, 10);
                var _minPossibleWeight = -_maxPossibleWeight;
                var _resultFromGradientDescent2 = IgnRegression.functions.multiple_regression_gradient_descent2(
                    _featureMatrix,
                    _actualOutput,
                    JSON.parse(_initialWeights),
                    _stepSize2,
                    _tolerance2,
                    _maxIter2,
                    _pctGoDownPerDayAtMinRating / 100,
                    _pctGoUpPerDayAtMaxRating / 100,
                    _minRatingValue,
                    _maxRatingValue,
                    _cutoffValue,
                    _minPossibleWeight,
                    _maxPossibleWeight
                );
                console.log("sqrt rss: ", _resultFromGradientDescent2.sqrtRss);
                var _firmsAndWeights = {};
                _.each(_data.uniqueResearchFirmIds, function (firmId, idx) {
                    _firmsAndWeights[firmId] = _resultFromGradientDescent2.weights[idx];
                })
                console.log("firms and weights: ", _firmsAndWeights);
                console.log("total iterations: ", _resultFromGradientDescent2.iter);

                var _preparedArrayOfWeightedRatings = StocksReactUtils.ratingChanges.prepareArrayOfWeightedRatingsForGraph(_data.uniqueResearchFirmIds, _resultFromGradientDescent2.weights, _avgRatingsSeriesEveryDay);
                _result = {ratings: _preparedArrayOfWeightedRatings, weights: _firmsAndWeights};
            }

            return _result;
        },

        prepareDataForMultipleRegressionGradientDescentByResearchFirm: function (avgRatingsDataRaw, pricesDataRaw, startDateForRegr, endDateForRegr, priceReactionDelayDays, priceType) {
            var _result = {};

            //reject those avgRatings that do not fall within the specified training set date range
            var _avgRatingsDataWithinDateRange = [];
            avgRatingsDataRaw.forEach(function(avgRawData) {
                var _thisDate = new Date(avgRawData.date).toISOString().substring(0,10);
                if (!moment(_thisDate).isAfter(endDateForRegr) && !moment(_thisDate).isBefore(startDateForRegr)) {
                    _avgRatingsDataWithinDateRange.push(avgRawData);
                }
            });
            var avgRatingsData = _avgRatingsDataWithinDateRange.slice(0, _avgRatingsDataWithinDateRange.length - priceReactionDelayDays);

            var _pricesDataWithinDateRange = [];
            pricesDataRaw.forEach(function(priceItem) {
                var _thisDate = new Date(priceItem.date).toISOString().substring(0,10);
                if (!moment(_thisDate).isAfter(endDateForRegr) && !moment(_thisDate).isBefore(startDateForRegr)) {
                    _pricesDataWithinDateRange.push(priceItem);
                }
            });
            var pricesData = _pricesDataWithinDateRange.slice(priceReactionDelayDays, _pricesDataWithinDateRange.length);


            var _uniqueResearchFirmIds = [];
            avgRatingsData.forEach(function(obj) {
                if (obj.ratingScales) {
                    obj.ratingScales.forEach(function(ratingScaleInfo) {
                        if (ratingScaleInfo.researchFirmId && _.indexOf(_uniqueResearchFirmIds, ratingScaleInfo.researchFirmId) === -1) {
                            _uniqueResearchFirmIds.push(ratingScaleInfo.researchFirmId);
                        }
                    });
                }
            });


            //generate feature matrix
            var _featureMatrix = [];
            avgRatingsData.forEach(function(obj) {
                var _features = new Array(_uniqueResearchFirmIds.length);
                if (obj.ratingScales) {
                    obj.ratingScales.forEach(function(ratingScaleInfo) {
                        if (ratingScaleInfo.universalScaleValue && ratingScaleInfo.researchFirmId) {
                            _features[_.indexOf(_uniqueResearchFirmIds, ratingScaleInfo.researchFirmId)] = ratingScaleInfo.universalScaleValue;
                        }
                    });
                }

                //todo set those undefined inside feature to zeros

                _features.unshift(_constantFeatureValue);
                _featureMatrix.push(_features);
            });
            _result.featureMatrix = _featureMatrix;


            var _initialWeights = [];
            _uniqueResearchFirmIds.forEach(function(firmId) {
                _initialWeights.push(1 / _uniqueResearchFirmIds.length);
            });
            var _initialWeightForConstant = 1 / _uniqueResearchFirmIds.length;
            _initialWeights.unshift(_initialWeightForConstant);
            _result.initialWeights = _initialWeights;


            var _actualOutput = [];
            pricesData.forEach(function(pricePt) {
                _actualOutput.push(pricePt[priceType]);
            });
            _result.actualOutput = _actualOutput;


            _uniqueResearchFirmIds.unshift("constant");
            _result.uniqueResearchFirmIds = _uniqueResearchFirmIds;


            return _result;
        },

        prepareArrayOfWeightedRatingsForGraph: function(uniqueResearchFirmIds, ratingFirmsWeights, avgRatingsEveryDay) {
            var _result = [];

            avgRatingsEveryDay.forEach(function(obj) {
                var _totaleightedRating = 0;
                obj.ratingScales.forEach(function(ratingScale) {
                    var _firmIndex = _.indexOf(uniqueResearchFirmIds, ratingScale.researchFirmId);
                    var _firmWeight = ratingFirmsWeights[_firmIndex];
                    _totaleightedRating += _firmWeight * ratingScale.universalScaleValue;
                });
                //also add the constant
                var _constantIndex = _.indexOf(uniqueResearchFirmIds, "constant");
                var _constantWeight = ratingFirmsWeights[_constantIndex];
                _totaleightedRating += _constantWeight * _constantFeatureValue;


                var _toPush = _.omit(obj, "avg");
                _toPush = _.extend(_toPush, {
                    weightedRating: _totaleightedRating
                });
                _result.push(_toPush);

                //_result.push(_.extend(obj, {
                //    weightedRating: _totaleightedRating
                //}));

            });

            return _result;
        },

        predictionsBasedOnRatings: function(_datesAndRatings,
                                            pricesArr,
                                            priceTypeStr,
                                            rollingPx,
                                            _minRatingValue,
                                            _maxRatingValue,
                                            _cutoffValue,
                                            pctDownPerDay,
                                            pctUpPerDay) {
            var _result = [];

            var datesAndRatingsObj = {};
            _.each(_datesAndRatings, function (obj) {
                datesAndRatingsObj[obj.dateString] = obj.rating;
            });

            // generate result. initial price is price at the beginning of the series
            _result.push({
                dateString: pricesArr[0].dateString,
                price: rollingPx || pricesArr[0][priceTypeStr],
                date: pricesArr[0].date
            })
            _.each(pricesArr, function (obj, index) {
                if (index > 0) {
                    var _previousPrice = _result[index - 1].price;
                    var _rating = datesAndRatingsObj[obj.dateString];
                    var _dayIncrease;
                    var _fractionOfMaxGoUp;
                    var _fractionOfMaxGoDown;
                    var goUpPerDayAtMaxRating = pctUpPerDay / 100;
                    var goDownPerDayAtMinRating = pctDownPerDay / 100;
                    if (_rating >= _cutoffValue) {
                        _fractionOfMaxGoUp = (_rating - _cutoffValue) / (_maxRatingValue - _cutoffValue);
                        _dayIncrease = _fractionOfMaxGoUp * goUpPerDayAtMaxRating;
                    } else {
                        _fractionOfMaxGoDown = (_cutoffValue - _rating) / (_cutoffValue - _minRatingValue);
                        _dayIncrease = - _fractionOfMaxGoDown * goDownPerDayAtMinRating;
                    }
                    var _predictedPrice = _previousPrice * (1 + _dayIncrease);

                    _result.push({
                        dateString: obj.dateString,
                        date: obj.date,
                        price: _predictedPrice
                    });
                }
            })

            return _result;
        },

    },
    stockPrices: {
        getSimpleRollingPx: function (priceObjArray, endDate, rollingNum, isStrict=true) {
            const daysToSubtract = rollingNum - (Utils.isBusinessDay(endDate) ? 1 : 0);
            const startDate = Utils.businessAdd(endDate, -daysToSubtract);

            const prices = StocksReactUtils.stockPrices.getPricesBetween(priceObjArray, startDate, endDate);
            const closePrices = _.pluck(prices, 'adjClose');

            if (!isStrict || rollingNum === closePrices.length) {
                return Utils.avg(closePrices);
            } else {
                console.log('there is an issue with rolling prices', prices[0]?.symbol, startDate, endDate, closePrices.length, rollingNum);
            }
        },

        getPricesBetween: function (priceObjArray, startDate, endDate) {
            var _filteredPricesArray = _.filter(priceObjArray, function (priceObjForDay) {
                return priceObjForDay.dateString >= startDate && priceObjForDay.dateString <= endDate;
            });
            // TODO: ensure that all weekday prices exist starting at startDate ending at endDate (except holidays).
            var _sorted = _.sortBy(_filteredPricesArray, "dateString");

            return _sorted;
        },
        getPriceOnDayNoRetry(prices, dateString, priceField = 'adjClose') {
            return Utils.stockPrices.getPricesBetween(prices, dateString, dateString)[0]?.[priceField];
        },
        getPriceOnDay(prices, dateString, priceField = 'adjClose') {
            const firstAttempt = Utils.stockPrices.getPriceOnDayNoRetry(prices, dateString, priceField);
            if (_.isUndefined(firstAttempt)) {
                console.log('going back 1 day', dateString);
                const altDate = Utils.businessAdd(dateString, -1);
                return Utils.stockPrices.getPriceOnDayNoRetry(prices, altDate, priceField);
            }
            return firstAttempt;
        },
    }
};

Utils = StocksReactUtils;

momentBiz.updateLocale('us', {
    // https://www.nyse.com/markets/hours-calendars
    // https://www.sifma.org/resources/general/us-holiday-archive/
    holidays: [
        '2020-01-01',
        '2020-01-20',
        '2020-02-17',
        '2020-04-10',
        '2020-05-25',
        '2020-07-03',
        '2020-09-07',
        '2020-11-26',
        '2020-12-25',

        '2021-01-01',
        '2021-01-18',
        '2021-02-15',
        '2021-04-02',
        '2021-05-31',
        '2021-06-18',
        '2021-07-05',
        '2021-09-06',
        '2021-11-25',
        '2021-12-24',

        '2022-01-17',
        '2022-02-21',
        '2022-04-15',
        '2022-05-30',
        '2022-06-20',
        '2022-07-04',
        '2022-09-05',
        '2022-11-24',
        '2022-12-26',

        '2023-01-02',
        '2023-01-16',
        '2023-02-20',
        '2023-04-07',
        '2023-05-29',
        '2023-06-19',
        '2023-07-04',
        '2023-09-04',
        '2023-11-23',
        '2023-12-25',

        '2024-01-01',
        '2024-01-15',
        '2024-02-19',
        '2024-03-29',
        '2024-05-27',
        '2024-06-19',
        '2024-07-04',
        '2024-09-02',
        '2024-11-28',
        '2024-12-25',

        '2025-01-01',
        '2025-01-09',
        '2025-01-20',
        '2025-02-17',
        '2025-04-18',
        '2025-05-26',
        '2025-06-19',
        '2025-07-04',
        '2025-09-01',
        '2025-11-27',
        '2025-12-25',
    ],
    holidayFormat: Utils.constants.YYYY_MM_DD,
});
