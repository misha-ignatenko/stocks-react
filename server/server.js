import moment from 'moment-timezone';

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
                    _prices.push({symbol: _formatted.symbol, dateString: _formatted.dateString, adjClose: _formatted.adjClose, close: _formatted.close});

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
                        _prices.push({symbol: _convertedObj.symbol, dateString: _convertedObj.dateString, adjClose: _convertedObj.adjClose, close: _convertedObj.close});

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

    portfolioItems: function (portfolioIds, startStr, endStr) {
        return PortfolioItems.find({
            $or: [
                {
                    weight: {$exists: false},
                }, {
                    weight: {$exists: true, $gt: 0},
                },
            ],
            portfolioId: {$in: portfolioIds}, $and: [{dateString: {$gte: startStr}}, {dateString: {$lte: endStr}}]
        }, {
            sort: {dateString: 1}
        }).fetch();
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
        console.log("inside earningsReleases publication")

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
    });
}