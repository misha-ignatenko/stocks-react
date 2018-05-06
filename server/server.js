var _maxStocksAllowedPerUnregisteredUser = 5;

function getPortfolioPricesWiki(datesAndSymbolsMap) {
    // todo: LIMIT COLUMNS requested



    // step 1. split into batches (max response size is 10k records)
    var _dates = _.keys(datesAndSymbolsMap);
    var _batches = [];
    var _datesBatch = [];
    var _symbolsBatch = [];
    _.each(_dates, function (dateStr, idx) {
        var _symbolsForDate = datesAndSymbolsMap[dateStr];
        var _futureSymbolsUnion = _.union(_symbolsBatch, _symbolsForDate);

        if ((_datesBatch.length + 1) * (_futureSymbolsUnion.length) > 10000) {
            _batches.push({dates: _datesBatch, symbols: _symbolsBatch});

            _datesBatch = [dateStr];
            _symbolsBatch = _symbolsForDate;
        } else {
            _datesBatch.push(dateStr);
            _symbolsBatch = _futureSymbolsUnion;
        }

        // if last iteration, push batch
        if (idx === _dates.length - 1) {
            _batches.push({dates: _datesBatch, symbols: _symbolsBatch});
        }
    });



    // step 2. get all prices
    var _prices = [];
    var _reponseMapFromWiki = {};
    _.each(_batches, function (b) {
        var _url = StocksReactServerUtils.prices.getWikiPricesQuandlUrl(b.dates, b.symbols);
        console.log("url: ", _url);
        var _res = HTTP.get(_url);
        if (_res) {
            var _datatable = _res.data.datatable;
            _.each(_datatable.data, function (px) {
                var _formatted = StocksReactServerUtils.prices.getFormattedPriceObjWiki(px, _datatable.columns);

                // only return the prices that were requested for date and symbol
                if (_.contains(datesAndSymbolsMap[_formatted.dateString], _formatted.symbol)) {
                    _prices.push({symbol: _formatted.symbol, dateString: _formatted.dateString, adjClose: _formatted.adjClose});

                    // update _reponseMapFromWiki
                    if (!_reponseMapFromWiki[_formatted.dateString]) {
                        _reponseMapFromWiki[_formatted.dateString] = [_formatted.symbol];
                    } else {
                        _reponseMapFromWiki[_formatted.dateString] = _.union(_reponseMapFromWiki[_formatted.dateString], [_formatted.symbol]);
                    };
                }
            })
        }
    });



    // step 3. quality check
    var _missingMap = {};
    _.each(_dates, function (d) {
        var _symbolsNeeded = datesAndSymbolsMap[d];
        var _symbolsObtained = _reponseMapFromWiki[d] || [];
        var _symbolsNotObtained = _.difference(_symbolsNeeded, _symbolsObtained);
        _missingMap[d] = _symbolsNotObtained;
    });


    return {prices: _prices, missingMap: _missingMap};
};

function getPortfolioPricesNasdaq(datesAndSymbolsMap) {

    // step 1. transform datesAndSymbolsMap
    var _symbolsAndDatesMap = {};
    var _dates = _.keys(datesAndSymbolsMap);
    _.each(_dates, function (d) {
        var _symbolsForDate = datesAndSymbolsMap[d];
        _.each(_symbolsForDate, function (s) {
            if (!_symbolsAndDatesMap[s]) {
                _symbolsAndDatesMap[s] = [d];
            } else {
                _symbolsAndDatesMap[s].push(d);
            }
        });
    });



    // step 2. get all prices
    var _prices = [];
    var _responseMap = {};
    var _symbols = _.keys(_symbolsAndDatesMap);
    _.each(_symbols, function (s) {
        var _minMaxDates = StocksReactUtils.getMinMaxDate(_symbolsAndDatesMap[s]);
        var _url = StocksReactServerUtils.prices.getNasdaqPricesQuandlUrl(s, _minMaxDates.min, _minMaxDates.max);
        console.log("url: ", _url);
        try {
            var _res = HTTP.get(_url);
            var _dataset = _res.data.dataset;
            var _unprocessedPrices = _dataset.data;
            var _columnNames = _.map(_dataset.column_names, function (rawColName) {
                return rawColName.replace(/ /g, "_");
            });

            _.each(_unprocessedPrices, function (obj, idx) {

                // check that all column names are present
                if (_columnNames.length === obj.length && _columnNames.length === 8) {
                    var _convertedObj = StocksReactServerUtils.prices.getFormattedPriceObjNasdaq(_columnNames, obj, s);

                    // only return the prices that were requested for date and symbol
                    if (_.contains(datesAndSymbolsMap[_convertedObj.dateString], _convertedObj.symbol)) {
                        _prices.push({symbol: _convertedObj.symbol, dateString: _convertedObj.dateString, adjClose: _convertedObj.adjClose});

                        // update _responseMap
                        if (!_responseMap[_convertedObj.dateString]) {
                            _responseMap[_convertedObj.dateString] = [_convertedObj.symbol];
                        } else {
                            _responseMap[_convertedObj.dateString] = _.union(_responseMap[_convertedObj.dateString], [_convertedObj.symbol]);
                        };
                    }
                } else {
                    throw new Meteor.Error("missing keys for NASDAQ data import: ", s);
                }
            })

        } catch (e) {
            console.log("ERROR");
            console.log(s + ": " + e.response.content);
        };
    });



    // step 3. quality check
    var _missingMap = {};
    _.each(_dates, function (d) {
        var _symbolsNeeded = datesAndSymbolsMap[d];
        var _symbolsObtained = _responseMap[d] || [];
        var _symbolsNotObtained = _.difference(_symbolsNeeded, _symbolsObtained);
        _missingMap[d] = _symbolsNotObtained;
    });


    return {prices: _prices, missingMap: _missingMap};
};

Meteor.methods({
    getPricesForSymbol: function (symbol) {
        var _prices = StocksReactServerUtils.prices.getAllPrices(symbol);
        return _prices;
    },

    getEarliestRatingChange: function (symbol) {
        var _r = RatingChanges.findOne({symbol: symbol}, {sort: {dateString: 1}});
        return _r && _r.dateString;
    },

    getPricesFromApi: function (datesAndSymbolsMap) {



        // step 1. get all available data from Wiki with missing map
        var _wikiData = getPortfolioPricesWiki(datesAndSymbolsMap);
        var _wikiMissingMap = _wikiData.missingMap;
        var _wikiPrices = _wikiData.prices;



        // step 2. try to get from Nasdaq what's missing from Wiki. Output what's still missing in Nasdaq after Wiki.
        var _nasdaqData = getPortfolioPricesNasdaq(_wikiMissingMap);
        var _nasdaqMissingMap = _nasdaqData.missingMap;
        var _nasdaqPrices = _nasdaqData.prices;
        console.log("final missing map: ", _nasdaqMissingMap);

        return _wikiPrices.concat(_nasdaqPrices);
    },

    insertAltRatingScale: function (firmNameStr, mainRatingString, mainRatingStringExactMatchBool, alternativeRatingString) {
        var _user = Meteor.user();
        if (!_user) {
            throw new Meteor.Error("Please log in.");
        } else {
            var _dataImportPermissions = _user.permissions && _user.permissions.dataImports;
            var _canImportRatingScales = _dataImportPermissions && _.contains(_dataImportPermissions, "canImportRatingScales");
            if (!_canImportRatingScales) {
                throw new Meteor.Error("You do not have permission to import rating scales.");
            }
        }

        var _researchFirmQuery = {
            name: { $regex: firmNameStr }
        };
        var _firms = ResearchCompanies.find(_researchFirmQuery).fetch();

        var _firmId = _firms.length === 1 ? _firms[0]._id : null;
        if (_firmId) {
            console.log("the firm id is: ", _firmId);
            var _ratingScaleQuery = {
                firmRatingFullString: mainRatingStringExactMatchBool ? mainRatingString : { $regex: mainRatingString },
                researchFirmId: _firmId
            };
            var _ratingScales = RatingScales.find(_ratingScaleQuery).fetch();

            var _ratingScaleId = _ratingScales.length === 1 ? _ratingScales[0]._id : null;
            if (_ratingScaleId) {
                console.log("rating scale id: ", _ratingScaleId);

                var _alternativeRatingScale = {
                    researchFirmId: _firmId,
                    type: "alternative",
                    ratingString: alternativeRatingString,
                    referenceRatingScaleId: _ratingScaleId
                };

                if (!RatingScales.findOne(_alternativeRatingScale)) {
                    var _newId = RatingScales.insert(_alternativeRatingScale);
                    console.log("inserted id: ", _newId);
                }
            } else {
                console.log("cannot find exactly one rating scale with query: ", _ratingScaleQuery);
            }
        } else {
            console.log("cannot find firm with query: ", _researchFirmQuery);
        }

        return;
    },

    fixMissingPricesFor: function (symbols) {

        // step 1. check quandl_free: no date specified (false), each symbol in the symbols array, overwrite flag (true).
        Meteor.call("getQuandlPricesForDate", false, symbols, true);

        // step 2. check quandl_paid.
        var _nycDateTime = moment().tz("America/New_York");
        var _nycDateTimeString = _nycDateTime.format();
        var _latestDayDoneInNyc = _nycDateTimeString.slice(11, 19) > "21:00:00" ? _nycDateTimeString.slice(0, 10) : _nycDateTime.subtract(1, "days").format("YYYY-MM-DD");
        _.each(symbols, function (s) {
            Meteor.call("getStockPricesNew", s, "2014-01-01", _latestDayDoneInNyc, true);
        });

        // step 3. processSplits (only if there are any stock prices with missing adjClose).
        Meteor.call("processSplits", symbols);
    },

    getNASDAQquandlStockPrices: function (symbol, startDate, endDate) {
        try {
            var result = HTTP.get(StocksReactServerUtils.prices.getNasdaqPricesQuandlUrl(symbol, startDate, endDate));
            var _data = result.data.dataset.data;
            var _columnNames = _.map(result.data.dataset.column_names, function (rawColName) {
                return rawColName.replace(/ /g, "_");
            });

            var _formattedData = [];
            _.each(_data, function (obj, idx) {

                // check that all column names are present
                if (_columnNames.length === obj.length && _columnNames.length === 8) {
                    var _convertedObj = StocksReactServerUtils.prices.getFormattedPriceObjNasdaq(_columnNames, obj, symbol);

                    _formattedData.push(_convertedObj);
                } else {
                    throw new Meteor.Error("missing keys for NASDAQ data import: ", symbol);
                }
            })

            return _formattedData;
        } catch (e) {
            throw new Meteor.Error(e.response.content);
        }
    },

    stockPriceInsertAttempt: function (stockPriceObj) {
        var _symbol = stockPriceObj.symbol;
        var _dateString = stockPriceObj.dateString;

        var _obj = NewStockPrices.findOne({symbol: _symbol, dateString: _dateString});

        if (!_obj) {
            console.log("did not find an obj so gonna insert: ", _dateString, _symbol);
            return NewStockPrices.insert(stockPriceObj)
        } else {
            console.log("object already exists in db: ", _dateString, _symbol);
            return _obj._id + '_existing';
        }
    },

    getStockPricesNew: function(symbol, startStr, endStr, startFromExistingEndDateBool) {
        console.log("in the outer method getStockPrices New");
        var _res;

        var _existingStartDate = NewStockPrices.findOne({symbol: symbol}, {sort: {dateString: 1}});
        if (_existingStartDate) {
            _existingStartDate = _existingStartDate.dateString;
            console.log("start date: ", _existingStartDate)
        }

        var _existingEndDate = NewStockPrices.findOne({symbol: symbol}, {sort: {dateString: -1}});
        if (_existingEndDate) {
            _existingEndDate = _existingEndDate.dateString;
            console.log("end date: ", _existingEndDate)
        }

        var _pullNewData = true;

        var _startUpd;
        var _endUpd;

        if (_existingStartDate && _existingEndDate && _existingStartDate <= startStr && _existingEndDate >= endStr) {
            // this means that all data already exists in the requested date range so no need to pull anything new
            _pullNewData = false;
            _startUpd = _existingStartDate;
            _endUpd = _existingEndDate;
        } else if (_existingStartDate && _existingEndDate) {
            // this means that there is SOME data but not everything that we want exists yet
            _pullNewData = true;
            // now reset startStr and endStr
            var _allDateNums = [
                parseInt(_existingStartDate.replace(/-/g, '')),
                parseInt(_existingEndDate.replace(/-/g, '')),
                parseInt(startStr.replace(/-/g, '')),
                parseInt(endStr.replace(/-/g, ''))
            ]

            // modify startStr and endStr that will go into the getStockPricesFromYahooFinance method below
            var _minDateStrNoDashes = _.min(_allDateNums).toString();
            var _maxDateStrNoDashes = _.max(_allDateNums).toString();

            startStr = _minDateStrNoDashes.substring(0,4) + '-' + _minDateStrNoDashes.substring(4,6) + '-' + _minDateStrNoDashes.substring(6,8);
            endStr = _maxDateStrNoDashes.substring(0,4) + '-' + _maxDateStrNoDashes.substring(4,6) + '-' + _maxDateStrNoDashes.substring(6,8);
            _startUpd = startStr;
            _endUpd = endStr;

            if (startFromExistingEndDateBool) {
                // startStr one day after _existingEndDate
                // no need to overwrite minRequestedStartDate aka _startUpd
                startStr = moment(_existingEndDate).add(1, "days").format("YYYY-MM-DD");
                var _stock = Stocks.findOne(symbol);
                if (_stock && _stock.minRequestedStartDate) {
                    _startUpd = _stock.minRequestedStartDate;
                }
            }
        } else {
            // there is no existing start or end date
            _pullNewData = true;
            _startUpd = startStr;
            _endUpd = endStr;
        }

        if (_pullNewData && startStr <= endStr) {
            Meteor.call("getNASDAQquandlStockPrices", symbol, startStr, endStr, function (error, result) {
                if (!error && result) {
                    console.log("got a result from Yahoo Finance. the length of result is: ", result.length);
                    // inner futures link: http://stackoverflow.com/questions/25940806/meteor-synchronizing-multiple-async-queries-before-returning

                    var _getStockPricesFromYahooFinanceResults = [];
                    result.forEach(function (priceObj) {

                        Meteor.call('stockPriceInsertAttempt', priceObj, function (error, result) {
                            if (error) {
                                _getStockPricesFromYahooFinanceResults.push(error);
                            } else {
                                _getStockPricesFromYahooFinanceResults.push(result);
                            }
                        })
                    });

                    _res = _getStockPricesFromYahooFinanceResults;

                } else {
                    _res = error;
                }
            })
        } else {
            _res = 'already have all the needed stock prices data';
        }

        Stocks.update(
            {_id: symbol},
            {$set: {
                minRequestedStartDate: _startUpd,
                maxRequestedEndDate: _endUpd,
            }},
            {multi: true}
        );

        return _res;
    },
    addNewSymbolMapping: function(localStr, fromStr, universalStr) {
        var _obj = {
            symbolStr: localStr,
            from: fromStr,
            universalSymbolStr: universalStr
        };
        if (SymbolMappings.find(_obj).count() == 0) {
            return SymbolMappings.insert(_obj);
        }
    },

    getRegressionPerformance: function (symbol, maxRatingChangeDate, priceCheckDate) {

        // step 1. get all rating changes for symbol up to maxRatingChangeDate
        var _ratingChangesForRegr = RatingChanges.find({symbol: symbol, dateString: {$lte: maxRatingChangeDate}}, {sort: {dateString: 1}}).fetch();

        // step 2. get all stock prices for symbol between earliest rating change's closest prior business day and maxRatingChangeDate
        //moment().toISOString().substring(10,24)
        var _regrStart = StocksReactUtils.getClosestPreviousWeekDayDateByCutoffTime(false, moment(_ratingChangesForRegr[0].dateString + moment().toISOString().substring(10,24)).tz("America/New_York"));
        var _regrEnd = maxRatingChangeDate;
        var _allPrices = StocksReactServerUtils.prices.getAllPrices(symbol);
        var _pricesForRegr = StocksReactUtils.stockPrices.getPricesBetween(_allPrices, _regrStart, _regrEnd);

        // step 3. check that have all the needed prices in date range
        var _availablePricesStart = _pricesForRegr[0].dateString;
        var _availablePricesEnd = _pricesForRegr[_pricesForRegr.length - 1].dateString;
        if (_regrStart === _availablePricesStart && _regrEnd === _availablePricesEnd) {
            var _averageAnalystRatingSeries = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeries(symbol, _regrStart, _regrEnd);
            var _avgRatingsSeriesEveryDay = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeriesEveryDay(_averageAnalystRatingSeries, _pricesForRegr);

            var _priceReactionDelayInDays = 0;
            var pctDownPerDay = 0.5;
            var pctUpPerDay = 0.5;
            var stepSizePow = -7;
            var regrIterNum = 30;
            var _rollingNum = 50;
            var _rollingPx = StocksReactUtils.stockPrices.getSimpleRollingPx(_allPrices, _regrStart, _rollingNum);
            var _rollingPxEnd = StocksReactUtils.stockPrices.getSimpleRollingPx(_allPrices, _regrEnd, _rollingNum);
            var _rollingPriceCheck = StocksReactUtils.stockPrices.getSimpleRollingPx(_allPrices, priceCheckDate, _rollingNum);
            console.log("START AND END: ", _regrStart, _regrEnd, priceCheckDate);
            var _weightedRatingsSeriesEveryDay = StocksReactUtils.ratingChanges.generateWeightedAnalystRatingsTimeSeriesEveryDay(_avgRatingsSeriesEveryDay, _regrStart, _regrEnd, _pricesForRegr, _priceReactionDelayInDays, "adjClose", pctDownPerDay, pctUpPerDay, Math.pow(10, stepSizePow), regrIterNum);
            _weightedRatingsSeriesEveryDay = _weightedRatingsSeriesEveryDay.ratings;

            // step 5. get all future prices
            var _futurePrices = StocksReactUtils.stockPrices.getPricesBetween(_allPrices, _regrEnd, priceCheckDate);
            console.log("length 1: ", _futurePrices.length);

            // step 6. make sure all the needed future prices are in the db
            if (_futurePrices[0].dateString !== _regrEnd || _futurePrices[_futurePrices.length - 1].dateString !== priceCheckDate) {
                throw new Meteor.Error("make sure there are prices for " + symbol + " from " + _regrEnd + " to " + priceCheckDate);
            }

            // step 7.1: project last item in _avgRatingsSeriesEveryDay to all future prices
            var _lastAvg = _avgRatingsSeriesEveryDay[_avgRatingsSeriesEveryDay.length - 1];
            var _futureAvgProjection = _.map(_futurePrices, function (p) {
                return {date: p.date, rating: _lastAvg.avg, dateString: p.dateString};
            });

            // step 7.2: get predictions based on projected future avg ratings.
            var _predictionsBasedOnAvgRatings = StocksReactUtils.ratingChanges.predictionsBasedOnRatings(
                _futureAvgProjection, _futurePrices, "adjClose", false, 0, 120, 60, pctDownPerDay, pctUpPerDay);

            // step 8.1: project last item in _weightedRatingsSeriesEveryDay to all future prices
            var _lastWgt = _weightedRatingsSeriesEveryDay[_weightedRatingsSeriesEveryDay.length - 1];
            var _futureWgtProjection = _.map(_futurePrices, function (p) {
                return {date: p.date, rating: _lastWgt.weightedRating, dateString: p.dateString};
            });

            // step 8.2: get predictions based on projected future wgt ratings.
            var _predictionsBasedOnWeightedRatings = StocksReactUtils.ratingChanges.predictionsBasedOnRatings(
                _futureWgtProjection, _futurePrices, "adjClose", false, 0, 120, 60, pctDownPerDay, pctUpPerDay);

            // figure out the same but if predictions were based on the entire date range (regr + future)
            // step 5*. get all prices
            var _regrAndFuturePrices = StocksReactUtils.stockPrices.getPricesBetween(_allPrices, _regrStart, priceCheckDate);
            console.log("length 2: ", _regrAndFuturePrices.length);

            // step 6*. make sure have all the needed prices
            if (_regrAndFuturePrices[0].dateString !== _regrStart || _regrAndFuturePrices[_regrAndFuturePrices.length - 1].dateString !== priceCheckDate) {
                throw new Meteor.Error("make sure there are prices for " + symbol + " from " + _regrStart + " to " + priceCheckDate);
            }

            // step 8.1*. project all prices onto daily WGT rating series (copy over all existing _weightedRatingsSeriesEveryDay
            // and copy over the last item from _weightedRatingsSeriesEveryDay to all the remaining future days
            var _regrAndFutureWgtRatingsEveryDay = _.map(_regrAndFuturePrices, function (p, idx) {
                if (p.dateString > _lastWgt.dateString) {
                    // just copy over the last wgt rating
                    return {date: p.date, rating: _lastWgt.weightedRating, dateString: p.dateString};
                } else {
                    // copy over historical daily wgt rating from regression
                    var _w = _weightedRatingsSeriesEveryDay[idx];
                    if (p.dateString !== _w.dateString) {
                        throw new Meteor.Error("error while projecting daily weighted ratings into the future: " + p.dateString + " " + _w.dateString);
                    }

                    return {date: p.date, rating: _w.weightedRating, dateString: p.dateString};
                }
            });

            // step 8.2*. get predictions based on ALL daily wgt ratings from regression AND future.
            var _predictOnWgtRegrAndFut = StocksReactUtils.ratingChanges.predictionsBasedOnRatings(
                _regrAndFutureWgtRatingsEveryDay, _regrAndFuturePrices, "adjClose", _rollingPx, 0, 120, 60, pctDownPerDay, pctUpPerDay);





            // step 9.1*. project all prices onto daily AVG rating series
            var _regrAndFutureAvgRatingsEveryDay = _.map(_regrAndFuturePrices, function (p, idx) {
                if (p.dateString > _lastAvg.dateString) {
                    // just copy over the last avg rating
                    return {date: p.date, rating: _lastAvg.avg, dateString: p.dateString};
                } else {
                    // copy over historical daily avg rating from regression
                    var _a = _avgRatingsSeriesEveryDay[idx];
                    if (p.dateString !== _a.dateString) {
                        throw new Meteor.Error("error while projecting daily weighted ratings into the future: " + p.dateString + " " + _a.dateString);
                    }

                    return {date: p.date, rating: _a.avg, dateString: p.dateString};
                }
            });

            // step 9.2*. get predictions based on ALL daily avg ratings from regression AND future.
            var _predictOnAvgRegrAndFut = StocksReactUtils.ratingChanges.predictionsBasedOnRatings(
                _regrAndFutureAvgRatingsEveryDay, _regrAndFuturePrices, "adjClose", _rollingPx, 0, 120, 60, pctDownPerDay, pctUpPerDay);



            return {
                avgRatingsExtended: _regrAndFutureAvgRatingsEveryDay,
                wgtRatingsExtended: _regrAndFutureWgtRatingsEveryDay,
                px: _regrAndFuturePrices,
                avg: _predictionsBasedOnAvgRatings,
                wgt: _predictionsBasedOnWeightedRatings,
                altAvg: _predictOnAvgRegrAndFut,
                altWgt: _predictOnWgtRegrAndFut,
                actualStart: _futurePrices[0],
                actualEnd: _futurePrices[_futurePrices.length - 1],
                rCh: _ratingChangesForRegr,
                avgRatingsDaily: _avgRatingsSeriesEveryDay,
                wgtRatingsDaily: _weightedRatingsSeriesEveryDay,
                rollingRegrStart: _rollingPx,
                rollingRegrEnd: _rollingPxEnd,
                rollingPriceCheck: _rollingPriceCheck,
                regrStartDate: _regrStart,
            };
        } else {
            console.log("mismatch with prices history: ", _regrStart, _availablePricesStart, _regrEnd, _availablePricesEnd);
        }
    },

    getDefaultPerformanceDatesFor: function(portfolioId) {
        var _p = Portfolios.findOne(portfolioId);
        var pItemsExist = _p && PortfolioItems.findOne({portfolioId: _p._id});
        var _minDateStr = pItemsExist ? PortfolioItems.findOne({portfolioId: _p._id}, {limit: 1, sort: {dateString: 1}}).dateString : "";
        var _maxDatrStr = pItemsExist ? PortfolioItems.findOne({portfolioId: _p._id}, {limit: 1, sort: {dateString: -1}}).dateString : "";

        if (_p.rolling && pItemsExist) {
            _minDateStr = moment(_minDateStr).tz("America/New_York").add(_p.lookback / 5 * 7, "days").format("YYYY-MM-DD");
        }
        
        // a case for combined portfolios (i.e., portfolios consisting of a screen by multiple criteria)
        if (_p.criteria) {
            var _ratingScaleIds = [];
            var _researchFirms = [];
            var _criteriaRatingScales = [];

            // the purpose of this for loop is to figure out the widest date range where RatingChanges match portfolio's criteria
            _.each(_p.criteria, function (criterion) {
                var _query = JSON.parse(criterion);
                var _ratingScales = RatingScales.find(_query).fetch();
                _criteriaRatingScales.push(_ratingScales);

                _.each(_ratingScales, function (ratingScaleObj) {
                    var ratingScaleId = ratingScaleObj._id;
                    _ratingScaleIds.push(ratingScaleId);
                    _researchFirms.push(ratingScaleObj.researchFirmId);

                    // check if a rating change with either that newRatingId or oldRatingId exists
                    var _rChDatesQry = {$or: [{newRatingId: ratingScaleId}, {oldRatingId: ratingScaleId}]};
                    var _ratingChangesExist = RatingChanges.findOne(_rChDatesQry);

                    var _newMin = _ratingChangesExist ? RatingChanges.findOne(_rChDatesQry, {limit: 1, sort: {dateString: 1}}).dateString : "";
                    var _newMax = _ratingChangesExist ? RatingChanges.findOne(_rChDatesQry, {limit: 1, sort: {dateString: -1}}).dateString : "";

                    _minDateStr = (_minDateStr === "" ? _newMin : _newMin < _minDateStr ? _newMin : _minDateStr);
                    _maxDatrStr = (_maxDatrStr === "" ? _newMax : _newMax > _maxDatrStr ? _newMax : _maxDatrStr);
                })
            });

            // final RatingChanges are where dateString is between the calculated min and max dates and
            // either newRatingId or oldRatingId is in the list of RatingScales of interest (based on
            // portfolio's criteria) -- meaning that some symbol's rating changed TO a rating scale of interest or
            // it changed FROM a rating scale of interest.
            var _finalRatingChanges = RatingChanges.find({
                $and: [{$or: [{newRatingId: {$in: _.uniq(_ratingScaleIds)}}, {oldRatingId: {$in: _.uniq(_ratingScaleIds)}}]}, {dateString: {$gte: _minDateStr}}, {dateString: {$lte: _maxDatrStr}}]
            }, {
                fields: {symbol: 1, dateString: 1, oldRatingId: 1, newRatingId: 1}
            }).fetch();

            return {
                criteriaRatingScales: _criteriaRatingScales,
                startDate: _minDateStr,
                endDate: _maxDatrStr,
                ratingChanges: _finalRatingChanges
            };
        }

        return {
            startDate: _minDateStr,
            endDate: _maxDatrStr
        };
    },

    ensureRatingChangesSymbolsDefinedInStocksCollection: function () {
        var _uniqRatingChangesSymbols = _.uniq(_.pluck(RatingChanges.find({}, {fields: {symbol: 1}}).fetch(), "symbol"));

        // make sure that all these unique symbols in RatingChanges collection exist in Stocks collection
        var _uniqStocks = _.uniq(_.pluck(Stocks.find({}, {fields: {_id: 1}}).fetch(), "_id"));

        var _symbolsNotInStocksCollection = _.difference(_uniqRatingChangesSymbols, _uniqStocks);

        var _thisArrShouldBeEmpty = [];
        _.each(_symbolsNotInStocksCollection, function (symbol) {
            // look up each symbol in symbol mapping collection. if it's not there with "rating_changes" flag, then
            // push to _thisArrShouldBeEmpty

            var _symbolMapping = SymbolMappings.findOne({
                "symbolStr" : symbol,
                "from" : "rating_change"
            });
            if (_symbolMapping) {
                // do nothing
            } else {
                _thisArrShouldBeEmpty.push({
                    symbol: symbol,
                    ratingChangesDates: _.pluck(RatingChanges.find({symbol: symbol}, {fields: {dateString: 1}}).fetch(), "dateString")
                });
            }
        });

        return _thisArrShouldBeEmpty;
    }

    , getRatingChangeHistoryForSymbolAndFirm(symbol, firmName) {
        var _firm = ResearchCompanies.find({name: firmName}).fetch();
        if (_firm.length === 1) {
            var _firmId = _firm[0]._id;
            var _ratingChanges = RatingChanges.find({symbol: symbol, researchFirmId: _firmId}, {sort: {dateString: 1}}).fetch();
            _.each(_ratingChanges, function (rCh) {
                console.log("date: ", rCh.dateString);
                console.log("old: ", RatingScales.findOne(rCh.oldRatingId).universalScaleValue);
                console.log("new: ", RatingScales.findOne(rCh.newRatingId).universalScaleValue);
                console.log("--------------------------------------");
            })
        } else {
            console.log("cannot find the needed firm: ", _firm);
        }
    }
    
    , insertNewRollingPortfolioItem: function (obj) {
        // check that the symbol exists
        var _p = Portfolios.findOne(obj.portfolioId);
        if (!_p || !_p.rolling) {
            throw new Meteor.Error("portfolio does not exist or it is not rolling!");
        }

        if (!Stocks.findOne(obj.symbol)) {
            throw new Meteor.Error("symbol does not exist!");
        } else {
            // check if such portfolio item already exists for that date and symbol
            var _existingPortfolioItem = PortfolioItems.findOne({symbol: obj.symbol, portfolioId: obj.portfolioId, dateString: obj.dateString});
            if (_existingPortfolioItem) {
                throw new Meteor.Error("portfolio item already exists!");
            } else {
                if (isNaN((new Date(obj.dateString)).valueOf())) {
                    throw new Meteor.Error("date is not valid!");
                } else {
                    var _user = Meteor.user();
                    if (!_user) {
                        throw new Meteor.Error("Please log in to import portfolio items.");
                    } else {
                        var _dataImportPermissions = _user.permissions && _user.permissions.dataImports;
                        var _canImportPortfolioItems = _dataImportPermissions && _dataImportPermissions.indexOf("canImportPortfolioItems") > -1;
                        if (!_canImportPortfolioItems) {
                            throw new Meteor.Error("You do not have permission to import portfolio items.");
                        }
                    }

                    PortfolioItems.insert({
                        symbol: obj.symbol,
                        portfolioId: obj.portfolioId,
                        dateString: obj.dateString,
                        short: obj.short
                    })
                }
            }
        }
    }
})

// inner futures link: http://stackoverflow.com/questions/25940806/meteor-synchronizing-multiple-async-queries-before-returning

if (Meteor.isServer) {
    Meteor.publish("earningsReleases", function (startDate, endDate, companyConfirmedOnly) {

        var _query = {
            reportDateNextFiscalQuarter: {
                $gte: startDate, $lte: endDate,
            }
        };

        if (companyConfirmedOnly) {
            _query = _.extend(_query, {
                reportSourceFlag: 1
            });
        };

        var _allEarningsReleases = EarningsReleases.find(_query, {sort: {reportSourceFlag: 1, reportDateNextFiscalQuarter: 1, asOf: -1}});

        return _allEarningsReleases;
    });

    Meteor.publish("portfolios", function() {
        if (this.userId) {
            // TODO: add logic here to also return portfolios that you have either view or edit access in PortfolioPermissions collection
            //portfolios that are either public or the user is owner
            return Portfolios.find(
                { $or: [ {private: false}, {ownerId: this.userId} ] },
                {fields: {_id: 1, name: 1, researchFirmId: 1, ownerId: 1, private: 1}}
                );
        } else {
            return Portfolios.find({private: false}, {fields: {_id: 1, name: 1}});
        }
    });

    Meteor.publish(null, function() {
        var _user = this.userId ? Meteor.users.find({_id: this.userId}, {fields: {_id: 1, username: 1, individualStocksAccess: 1, registered: 1, lastModified: 1, showDataImportsTab: 1}}) : null;
        return _user;
    });

    Accounts.onCreateUser(function(options, user) {
        var _createdUser;
        if (options.registered === undefined) {
            _createdUser = _.extend(user, {registered: false});
        } else {
            _createdUser = _.extend(user, {registered: options.registered});
        }

        //set premium to false no matter what
        _createdUser.premium = false;
        _createdUser.permissions = {};
        _createdUser.showDataImportsTab = false;

        return _createdUser;
    })

    Meteor.methods({

        registerRealAccountFromDummy: function(newUsername, newPassword) {
            var dummyUserId = Meteor.userId();
            Accounts.setUsername(dummyUserId, newUsername);
            Accounts.setPassword(dummyUserId, newPassword);
            Meteor.users.update({_id: dummyUserId}, {$set: {registered: true}});
            return {username: newUsername, password: newPassword};
        },
        addIndividualStockToUser: function(userId, symbol) {
            var _user = Meteor.users.findOne(userId);
            if (_user.individualStocksAccess &&
                (_user.individualStocksAccess.length < _maxStocksAllowedPerUnregisteredUser || _user.registered) &&
                _.indexOf(_user.individualStocksAccess, symbol) === -1
            ) {
                Meteor.users.update({_id: userId}, {$push: { individualStocksAccess: symbol }});
            } else if (!_user.individualStocksAccess) {
                Meteor.users.update({_id: userId}, {$set: { individualStocksAccess: [symbol]}});
            }
        },
        createNewPortfolio: function (name) {
            // Make sure the user is logged in before inserting a portfolio
            if (! Meteor.userId()) {
                throw new Meteor.Error("not-authorized");
            }

            Portfolios.insert({
                name: name,
                private: false,
                ownerId: Meteor.userId(),
                researchFirmId: null,
                lastModifiedOn: moment().toISOString(),
                lastModifiedBy: Meteor.userId(),
                ownerName: Meteor.user().username
            });
        },
        removeStockFromPickList: function(pickListItemId, dateRemoved) {
            var _pickListItem = PickListItems.findOne(pickListItemId);
            if (_pickListItem && !_pickListItem.dateRemoved) {
                PickListItems.update({_id: pickListItemId}, {$set: {dateRemoved: dateRemoved}})
            }
        },
        removePickListItem: function(pickListItemId) {
            PickListItems.remove(pickListItemId);
        },

        checkIfSymbolExists: function (symbol) {
            var _wikiUrl = StocksReactServerUtils.prices.getWikiPricesQuandlUrl(false, [symbol]);
            var _nasdaqUrl = StocksReactServerUtils.prices.getNasdaqPricesQuandlUrl(symbol);
            var _zeaUrl = StocksReactServerUtils.earningsReleases.getZeaUrl(symbol);

            function _checkWiki() {
                try {
                    var _res = HTTP.get(_wikiUrl);
                    if (_res.data.datatable.data.length > 0) {
                        return true;
                    } else {
                        return false;
                    }
                } catch (e) {
                    return false;
                }
            };

            function _checkNasdaq() {
                try {
                    var _res = HTTP.get(_nasdaqUrl);
                    return true;
                } catch (e) {
                    return false;
                }
            }

            function _checkZEA() {
                try {
                    var _res = HTTP.get(_zeaUrl);
                    return true;
                } catch (e) {
                    return false;
                }
            }

            return _checkWiki() || _checkNasdaq() || _checkZEA();
        },

        insertNewStockSymbols: function(symbolsArray) {
            var _res = {};
            var _symbolsAllCapsArray = [];
            symbolsArray.forEach(function(symbol) {
                _symbolsAllCapsArray.push(symbol.toUpperCase());
            });

            _.each(_symbolsAllCapsArray, function (s) {
                if (Stocks.findOne({_id: s})) {
                    _res[s] = true;
                } else {
                    Meteor.call("checkIfSymbolExists", s, function (error, result) {
                        if (result) {
                            Stocks.insert({_id: s});
                            _res[s] = true;
                        } else {
                            _res[s] = false;
                        }
                    })
                }
            });

            return _res;
        },

        getQuandlPricesForDate: function (dateStrYYYY_MM_DD, optionalSymbolsArr, optionalOverWriteFlag) {

            var _res;
            var res = HTTP.get(StocksReactServerUtils.prices.getWikiPricesQuandlUrl(dateStrYYYY_MM_DD, optionalSymbolsArr));
                if (res) {
                    var _data = res.data.datatable.data;
                    var _columnDefs = res.data.datatable.columns;

                    var _getStockPricesFromYahooFinanceResults = [];
                    _.each(_data, function (item, itemIdx) {
                        var _formattedPriceObj = StocksReactServerUtils.prices.getFormattedPriceObjWiki(item, _columnDefs);
                            if (optionalOverWriteFlag) {
                                // remove existing object if there's already a price for that date and symbol from
                                // quandl_paid, even if there's an adjClose that came from processSplits
                                var _obj = NewStockPrices.findOne({source: "quandl_paid", symbol: _formattedPriceObj.symbol, dateString: _formattedPriceObj.dateString});
                                if (_obj) {
                                    console.log("removing this price obj _id: ", _obj._id);
                                    NewStockPrices.remove({_id: _obj._id});
                                }
                            };

                            Meteor.call("stockPriceInsertAttempt", _formattedPriceObj, function (error, result) {
                                if (error) {
                                    _getStockPricesFromYahooFinanceResults.push(error);
                                } else {
                                    _getStockPricesFromYahooFinanceResults.push(result);
                                }
                            })
                    })

                    _res = _getStockPricesFromYahooFinanceResults;
                }
        },

        processSplits: function (symbolsArr) {
            console.log(symbolsArr.length);

            _.each(symbolsArr, function (symbol) {
                try {
                    var _res = Meteor.call("getNASDAQquandlStockPrices", symbol);
                    console.log("the length of result: ", _res.length, symbol);
                    var _sortedDates = _.sortBy(_.pluck(_res, "dateString"), function (dateStr) { return dateStr; });
                    var _maxResultDate = _sortedDates[_sortedDates.length - 1];
                    var _minResultDate = _sortedDates[0];


                    var _filteredRes = _.filter(_res, function (obj) {
                        // exclude cash dividends adjType -- code is 17
                        return (!_.isNull(obj.adjFactor) || !_.isNull(obj.adjType)) && !_.contains([17], obj.adjType)
                    })


                    var _secondOption = false;
                    if (_filteredRes.length === 1) {
                        var _split = _filteredRes[0];
                        // add 1 year to recorded split date because it takes time for the split to take effect
                        var _splitDate = moment(_split.dateString).add(1, "years").format("YYYY-MM-DD");
                        console.log("only one split found for: ", symbol, _splitDate);

                        // make sure the split happened before any prices in the db
                        var _pricesBeforeSplit = NewStockPrices.find({
                            symbol: symbol, dateString: { $lte: _splitDate }
                        }).fetch();
                        if (_pricesBeforeSplit.length === 0) {
                            console.log("all db prices are AFTER the split");
                            _secondOption = true;
                        } else {
                            console.log("there are some db prices BEFORE the split");
                        }
                    }


                    if (_filteredRes.length === 0 || _secondOption) {
                        console.log("no splits OR an irrelevant split found for ", symbol);
                        console.log("min and max dates available from result: ", _minResultDate, _maxResultDate);
                        var _pricesWithMissingAdjClose = NewStockPrices.find({
                            symbol: symbol,
                            adjClose: {$exists: false},
                            $and: [
                                {dateString: {$gte: _minResultDate}},
                                {dateString: {$lte: _maxResultDate}},
                                {adjFactor: {$exists: true}},
                                {adjType: {$exists: true}}
                            ]
                        }).fetch();
                        console.log("length of prices with missing adjClose param: ", _pricesWithMissingAdjClose.length);
                        _.each(_pricesWithMissingAdjClose, function (missingAdjClosePriceObj) {
                            var _id = missingAdjClosePriceObj._id;
                            var _close = missingAdjClosePriceObj.close;
                            console.log(_id, _close);
                            NewStockPrices.update({ _id: _id }, { $set: { adjClose: _close } })
                        })
                    } else {
                        console.log("there are splits for: ", symbol)
                    }


                } catch (e) {

                }
                console.log("--------------");
            });
            console.log("gonna return response");

            return "done";
        },

        getLatestPricesForAllSymbols: function(defaultStartDate, _latestDateString) {
            // defaultStartDate like "2014-01-01"


            var _pastDate = defaultStartDate;

// either maxRequestedEndDate does not exist or it is less than latest market close date
            var _uniqSym = _.uniq(_.pluck(Stocks.find({$or: [  {maxRequestedEndDate: {$exists: false}  }, {   maxRequestedEndDate: {$lt: _latestDateString}  } ]}, {fields: {_id: 1}}).fetch(), "_id"));

            _.each(_uniqSym, function (symbol) {
                console.log("symbol: ", symbol);

                var _existingEndDate = NewStockPrices.findOne({symbol: symbol}, {sort: {dateString: -1}});
                if (_existingEndDate) {
                    _existingEndDate = _existingEndDate.dateString;
                    console.log("end date: ", _existingEndDate)
                } else {
                    console.log("end date does not exist");
                }

                var startStr = _pastDate;
                if (_existingEndDate) {
                    startStr = _existingEndDate;
                };
                var endStr = _latestDateString;

                console.log("gonna request from yahoo finance: ", startStr, endStr);

                var _res;
                Meteor.call("getNASDAQquandlStockPrices", symbol, startStr, endStr, function (error, result) {
                    if (!error && result) {
                        console.log("got a result from Yahoo Finance. the length of result is: ", result.length);
                        // inner futures link: http://stackoverflow.com/questions/25940806/meteor-synchronizing-multiple-async-queries-before-returning

                        var _getStockPricesFromYahooFinanceResults = [];
                        result.forEach(function (priceObj) {

                            Meteor.call('stockPriceInsertAttempt', priceObj, function (error, result) {
                                if (error) {
                                    _getStockPricesFromYahooFinanceResults.push(error);
                                } else {
                                    _getStockPricesFromYahooFinanceResults.push(result);
                                }
                            })
                        });

                        _res = _getStockPricesFromYahooFinanceResults;


                        Stocks.update(
                            {_id: symbol},
                            {$set: {maxRequestedEndDate: endStr}}
                        );

                        if (!_existingEndDate) {
                            Stocks.update(
                                {_id: symbol},
                                {$set: {minRequestedStartDate: startStr}}
                            );
                        }
                    }
                });

                console.log("------------------------------------------");
            });
        }
    });
}