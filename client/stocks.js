if (Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: "USERNAME_ONLY"
    });

    Meteor.subscribe("researchCompanies");
    Meteor.subscribe("pickLists");
    Meteor.subscribe("ratingScales");
    Meteor.subscribe("pickListItems");

    Meteor.subscribe("settings");

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
            //_result that we return should have the same length as historicalData
            if (_averageAnalystRatingSeries.length > 1) {
                var _avgRatingIndexInProgress = 0 + 1;
                historicalData.forEach(function(histData, index) {
                    var _avgRatingDateInProgress = new Date(_averageAnalystRatingSeries[_avgRatingIndexInProgress].date).toISOString().substring(0,10);
                    var _date = new Date(histData.date).toISOString().substring(0,10);
                    if (moment(_date).isBefore(_avgRatingDateInProgress)) {
                         //grab data from avgRating with index -1
                        var _obj1 = _.omit(_averageAnalystRatingSeries[_avgRatingIndexInProgress - 1], "date");
                        _result.push(_.extend(_obj1, {date: histData.date}));
                    } else {
                        //grab data from index
                        var _obj2 = _.omit(_averageAnalystRatingSeries[_avgRatingIndexInProgress], "date");
                        _result.push(_.extend(_obj2, {date: histData.date}));
                        //increment index
                        _avgRatingIndexInProgress++;
                    }
                });
            }

            return _result;
        },
        generateWeightedAnalystRatingsTimeSeriesEveryDay: function(_avgRatingsSeriesEveryDay, _startDateForRegression, _endDateForRegression, historicalData, priceReactionDelayDays, priceType) {
            var _result = [];



            //prepare data and run regression
            var _data = StocksReact.functions.prepareDataForMultipleRegressionGradientDescentByResearchFirm(
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

                var _pctGoUpPerDayAtMaxRating = 1;
                var _pctGoDownPerDayAtMinRating = 0.5;
                var _maxRatingValue = 120;
                var _minRatingValue = 0;
                //the cutoff value is the value at which we consider rating to be positive or negative
                var _cutoffValue = (_maxRatingValue - _minRatingValue) / 2;
                var _stepSize2 = Math.pow(10, -7);
                var _tolerance2 = Math.pow(10, 2.5);
                var _maxIter2 = 10000;
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
                console.log("final weights: ", _resultFromGradientDescent2.weights);
                console.log("unique firm ids: ", _data.uniqueResearchFirmIds);
                console.log("total iterations: ", _resultFromGradientDescent2.iter);

                var _preparedArrayOfWeightedRatings = StocksReact.functions.prepareArrayOfWeightedRatingsForGraph(_data.uniqueResearchFirmIds, _resultFromGradientDescent2.weights, _avgRatingsSeriesEveryDay);
                _result = _preparedArrayOfWeightedRatings;
            }

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

        getLatestRatingScaleIdFor: function(symbol, researchFirmId, requestedDate) {
            var _ratingChanges = RatingChanges.find({symbol: symbol, researchFirmId: researchFirmId}).fetch();
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

        getRatingScaleById: _.memoize(function(ratingScaleId) {
            return RatingScales.findOne(ratingScaleId);
        }),

        excludeRatingChangesWhoseFirmsInitiatedOrSuspendedOrDroppedCoverage: function(ratingsChangesArray) {
            var _firmIdsWhoseRatingsToReject = [];

            ratingsChangesArray.forEach(function(rChange) {
                var _newRScale = StocksReact.functions.getRatingScaleById(rChange.newRatingId);
                var _oldRScale = StocksReact.functions.getRatingScaleById(rChange.oldRatingId);
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

            _ratingChangesOfInterest = StocksReact.functions.excludeRatingChangesWhoseFirmsInitiatedOrSuspendedOrDroppedCoverage(_ratingChangesOfInterest);

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




            console.log("all rating changes of interest: ", _ratingChangesOfInterest);
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
            console.log("unique dates: ", _uniqDates);

            _uniqDates.forEach(function(uniqDate) {
                var __arrayOfConnectedRatingChanges = [];
                _uniqueFirms.forEach(function(firmId){
                    var _id = StocksReact.functions.getLatestRatingScaleIdFor(symbol, firmId, uniqDate);
                    __arrayOfConnectedRatingChanges.push(_id);
                });

                _result.push({
                    date: uniqDate,
                    ratingScalesIds: __arrayOfConnectedRatingChanges
                });
            });
            console.log("RESULT from avg ratings: ", _result);

            var _final = [];
            _result.forEach(function(res) {
                var _sum = 0;
                var _divisor = res.ratingScalesIds.length;
                var _ratingScalesArr = [];
                res.ratingScalesIds.forEach(function(ratingScaleId) {
                    var _rSc = RatingScales.findOne({_id: ratingScaleId});
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
