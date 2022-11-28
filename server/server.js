import { Meteor } from 'meteor/meteor';
import moment from 'moment-timezone';
import _ from 'underscore';
import { check, Match } from 'meteor/check';
import { EJSON } from 'meteor/ejson';
const momentBiz = require('moment-business-days');

var _maxStocksAllowedPerUnregisteredUser = 5;

const dateStringSortDesc = {dateString: -1};
const researchFirmIDsToExclude = [
    'vt29AuAATaAu7r3rS',
    'TMbx3pyYK8gSqH3W6',
];
const YYYYMMDD = 'YYYYMMDD';
const YYYY_MM_DD = 'YYYY-MM-DD';
const ADJ_CLOSE = 'adjClose';
const getRatingChangesQuery = () => {
    return {
        researchFirmId: {$nin: researchFirmIDsToExclude},
        dateString: {$gte: StocksReactUtils.monthsAgo(StocksReactUtils.ratingChangesLookbackMonths)},
    };
};

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
    getLatestRatingChanges() {
        console.log('getLatestRatingChanges');
        const ratingChanges = RatingChanges.find(getRatingChangesQuery(), {
            sort: dateStringSortDesc,
            limit: StocksReactServerUtils.ratingsChangesLimitGlobal(),
        }).fetch();

        return StocksReactServerUtils.getExtraRatingChangeData(ratingChanges);
    },

    getLatestRatingChangesForSymbol(symbol) {
        check(symbol, String);

        const ratingChanges = RatingChanges.find(_.extend(getRatingChangesQuery(), {
            symbol: symbol,
        }), {
            sort: dateStringSortDesc,
            limit: StocksReactServerUtils.ratingsChangesLimitSymbol(),
        }).fetch();

        return StocksReactServerUtils.getExtraRatingChangeData(ratingChanges);
    },

    getRatingChangeMetadata() {
        return {
            numChanges: RatingChanges.find().count(),
            numFirms: ResearchCompanies.find().count(),
        };
    },

    ratingChangesForSymbol(options) {
        check(options, {
            symbol: String,
            startDate: String,
            endDate: String,
        });
        const {symbol, startDate, endDate} =  options;
        console.log('calling ratingChangesForSymbol', options);

        let query = {
            symbol,
            $and: [
                {dateString: {$gte: startDate, $lte: endDate}},
            ],
        };
        if (!Permissions.isPremium()) {
            const lookback = Utils.getSetting('clientSettings.upcomingEarningsReleases.numberOfDaysBeforeTodayForRatingChangesPublicationIfNoUser');
            const noUserStartDate = moment().subtract(lookback, 'days').format(YYYY_MM_DD);

            query.$and.push({
                dateString: {$gte: noUserStartDate},
            });
        }

        return RatingChanges.find(query, {
            fields: {_id: 1, symbol: 1, date: 1, dateString: 1, oldRatingId: 1, newRatingId: 1, researchFirmId: 1},
            sort: {dateString: 1},
        }).fetch();
    },

    getPricesForSymbol: function (symbol) {
        check(symbol, String);
        var _prices = StocksReactServerUtils.prices.getAllPrices(symbol);
        return _prices;
    },

    getEarliestRatingChange: function (symbol) {
        check(symbol, String);

        const r = RatingChanges.findOne({symbol}, {sort: {dateString: 1}, fields: {dateString: 1}});
        return r?.dateString;
    },

    getUpcomingEarningsReleases(options) {
        check(options, {
            startDate: Number,
            endDate: Number,
            companyConfirmedOnly: Match.Maybe(Boolean),
            sortDirection: Match.Maybe(String),
            withRatingChangesCounts: Match.Maybe(Boolean),
            symbols: Match.Maybe([String]),
        });
        console.log('getUpcomingEarningsReleases', options);
        const {
            startDate,
            endDate,
            companyConfirmedOnly,
            sortDirection,
            withRatingChangesCounts,
            symbols,
        } = options;

        const query = {
            $and: [
                {
                    // make sure to only ever look forward
                    reportDateNextFiscalQuarter: {
                        $gte: +StocksReactUtils.getClosestPreviousWeekDayDateByCutoffTime(undefined, undefined, YYYYMMDD),
                    }
                },
                {
                    reportDateNextFiscalQuarter: {
                        $gte: startDate, $lte: endDate,
                    },
                },
                {
                    currencyCode: {$nin: ['CND']},
                },
                {
                    // exclude toronto
                    symbol: {$not: new RegExp('^T\\.')},
                },
            ],
            ...(companyConfirmedOnly ? {reportSourceFlag: 1} : {}),
        };

        if (!_.isEmpty(symbols)) {
            query.$and.push({
                symbol: {$in: symbols},
            });
        }

        const earningsReleases = EarningsReleases.find(
            query,
            {sort: {reportSourceFlag: 1, reportDateNextFiscalQuarter: 1, asOf: -1}}
        ).fetch();

        if (withRatingChangesCounts) {
            const symbols = _.uniq(_.pluck(earningsReleases, 'symbol'));

            const counts = Object.fromEntries(Promise.await(RatingChanges.rawCollection().aggregate([
                {$match: {symbol: {$in: symbols}}},
                {$group : {_id: '$symbol', count: {$sum: 1}}},
            ]).toArray()).map(({_id, count}) => [_id, count]));
            earningsReleases.forEach(e => {
                e.countRatingChanges = counts[e.symbol];
            });
        }

        const timeOfDayMap = {
            1: 'After market close',
            2: 'Before the open',
            3: 'During market trading',
            4: 'Unknown',
        };

        if (sortDirection === 'ascReportDate') {
            const sorted = _.sortBy(earningsReleases, (e) => {
                // see _convertQuandlZEAfieldName for more info
                return e.reportDateNextFiscalQuarter * 10 + (e.reportTimeOfDayCode === 2 ? 1 : e.reportTimeOfDayCode === 3 ? 2 : e.reportTimeOfDayCode === 1 ? 3 : 4 );
            });
            let currentTimePeriodIndex = -1;
            let lastFullDescription;
            sorted.forEach((e) => {
                const timeOfDay = timeOfDayMap[e.reportTimeOfDayCode];
                e.fullTimeOfDayDescription = `${e.reportDateNextFiscalQuarter}, ${timeOfDay}`;
                if (e.fullTimeOfDayDescription !== lastFullDescription) {
                    lastFullDescription = e.fullTimeOfDayDescription;
                    currentTimePeriodIndex += 1;
                }
                e.index = currentTimePeriodIndex;
            });
            return sorted;
        }

        return earningsReleases;
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
        check(symbol, String);
        check(maxRatingChangeDate, String);
        check(priceCheckDate, String);
        console.log('getRegressionPerformance', symbol, maxRatingChangeDate, priceCheckDate);

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
        var _availablePricesEnd = _.last(_pricesForRegr).dateString;
        if (_regrStart === _availablePricesStart && _regrEnd === _availablePricesEnd) {
            const ratingChanges = RatingChanges.find({symbol}).fetch();
            var _averageAnalystRatingSeries = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeries(symbol, _regrStart, _regrEnd, ratingChanges);
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
            if (_futurePrices[0].dateString !== _regrEnd || _.last(_futurePrices).dateString !== priceCheckDate) {
                throw new Meteor.Error("make sure there are prices for " + symbol + " from " + _regrEnd + " to " + priceCheckDate);
            }

            // step 7.1: project last item in _avgRatingsSeriesEveryDay to all future prices
            var _lastAvg = _.last(_avgRatingsSeriesEveryDay);

            // step 8.1: project last item in _weightedRatingsSeriesEveryDay to all future prices
            var _lastWgt = _.last(_weightedRatingsSeriesEveryDay);

            // figure out the same but if predictions were based on the entire date range (regr + future)
            // step 5*. get all prices
            var _regrAndFuturePrices = StocksReactUtils.stockPrices.getPricesBetween(_allPrices, _regrStart, priceCheckDate);
            console.log("length 2: ", _regrAndFuturePrices.length);

            // step 6*. make sure have all the needed prices
            if (_regrAndFuturePrices[0].dateString !== _regrStart || _.last(_regrAndFuturePrices).dateString !== priceCheckDate) {
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
                altAvg: _predictOnAvgRegrAndFut,
                altWgt: _predictOnWgtRegrAndFut,
                actualStart: _.first(_futurePrices),
                actualEnd: _.last(_futurePrices),
                earliestRatingChangeDate: _ratingChangesForRegr[0]?.dateString,
                latestRatingChangeDate: _.last(_ratingChangesForRegr)?.dateString,
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

    generatePrediction(options) {
        check(options, {
            symbol: String,
            startDate: Match.Maybe(String),
            endDate: String,
            priceReactionDelayDays: Match.Maybe(Number),
            showAvgRatings: Match.Maybe(Boolean),
            showWeightedRating: Match.Maybe(Boolean),
            pctDownPerDay: Match.Maybe(Number),
            pctUpPerDay: Match.Maybe(Number),
            stepSizePow: Match.Maybe(Number),
            regrIterNum: Match.Maybe(Number),
            pxRollingDays: Match.Maybe(Number),
        });

        let {
            symbol,
            startDate,
            endDate,
            priceReactionDelayDays = 0,
            showAvgRatings = true,
            showWeightedRating = true,
            pctDownPerDay = 0.5,
            pctUpPerDay = 0.5,
            stepSizePow = -7,
            regrIterNum = 30,
            pxRollingDays = 50,
        } = options;

        if (!Permissions.isPremium()) {
            throw new Meteor.Error('you do not have access');
        }

        const allStockPrices = Meteor.call('getPricesForSymbol', symbol);

        if (!startDate) {
            startDate = Meteor.call('getEarliestRatingChange', symbol);
        }

        const simpleRollingPx = StocksReactUtils.stockPrices.getSimpleRollingPx(
            allStockPrices,
            startDate,
            pxRollingDays
        );

        const pricesReady = allStockPrices?.[0].symbol === symbol;
        if (!pricesReady) {
            return {};
        }
        let _data = {};
        let _settings = Settings.findOne();
        if (!_settings || !startDate) {
            return {};
        }

        const rC = Meteor.call('ratingChangesForSymbol', {symbol, startDate, endDate});
        if (_.isEmpty(rC)) {
            throw new Meteor.Error(`there are no rating changes ${symbol} ${startDate} ${endDate}`);
        }

        var _pricesWithNoAdjClose = _.filter(allStockPrices, function (price) { return !price[ADJ_CLOSE];})
        if (_pricesWithNoAdjClose.length > 0) {
            console.log("ERROR, these price dates do not have adjClose: ", _.pluck(_pricesWithNoAdjClose, "dateString"));
        }

        const relevantPrices = StocksReactUtils.stockPrices.getPricesBetween(allStockPrices, startDate, endDate);
        let result = {
            symbol,
            historicalData: relevantPrices,
        };
        _data.stockPrices = relevantPrices;

        _data.stocksToGraphObjs = [];
        var _startDate = startDate;
        var _endDate = endDate;
        var _averageAnalystRatingSeries = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeries(symbol, _startDate, _endDate, rC);
        //TODO: start date and end date for regression are coming from a different date picker
        var _startDateForRegression = _startDate;
        var _endDateForRegression = _endDate;
        if (result && relevantPrices) {
            var _avgRatingsSeriesEveryDay = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeriesEveryDay(
                _averageAnalystRatingSeries,
                relevantPrices
            );
            var _weightedRatingsSeriesEveryDay = StocksReactUtils.ratingChanges.generateWeightedAnalystRatingsTimeSeriesEveryDay(
                _avgRatingsSeriesEveryDay,
                _startDateForRegression,
                _endDateForRegression,
                relevantPrices,
                priceReactionDelayDays,
                ADJ_CLOSE,
                pctDownPerDay,
                pctUpPerDay,
                Math.pow(10, stepSizePow),
                regrIterNum
            );
            _data.regrWeights = _weightedRatingsSeriesEveryDay.weights;
            _weightedRatingsSeriesEveryDay = _weightedRatingsSeriesEveryDay.ratings;
            var _predictionsBasedOnAvgRatings = StocksReactUtils.ratingChanges.predictionsBasedOnRatings(_.map(_avgRatingsSeriesEveryDay, function (obj) {
                return {date: obj.date, rating: obj.avg, dateString: obj.date.toISOString().substring(0,10)};
            }), relevantPrices, ADJ_CLOSE, simpleRollingPx, 0, 120, 60, pctDownPerDay, pctUpPerDay);
            var _predictionsBasedOnWeightedRatings = StocksReactUtils.ratingChanges.predictionsBasedOnRatings(_.map(_weightedRatingsSeriesEveryDay, function (obj) {
                return {date: obj.date, rating: obj.weightedRating, dateString: obj.date.toISOString().substring(0,10)};
            }), relevantPrices, ADJ_CLOSE, simpleRollingPx, 0, 120, 60, pctDownPerDay, pctUpPerDay);

            var _objToGraph = result;
            if (showAvgRatings && showWeightedRating) {
                _objToGraph = _.extend(_objToGraph, {
                    avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
                    weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay,
                    predictionsBasedOnWeightedRatings: _predictionsBasedOnWeightedRatings,
                    predictionsBasedOnAvgRatings: _predictionsBasedOnAvgRatings
                })
            } else if (showAvgRatings) {
                _objToGraph = _.extend(_objToGraph, {
                    avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
                    predictionsBasedOnAvgRatings: _predictionsBasedOnAvgRatings
                })
            } else if (showWeightedRating) {
                _objToGraph = _.extend(_objToGraph, {
                    weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay,
                    predictionsBasedOnWeightedRatings: _predictionsBasedOnWeightedRatings
                })
            }

            _data.stocksToGraphObjs = [JSON.parse(JSON.stringify(_objToGraph))];
        }

        const _allEarningsReleasesForSymbol = Meteor.call('getUpcomingEarningsReleases', {
            startDate: Utils.convertToNumberDate(startDate),
            endDate: Utils.convertToNumberDate(endDate),
            companyConfirmedOnly: true, symbols: [symbol],
        });

        _data.ratingChangesAndStockPricesSubscriptionsForSymbolReady = true;
        _data.ratingChanges = rC;
        _data.ratingScales = StocksReactUtils.ratingChanges.getRatingScalesForRatingChanges(rC);
        _data.earningsReleases = _allEarningsReleasesForSymbol;
        _data.allGraphData = _.extend(result, {
            avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
            weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay
        });

        return _data;
    },

    getEarningsAnalysis(options) {
        check(options, {
            startDate: String,
            endDate: String,
            saleDelayInDays: Match.Maybe(Number),
            ratingChangesDelayInDays: Match.Maybe(Number),
            ratingChangesLookbackInDays: Match.Maybe(Number),
        });

        if (!Permissions.isPremium()) {
            throw new Meteor.Error('you do not have access');
        }

        const {
            startDate,
            endDate,
            saleDelayInDays = 5,
            ratingChangesDelayInDays = 5,
            ratingChangesLookbackInDays = 750,
        } = options;

        const validRatingScaleIDsMap = ServerUtils.getNumericRatingScalesMap();

        const expectedReleasesQuery = {
            epsMeanEstimateNextFiscalQuarter: {$nin: [
                null,
            ]},
            reportDateNextFiscalQuarter: {
                $gte: Utils.convertToNumberDate(startDate),
                $lte: Utils.convertToNumberDate(endDate),
            },
            reportSourceFlag: 1,
            asOf: {$lte: endDate},

            currencyCode: {$nin: ['CND']},
        };

        // these are the expected earnings releases within the requested date range
        const expectedEarningsReleases = EarningsReleases.find(
            expectedReleasesQuery,
            {
                sort: {asOf: -1},
            }
        ).fetch();

        if (expectedEarningsReleases.length === 0) {
            return [];
        }

        console.log('expectedEarningsReleases', expectedEarningsReleases.length, expectedReleasesQuery);

        const expectedMap = new Map();
        const uniqueExpectedEarningsReleases = expectedEarningsReleases.filter(e => {
            const {
                symbol,
                asOf,
                reportDateNextFiscalQuarter,
            } = e;

            if (expectedMap.has(symbol)) {
                return false;
            }

            const asOfFormatted = Utils.convertToNumberDate(asOf);
            if (asOfFormatted < reportDateNextFiscalQuarter) {
                expectedMap.set(symbol, e);
                return true;
            }
        });

        const actualReleasesQuery = {
            $or: uniqueExpectedEarningsReleases.map(e => {
                const {
                    /**
                     * the endDateNextFiscalQuarter of the expected earnings release maps to the endDatePreviousFiscalQuarter
                     * of the actual release
                     */
                    endDateNextFiscalQuarter: endDatePreviousFiscalQuarter,
                    symbol,
                    /**
                     * the asOf date of the actual release should be after the expected release date
                     */
                    reportDateNextFiscalQuarter: minAsOfDate,
                } = e;

                return {
                    symbol,
                    endDatePreviousFiscalQuarter,
                    asOf: {$gt: Utils.convertToStringDate(minAsOfDate)},
                };
            }),
        };
        const actualEarningsReleases = EarningsReleases.find(
            actualReleasesQuery,
            {
                sort: {asOf: 1},
            }
        ).fetch();
        const actualMap = new Map();
        const uniqueActualEarningsReleases = actualEarningsReleases.filter(e => {
            const {
                symbol,
            } = e;
            if (actualMap.has(symbol)) {
                return;
            }
            actualMap.set(symbol, e);
            return true;
        });

        const expectedSymbols = _.pluck(uniqueExpectedEarningsReleases, 'symbol');
        const actualSymbols = _.pluck(uniqueActualEarningsReleases, 'symbol');
        console.log('cannot find a corresponding earnings release for expected: ', _.difference(expectedSymbols, actualSymbols));

        const results = [];

        uniqueActualEarningsReleases.forEach(e => {
            const {
                symbol,
            } = e;

            const expectedE = expectedMap.get(symbol);
            const actualE = actualMap.get(symbol);

            const expectedEps = expectedE.epsMeanEstimateNextFiscalQuarter;
            const actualEps = actualE.epsActualPreviousFiscalQuarter;

            const reportDate = expectedE.reportDateNextFiscalQuarter;
            const reportDateString = Utils.convertToStringDate(reportDate);

            const expectedAsOf = expectedE.asOf;
            const {
                reportTimeOfDayCode,
                timeOfDayDescription,
            } = expectedE;

            const isAfterMarketClose = reportTimeOfDayCode === 1;
            const purchaseDate = isAfterMarketClose ? reportDateString : momentBiz(reportDateString).businessAdd(-1).format(YYYY_MM_DD);
            const saleDate1 = isAfterMarketClose ? momentBiz(reportDateString).businessAdd(1).format(YYYY_MM_DD) : reportDateString;
            const saleDate2 = momentBiz(saleDate1).businessAdd(saleDelayInDays).format(YYYY_MM_DD);

            const prices = ServerUtils.prices.getAllPrices(symbol, purchaseDate, saleDate2);
            const purchasePrice = StocksReactUtils.stockPrices.getPricesBetween(prices, purchaseDate, purchaseDate)[0]?.adjClose;
            const salePrice1 = StocksReactUtils.stockPrices.getPricesBetween(prices, saleDate1, saleDate1)[0]?.adjClose;
            const salePrice2 = StocksReactUtils.stockPrices.getPricesBetween(prices, saleDate2, saleDate2)[0]?.adjClose;

            const ratingChangesCutoffDate = momentBiz(purchaseDate).businessAdd(-ratingChangesDelayInDays).format(YYYY_MM_DD);
            const ratingChangesEarliestDate = momentBiz(purchaseDate).businessAdd(-ratingChangesDelayInDays-ratingChangesLookbackInDays).format(YYYY_MM_DD);
            const ratingChanges = Promise.await(RatingChanges.rawCollection().aggregate([
                {$match: {
                    symbol,
                    dateString: {
                        $gte: ratingChangesEarliestDate,
                        $lte: ratingChangesCutoffDate,
                    }
                }},
                {$sort: {dateString: -1}},
                {$group: {
                    _id: '$researchFirmId',
                    oldRatingId: {$first: '$oldRatingId'},
                    newRatingId: {$first: '$newRatingId'},
                    dateString: {$first: '$dateString'},
                    researchFirmId: {$first: '$researchFirmId'},
                }},
            ]).toArray()).filter(rc => validRatingScaleIDsMap.has(rc.newRatingId));
            const ratings = ratingChanges.map(rc => validRatingScaleIDsMap.get(rc.newRatingId));
            const avgRating = _.reduce(ratings, (memo, num) => memo + num, 0) / ratings.length;

            const data = {
                symbol,
                expectedEps,
                actualEps,
                reportDate,
                expectedAsOf,
                timeOfDayDescription,

                purchaseDate,
                saleDate1,
                saleDate2,
                ratingChangesCutoffDate,
                avgRating,
                numRatings: ratings.length,

                purchasePrice,
                salePrice1,
                salePrice2,
            };
            results.push(data);
        });

        return results;
    },

    portfolioItems: function (portfolioIds, startStr, endStr) {
        check(portfolioIds, [String]);
        check(startStr, String);
        check(endStr, String);

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
        check(portfolioId, String);

        var _p = Portfolios.findOne({_id: portfolioId});
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

    insertNewRollingPortfolioItem: function (obj) {
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
});

Meteor.methods({

    registerRealAccountFromDummy: function(newUsername, newPassword) {
        check(newUsername, String);
        check(newPassword, String);

        var dummyUserId = Meteor.userId();
        Accounts.setUsername(dummyUserId, newUsername);
        Accounts.setPassword(dummyUserId, newPassword);
        Meteor.users.update({_id: dummyUserId}, {$set: {registered: true}});
        return {username: newUsername, password: newPassword};
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

    getSimilarSymbols(symbol) {
        check(symbol, String);

        if (symbol.length < 1) return [];

        const symbols = Stocks.find({
            _id: {$regex: symbol.toUpperCase()},
        }, {
            fields: {_id: 1},
            limit: 25,
        }).fetch();
        return _.pluck(symbols, '_id');
    },

    checkIfSymbolExists: function (symbol) {
        check(symbol, String);

        var _wikiUrl = StocksReactServerUtils.prices.getWikiPricesQuandlUrl(false, [symbol]);
        var _nasdaqUrl = StocksReactServerUtils.prices.getNasdaqPricesQuandlUrl(symbol);
        var _zeaUrl = StocksReactServerUtils.earningsReleases.getZeaUrl(symbol);
        const newEarningsReleaseUrl =  StocksReactServerUtils.earningsReleases.getEarningsReleasesUrl(symbol);

        function checkDatatable(url) {
            try {
                var _res = HTTP.get(url);
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

        return checkDatatable(_wikiUrl) || _checkNasdaq() || _checkZEA() || checkDatatable(newEarningsReleaseUrl);
    },

    insertNewStockSymbols: function(symbolsArray) {
        check(symbolsArray, [String]);

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
