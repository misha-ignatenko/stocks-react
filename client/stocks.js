if (Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: "USERNAME_ONLY"
    });

    Meteor.subscribe("earningsReleases");
    Meteor.subscribe("researchCompanies");
    Meteor.subscribe("pickLists");
    Meteor.subscribe("ratingScales");
    Meteor.subscribe("pickListItems");

    //Meteor.startup(function () {
    //    React.render(<App />, document.getElementById("render-target"));
    //});

    StocksReact = {};
    StocksReact.dates = {
        _convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY: function(yyyy_mm_dd) {
            var _years = yyyy_mm_dd.substring(0,4);
            var _months = yyyy_mm_dd.substring(5,7);
            var _days = yyyy_mm_dd.substring(8,10);
            return _months + "/" + _days + "/" + _years;
        }
    };
    StocksReact.functions = {
        generateAverageAnalystRatingTimeSeriesEveryDay: function(_averageAnalystRatingSeries, historicalData) {
            var _result = [];
            console.log(_averageAnalystRatingSeries);
            console.log(historicalData);

            return _result;
        },
        generateWeightedAnalystRatingsTimeSeriesEveryDay: function(_avgRatingsSeriesEveryDay, _startDateForRegression, _endDateForRegression, historicalData) {
            var _result = [];



            //prepare data and run regression
            var _data = StocksReact.functions.prepareDataForMultipleRegressionGradientDescentByResearchFirm(
                _avgRatingsSeriesEveryDay,
                historicalData,
                _startDateForRegression,
                _endDateForRegression
            );
            console.log("PREPARED DATA: ", _data);

            var _featureMatrix = _data.featureMatrix;
            var _actualOutput = _data.actualOutput;
            var _initialWeights = _data.initialWeights;
            var _stepSize = 10^(-2);
            var _tolerance = 10^(-2);
            var _maxIter = 1000;
            if (_featureMatrix && _actualOutput && _initialWeights && _stepSize && _tolerance && _maxIter) {
                var _resultFromGradientDescent = IgnRegression.functions.multiple_regression_gradient_descent(
                    _featureMatrix,
                    _actualOutput,
                    _initialWeights,
                    _stepSize,
                    _tolerance,
                    _maxIter
                );
                console.log("_resultFromGradientDescent: ", _resultFromGradientDescent);
            }








            return _result;
        },
        generateAverageAnalystRatingTimeSeries: function(symbol, startDate, endDate) {
            var _allRatingChgs = RatingChanges.find({symbol: symbol}).fetch();
            var _allRatingChangesForStock = _.sortBy(_allRatingChgs, function(obj) {
                return moment(new Date(obj.date));
            });
            //filter those where date attribute is between startDate and endDate

            var _ratingChangesOfInterest = [];
            _allRatingChangesForStock.forEach(function(ratingChange) {
                var _extractedDateStringNoTimezone = moment(new Date(ratingChange.date)).format("YYYY-MM-DD");
                if ((moment(_extractedDateStringNoTimezone).isSame(startDate) || moment(_extractedDateStringNoTimezone).isAfter(startDate)) &&
                    (moment(_extractedDateStringNoTimezone).isSame(endDate) || moment(_extractedDateStringNoTimezone).isBefore(endDate))
                ) {
                    _ratingChangesOfInterest.push(ratingChange);
                }
            });

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

            _result.push({
                date: new Date(startDate).toUTCString(),
                ratingScalesIds: _zeroSeries
            });

            //for each rating change get the firm and find the nearest before rating of other firms
            _ratingChangesOfInterest.forEach(function(ratingChange, index) {
                var _curFirmId = ratingChange.researchFirmId;
                var _arrayOfConnectedRatingChanges = [ratingChange.newRatingId];
                _uniqueFirms.forEach(function(researchFirmId) {
                    //only interested at looking at research firms that are NOT equal to _curFirmId
                    if (researchFirmId !== _curFirmId) {
                        var _i = index + 1;
                        var _found;
                        while (_i < _ratingChangesOfInterest.length) {
                            if (_ratingChangesOfInterest[_i].researchFirmId === researchFirmId) {
                                _found = _ratingChangesOfInterest[_i];
                                _arrayOfConnectedRatingChanges.push(_found.oldRatingId);
                                break;
                            }
                            _i++;
                        }
                        if (!_found) {
                            //try to go backward
                            _i = index - 1;
                            while (_i >= 0) {
                                if (_ratingChangesOfInterest[_i].researchFirmId === researchFirmId) {
                                    _found =_ratingChangesOfInterest[_i];
                                    _arrayOfConnectedRatingChanges.push(_found.newRatingId);
                                    break;
                                }
                                _i--;
                            }
                        }

                        if (!_found) {
                            console.log("ERROR!!");
                        } else {

                        }
                    }
                })
                _result.push({
                    date: ratingChange.date,
                    ratingScalesIds: _arrayOfConnectedRatingChanges
                });
            })

            //same as the very last one except date will be set below to either today or endDate
            var _finalSeries = _result[_result.length - 1].ratingScalesIds;

            //figure out date for finalSeries
            var _dateForFinalSeries;
            var _today = moment(new Date()).format("YYYY-MM-DD");
            if (moment(_today).isBefore(endDate)) {
                _dateForFinalSeries = new Date().toUTCString()
            } else {
                _dateForFinalSeries = new Date(endDate).toUTCString()
            }



            _result.push({
                date: _dateForFinalSeries,
                ratingScalesIds: _finalSeries
            });

            var _final = [];
            _result.forEach(function(res) {
                var _sum = 0;
                var _divisor = res.ratingScalesIds.length;
                var _ratingScalesArr = [];
                res.ratingScalesIds.forEach(function(ratingScaleId) {
                    var _rSc = RatingScales.findOne({_id: ratingScaleId});
                    if (_rSc.universalScaleValue === "beforeCoverageInitiatedString" || _rSc.universalScaleValue === "coverageDroppedString") {
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
                    avg: (_sum / _divisor).toFixed(2),
                    ratingScales: _ratingScalesArr
                }))
            })

            return _final;
        },
        prepareDataForMultipleRegressionGradientDescentByResearchFirm: function (avgRatingsDataRaw, pricesData, startDateForRegr, endDateForRegr) {
            var _result = {};

            //reject those avgRatings that do not fall within the specified training set date range
            var _avgRatingsDataWithinDateRange = [];
            avgRatingsDataRaw.forEach(function(avgRawData) {
                var _thisDate = new Date(avgRawData.date).toISOString().substring(0,10);
                if (!moment(_thisDate).isAfter(endDateForRegr) && !moment(_thisDate).isBefore(startDateForRegr)) {
                    _avgRatingsDataWithinDateRange.push(avgRawData);
                }
            });
            var avgRatingsData = _avgRatingsDataWithinDateRange;





            console.log("avg ratings data within date range: ", avgRatingsData);

            //todo make sure that all items inside avgRatingsData have the same length of ratingScalesIds array -- might have some dropped or new ratings
            var _uniqueResearchFirmIds = [];
            avgRatingsData.forEach(function(obj) {
                if (obj.ratingScalesIds) {
                    obj.ratingScalesIds.forEach(function(ratingScaleId) {
                        var _ratingScaleObj = RatingScales.findOne(ratingScaleId);
                        if (_ratingScaleObj) {
                            if (_ratingScaleObj.researchFirmId && _.indexOf(_uniqueResearchFirmIds, _ratingScaleObj.researchFirmId) === -1) {
                                _uniqueResearchFirmIds.push(_ratingScaleObj.researchFirmId);
                            }
                        }
                    });
                }
            });
            console.log("all unique firm ids: ", _uniqueResearchFirmIds);
            _result.uniqueResearchFirmIds = _uniqueResearchFirmIds;

            //generate feature matrix
            var _featureMatrix = [];
            avgRatingsData.forEach(function(obj) {
                var _features = new Array(_uniqueResearchFirmIds.length);
                if (obj.ratingScalesIds) {
                    obj.ratingScalesIds.forEach(function(ratingScaleId) {
                        var _ratingScaleObj = RatingScales.findOne(ratingScaleId);
                        if (_ratingScaleObj && _ratingScaleObj.universalScaleValue && _ratingScaleObj.researchFirmId) {
                            _features[_.indexOf(_uniqueResearchFirmIds, _ratingScaleObj.researchFirmId)] = _ratingScaleObj.universalScaleValue;
                        }
                    });
                }

                //todo set those undefined inside feature to zeros

                //TODO MAKE SURE THAT ORDER IS PRESERVED -- THE SAME INSIDE FEATURES AS IN UNIQUE FIRM IDS ARRAY.

                _featureMatrix.push(_features);
            });
            _result.featureMatrix = _featureMatrix;

            var _initialWeights = [];
            _uniqueResearchFirmIds.forEach(function(firmId) {
                _initialWeights.push(1 / _uniqueResearchFirmIds.length);
            });
            _result.initialWeights = _initialWeights;


            var _actualOutput = [];
            avgRatingsData.forEach(function(avgRating) {
                var _findClosestToThisDate = new Date(avgRating.date).toISOString().substring(0,10);
                var _distanceInDays = 10000;
                var _closestPrice;
                pricesData.forEach(function(priceArr) {
                    //find the closest price to avgRating.date
                    //do mod of the difference in dates
                    var _date = moment(priceArr[0]);
                    if (Math.abs(_date.diff(_findClosestToThisDate, "days")) < _distanceInDays) {
                        _distanceInDays = Math.abs(_date.diff(_findClosestToThisDate, "days"));
                        _closestPrice = priceArr[1];
                    }
                });
                if (!_closestPrice) {
                    console.log("ALERT! No closest price!");
                } else {
                    _actualOutput.push(_closestPrice);
                }

                if (_distanceInDays >= 5) {
                    console.log("ALERT! Could not find price within 5 days from ", _findClosestToThisDate);
                }
            });
            _result.actualOutput = _actualOutput;


            return _result;
        }
    };

    StocksReact.ui = {
        setDateRangeOptions: function(dateRangeClassName) {
            var _daterangeOptions = {
                autoclose: true,
                todayHighlight: true,
                orientation: "top auto"
            };
            $("." + dateRangeClassName).datepicker(_daterangeOptions);
        },
        getStateForDateRangeChangeEvent: function(event) {
            var _newVal = $(event.target).val();
            var _format = "YYYY-MM-DD";
            var _momentDate = moment(new Date(_newVal).toISOString()).format(_format);
            if (moment(_momentDate).isAfter(moment())) {
                _momentDate = moment(new Date().toISOString()).format(_format);
            }
            var _id = $(event.target).attr('id');
            var _set = {};
            _set[_id] = _momentDate;

            return _set;
        }
    };
}
