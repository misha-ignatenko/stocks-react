import { Meteor } from 'meteor/meteor';
import moment from 'moment-timezone';

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

StocksReactUtils = {
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


        let _avgRatingEndDate = requestMomentDateTimeRightNowNyTime.subtract(_dayDiffForEndDate, "days").format("YYYY-MM-DD");

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
        var _4PMEST_IN_ISO = Utils.getSetting('clientSettings.ratingChanges.fourPmInEstTimeString');
        return _4PMEST_IN_ISO;
    },
    getHolidays: function () {
        return ["2017-07-04", "2017-11-23"];
    },
    getMinMaxDate: function (datesArr) {
        var _allDateNums = _.map(datesArr, function (dateStr) {
            return parseInt(dateStr.replace(/-/g, ''));
        });
        var _minDateStrNoDashes = _.min(_allDateNums).toString();
        var _maxDateStrNoDashes = _.max(_allDateNums).toString();
        var _minDate = _minDateStrNoDashes.substring(0,4) + '-' + _minDateStrNoDashes.substring(4,6) + '-' + _minDateStrNoDashes.substring(6,8);
        var _maxDate = _maxDateStrNoDashes.substring(0,4) + '-' + _maxDateStrNoDashes.substring(4,6) + '-' + _maxDateStrNoDashes.substring(6,8);

        return {min: _minDate, max: _maxDate};
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
            var _constantFeatureValue = 60;
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
                _totaleightedRating += _constantWeight * 1;


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
        getSimpleRollingPx: function (priceObjArray, endDate, rollingNum) {
            var _rollingStartDate = StocksReactUtils.getClosestNextWeekDayDate(moment(endDate).subtract(rollingNum, "days"));
            var _pxForRolling = StocksReactUtils.stockPrices.getPricesBetween(priceObjArray, _rollingStartDate, endDate);
            var _simpleRollingPx = _.reduce(_.pluck(_pxForRolling, "adjClose"), function(memo, num){ return memo + num; }, 0) / _pxForRolling.length;
            return _simpleRollingPx;
        },

        getPricesBetween: function (priceObjArray, startDate, endDate) {
            var _filteredPricesArray = _.filter(priceObjArray, function (priceObjForDay) {
                return priceObjForDay.dateString >= startDate && priceObjForDay.dateString <= endDate;
            });
            // TODO: ensure that all weekday prices exist starting at startDate ending at endDate (except holidays).
            var _sorted = _.sortBy(_filteredPricesArray, "dateString");

            return _sorted;
        },
    }
};

Utils = StocksReactUtils;
