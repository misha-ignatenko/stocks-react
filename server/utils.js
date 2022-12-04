/**
 * Created by mykhayloignatenko on 4/2/18.
 */
import moment from 'moment-timezone';
import _ from 'underscore';
import { EJSON } from 'meteor/ejson';

StocksReactServerUtils = {

    getEmailTo() {
        return Utils.getSetting('serverSettings.ratingsChanges.emailTo');
    },
    getEmailFrom() {
        return Utils.getSetting('serverSettings.ratingsChanges.emailFrom');
    },

    ratingsChangesLimitGlobal() {
        return Utils.getSetting('serverSettings.ratingsChanges.dashboardLimitGlobal');
    },
    ratingsChangesLimitSymbol() {
        return Utils.getSetting('serverSettings.ratingsChanges.dashboardLimitSymbol');
    },
    getExtraRatingChangeData(ratingChanges) {
        let firmMap = new Map();
        const firmIDs = _.pluck(ratingChanges, 'researchFirmId');
        ResearchCompanies.find({
            _id: {$in: firmIDs},
        }, {
            fields: {
                name: 1,
            },
        }).forEach(company => {
            firmMap.set(company._id, company);
        });

        let ratingMap = new Map();
        const oldRatingIDs = _.pluck(ratingChanges, 'oldRatingId');
        const newRatingIDs = _.pluck(ratingChanges, 'newRatingId');
        const ratingIDs = _.union(oldRatingIDs, newRatingIDs);
        RatingScales.find({
            _id: {$in: ratingIDs},
        }, {
            fields: {
                firmRatingFullString: 1,
            },
        }).forEach(rating => {
            ratingMap.set(rating._id, rating);
        });

        ratingChanges.forEach(ratingChange => {
            ratingChange.researchFirmName = firmMap.get(ratingChange.researchFirmId).name;

            ratingChange.oldRating = ratingMap.get(ratingChange.oldRatingId).firmRatingFullString;
            ratingChange.newRating = ratingMap.get(ratingChange.newRatingId).firmRatingFullString;
        });

        return ratingChanges.map(ratingChange => {
            return _.pick(ratingChange, [
                'symbol',
                'researchFirmName',
                'oldRating',
                'newRating',
                'dateString',
            ]);
        });
    },
    getLatestRatings(symbol, startDate, endDate, validRatingScaleIDsMap) {
        const dateString = {
            $gte: startDate,
        };
        if (endDate) {
            dateString.$lte = endDate;
        }
        const $match = {
            symbol,
            dateString,
        };
        const ratingChanges = Promise.await(RatingChanges.rawCollection().aggregate([
            {$match},
            {$sort: {dateString: -1}},
            {$group: {
                _id: '$researchFirmId',
                oldRatingId: {$first: '$oldRatingId'},
                newRatingId: {$first: '$newRatingId'},
                dateString: {$first: '$dateString'},
                researchFirmId: {$first: '$researchFirmId'},
                ratingChangeId: {$first: '$_id'},
            }},
        ]).toArray()).filter(rc => validRatingScaleIDsMap.has(rc.newRatingId));

        return ratingChanges;
    },

    cachedRatingScales: undefined,
    getNumericRatingScalesMapCached() {
        if (!this.cachedRatingScales) {
            this.cachedRatingScales = this.getNumericRatingScalesMap();
            Meteor.setTimeout(() => {
                this.cachedRatingScales = undefined;
            }, 10 * 60 * 1000); // 10 min
        }
        return this.cachedRatingScales;
    },
    getNumericRatingScalesMap() {
        const validRatingScaleIDsMap = new Map();
        RatingScales.find(
            {universalScaleValue: {
                $not: {$type: 2},
                $exists: true,
            }},
            {fields: {universalScaleValue: 1}}
        ).forEach(({_id, universalScaleValue}) => {
            validRatingScaleIDsMap.set(_id, universalScaleValue);
        });
        return validRatingScaleIDsMap;
    },

    apiKey: function () {
        return Utils.getSetting('dataImports.earningsReleases.quandlZeaAuthToken');
    },
    newEarningsReleaseBaseUrl: 'https://data.nasdaq.com/api/v3/datatables/ZACKS/EA',
    mtUrl: 'https://data.nasdaq.com/api/v3/datatables/ZACKS/MT',

    prices: {

        // FREE
        getWikiPricesQuandlUrl: function (dateStrYYYY_MM_DD, optionalSymbolsArr) {
            var _quandlFreeBaseUrl = "https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json";
            var _apiKey = StocksReactServerUtils.apiKey();
            if (dateStrYYYY_MM_DD && optionalSymbolsArr) {
                var _url = _quandlFreeBaseUrl + "?date=" +
                    (typeof dateStrYYYY_MM_DD === "string" ? dateStrYYYY_MM_DD : dateStrYYYY_MM_DD.join()).replace(/-/g, '') + "&ticker=" + optionalSymbolsArr.join() + "&api_key=" +
                    _apiKey;
            } else if (dateStrYYYY_MM_DD && !optionalSymbolsArr) {
                var _url = _quandlFreeBaseUrl + "?date=" +
                    dateStrYYYY_MM_DD.replace(/-/g, '') + "&api_key=" +
                    _apiKey;
            } else if (!dateStrYYYY_MM_DD && optionalSymbolsArr) {
                var _url = _quandlFreeBaseUrl + "?" +
                    "date.gte=2014-01-01&" +
                    "ticker=" + optionalSymbolsArr.join() + "&api_key=" +
                    _apiKey;
            }

            return _url;
        },

        // PAID
        getNasdaqPricesQuandlUrl: function (symbol, startDate, endDate) {
            var _url = "https://www.quandl.com/api/v3/datasets/XNAS/" + symbol + ".json?" +
                (startDate ? ("start_date=" + startDate + "&") : "") +
                (endDate ? ("end_date=" + endDate + "&") : "") +
                "api_key=" + StocksReactServerUtils.apiKey();

            return _url;
        },

        getFormattedPriceObjWiki: function (item, _columnDefs) {
            var _priceObj = {};
            _.each(_columnDefs, function (columnDefObj, columnDefItemIndex) {
                var _val = item[columnDefItemIndex];
                _priceObj[columnDefObj["name"]] = _val;
            })

            var _formattedPriceObj = {
                "date": new Date(_priceObj.date + "T00:00:00.000+0000"),
                "open": _priceObj.open,
                "high": _priceObj.high,
                "low": _priceObj.low,
                "close": _priceObj.close,
                "volume": _priceObj.volume,
                "exDividend": _priceObj["ex-dividend"],
                splitRatio: _priceObj.split_ratio,
                adjOpen: _priceObj.adj_open,
                adjHigh: _priceObj.adj_high,
                adjLow: _priceObj.adj_low,
                "adjClose": _priceObj.adj_close,
                adjVolume: _priceObj.adj_volume,
                "symbol": _priceObj.ticker,
                "dateString": _priceObj.date,
                source: "quandl_free",
            };

            return _formattedPriceObj;
        },

        getFormattedPriceObjNasdaq: function (_columnNames, obj, symbol) {
            var _processedItem = {};
            _.each(_columnNames, function (colName, colNameIdx) {
                _processedItem[colName] = obj[colNameIdx];
            });

            var _convertedObj = {
                "date": new Date(_processedItem.Date + "T00:00:00.000+0000"),
                "open": _processedItem.Open,
                "high": _processedItem.High,
                "low": _processedItem.Low,
                "close": _processedItem.Close,
                "volume": _processedItem.Volume,
                "symbol": symbol,
                "dateString": _processedItem.Date,
                source: "quandl_paid",


                adjFactor: _processedItem.Adjustment_Factor,
                adjType: _processedItem.Adjustment_Type
            };

            // 17 = dividend
            if (!_convertedObj.adjFactor || _convertedObj.adjType === 17) {
                _convertedObj.adjClose = _convertedObj.close;
            } else {
                console.log('ADJUSTMENT: ', symbol, _processedItem);
                _convertedObj.hasAdjustment = true;
            }

            return _convertedObj;
        },


        cache: {},
        getAllPricesCached(symbol) {
            if (!_.has(this.cache, symbol)) {
                this.cache[symbol] = this.getAllPrices(symbol);
                Meteor.setTimeout(() => {
                    delete this.cache[symbol];
                }, 10 * 60 * 1000); // 10 min
            }
            return this.cache[symbol];
        },
        getAllPrices: function (symbol, optionalStartDate, optionalEndDate) {
            console.log("inside getPricesForSymbol: ", symbol);
            var _prices = [];

            // try Nasdaq first
            var _nasdaqUrl = StocksReactServerUtils.prices.getNasdaqPricesQuandlUrl(symbol, optionalStartDate, optionalEndDate);
            try {
                var _res = HTTP.get(_nasdaqUrl);
                var _dataset = _res.data.dataset;
                var _unprocessedPrices = _dataset.data;
                var _columnNames = _.map(_dataset.column_names, function (rawColName) {
                    return rawColName.replace(/ /g, "_");
                });

                _.each(_unprocessedPrices, function (obj, idx) {
                    // check that all column names are present
                    if (_columnNames.length === obj.length && _columnNames.length === 8) {
                        var _convertedObj = StocksReactServerUtils.prices.getFormattedPriceObjNasdaq(_columnNames, obj, symbol);
                        _prices.push({
                            symbol: _convertedObj.symbol,
                            dateString: _convertedObj.dateString,
                            adjClose: _convertedObj.close,
                            date: _convertedObj.date,

                            hasAdjustment: _convertedObj.hasAdjustment,
                            adjFactor: _convertedObj.adjFactor,
                            adjType: _convertedObj.adjType,
                        });
                    } else {
                        throw new Meteor.Error("missing keys for NASDAQ data import: ", symbol);
                    }
                })

            } catch (e) {
                console.log("ERROR: ", symbol, e);
            }

            if (_prices.length === 0) {
                var _wikiUrl = StocksReactServerUtils.prices.getWikiPricesQuandlUrl(false, [symbol]);
                try {
                    var _res = HTTP.get(_wikiUrl);
                    var _datatable = _res.data.datatable;
                    _.each(_datatable.data, function (px) {
                        var _formatted = StocksReactServerUtils.prices.getFormattedPriceObjWiki(px, _datatable.columns);
                        _prices.push({symbol: _formatted.symbol, dateString: _formatted.dateString, adjClose: _formatted.adjClose, date: _formatted.date});
                    })

                } catch (e) {
                    console.log("ERROR: ", symbol, e);
                }
            }

            return _prices;
        },
    },
    earningsReleases: {
        getHistory(symbol, startDateStr, endDateStr, returnOnlyReportDates=false) {
            const validRecordsQuery = {
                symbol,
                currencyCode: {$nin: ['CND']},
                exchange: {$nin: [
                    'NASDAQ Other OTC',
                ]},
            };
            const companyConfirmedQuery = {
                reportSourceFlag: 1,
            };

            const query = _.extend({
                reportDateNextFiscalQuarter: {
                    $gte: Utils.convertToNumberDate(startDateStr),
                    $lte: Utils.convertToNumberDate(endDateStr),
                },
            }, validRecordsQuery, companyConfirmedQuery);

            const relevantReportDates = _.sortBy(
                Promise.await(EarningsReleases.rawCollection().distinct('reportDateNextFiscalQuarter', query)),
                _.identity
            );

            if (returnOnlyReportDates) {
                return relevantReportDates;
            }

            const earningsReleases = relevantReportDates.map(reportDate => {

                const expectedQuery = _.extend({
                    reportDateNextFiscalQuarter: reportDate,
                    asOf: {$lt: Utils.convertToStringDate(reportDate)},
                }, validRecordsQuery, companyConfirmedQuery);
                const expected = EarningsReleases.findOne(expectedQuery, {sort: {asOf: -1}});

                const expectationCoversEarningsThru = expected.endDateNextFiscalQuarter;

                const actualQuery = _.extend({
                    endDatePreviousFiscalQuarter: expectationCoversEarningsThru,
                    asOf: {$gt: Utils.convertToStringDate(reportDate)},
                }, validRecordsQuery);
                const actual = EarningsReleases.findOne(actualQuery, {sort: {asOf: 1}});

                const expectedEps = expected.epsMeanEstimateNextFiscalQuarter;
                const actualEps = actual.epsActualPreviousFiscalQuarter;
                const expectationAfterRelease = actual.epsMeanEstimateNextFiscalQuarter;

                console.log('--------------------------------------');
                console.log('earnings released on', reportDate);
                console.log('quarter end date', expectationCoversEarningsThru);
                console.log('expectation known on', expected.asOf);
                console.log('actual known on', actual.asOf);
                console.log('expected vs. actual eps', expectedEps, actualEps);
                console.log('expectation for the next quarter (after release)', expectationAfterRelease);
                console.log('expected & actual _ids', expected._id, actual._id);
                console.log('--------------------------------------');
            });
        },
        getAllEarningsReleasesUrl: () => {
            const key = StocksReactServerUtils.apiKey();
            const url = `${StocksReactServerUtils.newEarningsReleaseBaseUrl}?api_key=${key}`;
            return url;
        },
        getEarningsReleasesUrl: (symbol) => {
            const key = StocksReactServerUtils.apiKey();
            const url = `${StocksReactServerUtils.newEarningsReleaseBaseUrl}?ticker=${symbol}&api_key=${key}`;
            return url;
        },
        getMetadataUrl(symbol) {
            return `${StocksReactServerUtils.mtUrl}?ticker=${symbol}&api_key=${ServerUtils.apiKey()}`;
        },
        hasSplits(symbol) {
            const url = ServerUtils.earningsReleases.getMetadataUrl(symbol);
            const response = HTTP.get(url);
            const {
                columns,
                data,
            } = response.data.datatable;

            const firstRow = data[0];
            if (!firstRow) {
                console.log('cannot check if has splits ' + symbol);
                return false;
            }
            if (columns.length !== firstRow.length) {
                throw new Meteor.Error('mismatch between data and columns ' + symbol);
            }
            const splitDateIndex = _.findIndex(columns, column => column.name === 'mr_split_date');
            const splitFactorIndex = _.findIndex(columns, column => column.name === 'mr_split_factor');
            if (splitDateIndex === -1 || splitFactorIndex === -1) {
                throw new Meteor.Error('cannot find index for splits ' + symbol);
            }
            const splitDate = firstRow[splitDateIndex];
            const splitFactor = firstRow[splitFactorIndex];

            const doesNotHaveSplits = _.isNull(splitDate) && _.isNull(splitFactor);
            if (doesNotHaveSplits) {
                return false;
            }

            return {
                splitDate,
                splitFactor,
            };
        },
        getZeaUrl: function (symbol) {
            var _url = "https://www.quandl.com/api/v3/datasets/ZEA/" + symbol + ".json?auth_token=" + StocksReactServerUtils.apiKey();
            return _url;
        },
        getAdjustedEps(rawData, adjustments, reportDate, fields) {
            const relevantAdj = adjustments.filter(adj => {
                const {
                    adjType,
                    dateString: adjDate,
                } = adj;

                if (![
                    5,
                    13,
                ].includes(adjType)) {
                    console.log('weird adj', adj);
                }

                // need to adjust old eps measurements, prior to adj date
                return reportDate < adjDate;
            });
            if (relevantAdj.length === 0) {
                return rawData;
            }

            const totalAdjFactor = _.reduce(
                _.pluck(relevantAdj, 'adjFactor'),
                (memo, num) => memo * num,
                1
            );

            const adjustedData = EJSON.clone(rawData);
            adjustedData.forEach(row => {
                fields.forEach(field => {
                    row[field] *= totalAdjFactor;
                });
            });

            return adjustedData;
        },
    }
};

ServerUtils = StocksReactServerUtils;
