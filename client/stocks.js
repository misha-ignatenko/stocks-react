if (Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: "USERNAME_ONLY"
    });

    // Meteor.subscribe("pickLists");
    // Meteor.subscribe("pickListItems");

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
                    var _date = moment(histData.date).tz("America/New_York").format("YYYY-MM-DD");;
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
        generateWeightedAnalystRatingsTimeSeriesEveryDay: function(_avgRatingsSeriesEveryDay, _startDateForRegression, _endDateForRegression, historicalData, priceReactionDelayDays, priceType, _pctGoDownPerDayAtMinRating, _pctGoUpPerDayAtMaxRating, _stepSize2, _maxIter2) {
            var _result = {};



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

                var _preparedArrayOfWeightedRatings = StocksReact.functions.prepareArrayOfWeightedRatingsForGraph(_data.uniqueResearchFirmIds, _resultFromGradientDescent2.weights, _avgRatingsSeriesEveryDay);
                _result = {ratings: _preparedArrayOfWeightedRatings, weights: _firmsAndWeights};
            }

            return _result;
        },
        predictionsBasedOnRatings: function(_datesAndRatings,
                                            pricesArr,
                                            priceTypeStr,
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
                price: pricesArr[0][priceTypeStr],
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
        , getRatingScalesHandleFromAvailableRatingChanges: function(optionalRatingChangesArray) {
            var _shortedRatingChanges = optionalRatingChangesArray || RatingChanges.find({}, {fields: {oldRatingId: 1, newRatingId: 1}}).fetch();
            var _uniqOldRatingIds = _.uniq(_.pluck(_shortedRatingChanges, 'oldRatingId'));
            var _uniqNewRatingIds = _.uniq(_.pluck(_shortedRatingChanges, 'newRatingId'));
            var _allUniqRatingIdsForSubscription = _.union(_uniqOldRatingIds, _uniqNewRatingIds);

            return Meteor.subscribe("specificRatingScales", _allUniqRatingIdsForSubscription);
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
