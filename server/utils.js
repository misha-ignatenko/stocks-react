/**
 * Created by mykhayloignatenko on 4/2/18.
 */
import moment from 'moment-timezone';
import _ from 'underscore';
import { EJSON } from 'meteor/ejson';
const momentBiz = require('moment-business-days');
const { convertArrayToCSV } = require('convert-array-to-csv');

ServerUtils = {

    setSetting(field, value) {
        return Settings.update(Utils.getSetting('_id'), {$set: {
            [field]: value,
        }});
    },

    setEarningsReleaseSyncDate(dateString) {
        return this.setSetting(
            'serverSettings.quandl.dateOfLastPullFromQuandl',
            dateString
        );
    },

    getEmailTo() {
        return Utils.getSetting('serverSettings.ratingsChanges.emailTo');
    },
    getEmailFrom() {
        return Utils.getSetting('serverSettings.ratingsChanges.emailFrom');
    },
    emailCSV(rows, fileName = 'sample.csv', subject = 'csv file', text = 'see attached') {
        const csv = convertArrayToCSV(rows);

        Email.send({
            subject,
            text,
            attachments: [
                {
                    filename: fileName,
                    content: csv,
                },
            ],
        });
    },
    emailJSON(data, fileName = 'sample.json', subject = 'json file', text = 'see attached') {
        const json = JSON.stringify(data);

        Email.send({
            subject,
            text,
            attachments: [
                {
                    filename: fileName,
                    content: json,
                },
            ],
        });
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
    getLatestRatings(symbol, startDate, endDate, validRatingScaleIDsMap=ServerUtils.getNumericRatingScalesMap()) {
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
    getAltAdjustedRatings(ratingChanges, prices, purchaseDate) {
        /**
         * this factor means if a stock has the max possible rating, it's expected
         * to increase its price by this factor
         */
        const factor = 2;
        const priceOnPurchaseDay = Utils.stockPrices.getPriceOnDay(prices, purchaseDate);
        const ratingScales = ServerUtils.getNumericRatingScalesMap();
        const midpoint = Utils.constantFeatureValue;

        return ratingChanges.map(r => {
            const {
                dateString: ratingChangeDate,
                newRatingId,
            } = r;
            const priceOnRatingChangeDay = Utils.stockPrices.getPriceOnDay(prices, ratingChangeDate);
            const priceIncreaseRatio = priceOnPurchaseDay / priceOnRatingChangeDay;
            const progressRatio = (priceIncreaseRatio - 1) / (factor - 1);
            const currentRating = ratingScales.get(newRatingId);
            const adjRating = midpoint + (1 - progressRatio) * (currentRating - midpoint);

            return adjRating;
        });
    },

    cachedRatingScales: undefined,
    getNumericRatingScalesMap() {
        if (!this.cachedRatingScales) {
            this.cachedRatingScales = this.getNumericRatingScalesMapNonCached();
            Meteor.setTimeout(() => {
                this.cachedRatingScales = undefined;
            }, 10 * 60 * 1000); // 10 min
        }
        return this.cachedRatingScales;
    },
    getNumericRatingScalesMapNonCached() {
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

    apiKeyCached: undefined,
    apiKey: function () {
        if (!this.apiKeyCached) {
            this.apiKeyCached = this.getApiKeyNonCached();

            Meteor.setTimeout(() => {
                delete this.apiKeyCached;
            }, 3 * 60 * 1000); // 3 min
        }
        return this.apiKeyCached;
    },
    getApiKeyNonCached() {
        return Utils.getSetting('dataImports.earningsReleases.quandlZeaAuthToken');
    },

    earningsReleasesUrl: 'https://data.nasdaq.com/api/v3/datatables/ZACKS/EA',
    mtUrl: 'https://data.nasdaq.com/api/v3/datatables/ZACKS/MT',
    pricesUrl: 'https://data.nasdaq.com/api/v3/datatables/QUOTEMEDIA/PRICES',
    tickersUrl: 'https://data.nasdaq.com/api/v3/datatables/QUOTEMEDIA/TICKERS',

    prices: {

        getPricesUrl(symbol) {
            return `${ServerUtils.pricesUrl}?ticker=${symbol}&api_key=${ServerUtils.apiKey()}`;
        },
        getTickersUrl(symbol) {
            return `${ServerUtils.tickersUrl}?ticker=${symbol}&api_key=${ServerUtils.apiKey()}`;
        },

        getFormattedPriceObj(item, columnDefinitions) {
            const priceObj = {};
            columnDefinitions.forEach((columnDefObj, columnDefItemIndex) => {
                priceObj[columnDefObj['name']] = item[columnDefItemIndex];
            });

            if (priceObj.adj_close < 0 || priceObj.close < 0) {
                console.log('negative close', priceObj);
            }

            return _.extend(_.pick(priceObj, [
                'open',
                'high',
                'low',
                'close',
                'volume',
                'dividend',
                'split',
            ]), {
                symbol: priceObj.ticker,
                date: new Date(priceObj.date + 'T00:00:00.000+0000'),
                dateString: priceObj.date,

                adjOpen: priceObj.adj_open,
                adjHigh: priceObj.adj_high,
                adjLow: priceObj.adj_low,
                adjClose: Math.abs(priceObj.adj_close),
                adjVolume: priceObj.adj_volume,

                source: 'nasdaq_eod',
            });
        },

        adjustmentsCache: {},
        clearAdjustmentsCache() {
            this.adjustmentsCache = {};
        },
        getAllAdjustments(symbol) {
            if (!_.has(this.adjustmentsCache, symbol)) {
                this.adjustmentsCache[symbol] = this.getAllAdjustmentsNonCached(symbol);
                Meteor.setTimeout(() => {
                    delete this.adjustmentsCache[symbol];
                }, 10 * 60 * 1000); // 10 min
            }
            return this.adjustmentsCache[symbol];
        },
        getAllAdjustmentsNonCached(symbol) {
            const hasSplits = ServerUtils.earningsReleases.hasSplits(symbol);
            if (hasSplits) {
                const {splitDate} = hasSplits;
                const adjustments = ServerUtils.prices.getAllPrices(symbol, undefined, splitDate).filter(p => p.hasAdjustment);
                return adjustments;
            }

            return [];
        },

        pricesCache: {},
        pricesCacheMap: new Map(),
        getAllPrices(symbol, getMap = false) {
            if (!_.has(this.pricesCache, symbol)) {
                const pricesForSymbol = this.getAllPricesNonCached(symbol);
                this.pricesCache[symbol] = pricesForSymbol;

                this.pricesCacheMap.set(symbol, new Map());
                pricesForSymbol.forEach(priceObj => {
                    const dateString = priceObj.dateString;
                    if (this.pricesCacheMap.get(symbol).has(dateString)) {
                        console.log('already has price for date', symbol, dateString);
                    }
                    this.pricesCacheMap.get(symbol).set(dateString, priceObj);
                });

                Meteor.setTimeout(() => {
                    delete this.pricesCache[symbol];
                    this.pricesCacheMap.delete(symbol);
                }, 3 * 60 * 1000); // 3 min
            }
            if (getMap) {
                return this.pricesCacheMap.get(symbol);
            }
            return this.pricesCache[symbol];
        },
        getAllPricesNonCached(symbol) {
            const prices = [];
            const url = ServerUtils.prices.getPricesUrl(symbol);
            console.log("inside getPricesForSymbol: ", symbol);

            try {
                const result = HTTP.get(url);

                const datatable = result.data.datatable;
                const columns = datatable.columns;
                const data = datatable.data;

                data.forEach(px => {
                    const formatted = ServerUtils.prices.getFormattedPriceObj(px, columns);

                    if (!Utils.isBusinessDay(formatted.dateString)) {
                        console.log('is not a business day', formatted);
                        return;
                    }

                    prices.push(formatted);
                });

            } catch (error) {
                console.log('getAllPricesNonCached error', symbol, error);
            }

            return prices;
        },
        getPriceOnDayNew({
            symbol,
            dateString,
            returnObj = false,
            priceField = 'adjClose',
            isStrict = true,
        }) {
            const symbolPricesMap = this.getAllPrices(symbol, true);
            const priceObj = symbolPricesMap.get(dateString);
            if (returnObj) {
                return priceObj;
            } else if (isStrict) {
                return priceObj[priceField];
            } else {
                return priceObj?.[priceField];
            }
        },
    },
    ratingChanges: {
        isUpgrade(rc) {
            const {
                oldRatingId,
                newRatingId,
            } = rc;

            const map = ServerUtils.getNumericRatingScalesMap();
            if (map.has(oldRatingId) && map.has(newRatingId)) {
                return map.get(newRatingId) > map.get(oldRatingId);
            } else if (map.has(newRatingId)) {
                return map.get(newRatingId) > 60;
            }
        },
        isDowngrade(rc) {
            const {
                oldRatingId,
                newRatingId,
            } = rc;

            const map = ServerUtils.getNumericRatingScalesMap();
            if (map.has(oldRatingId) && map.has(newRatingId)) {
                return map.get(newRatingId) < map.get(oldRatingId);
            } else if (map.has(newRatingId)) {
                return map.get(newRatingId) < 60;
            }
        },
        getOldAndNewRatings(rc) {
            const {
                oldRatingId,
                newRatingId,
            } = rc;

            const map = ServerUtils.getNumericRatingScalesMap();
            return {
                oldRating: map.get(oldRatingId),
                newRating: map.get(newRatingId),
            };
        },
    },
    earningsReleases: {
        getHistory(symbol, startDateStr, endDateStr, returnOnlyReportDates=false, returnObjects=false) {
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

            if (returnObjects) {
                const deduplicationSet = new Set();

                return EarningsReleases.find(query, {
                    fields: {
                        reportDateNextFiscalQuarter: 1,
                        endDateNextFiscalQuarter: 1,
                    },
                    sort: {
                        reportDateNextFiscalQuarter: 1,
                    },
                }).fetch().filter(e => {
                    const stringified = EJSON.stringify(_.pick(e, [
                        'reportDateNextFiscalQuarter',
                        'endDateNextFiscalQuarter',
                    ]));

                    if (deduplicationSet.has(stringified)) {
                        return false;
                    }

                    deduplicationSet.add(stringified);
                    return true;
                });
            }

            const relevantReportDates = _.sortBy(
                Promise.await(EarningsReleases.rawCollection().distinct('reportDateNextFiscalQuarter', query)),
                _.identity
            );

            // may return incorrect dates
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
        getAllEarningsReleasesUrl: (cursorID) => {
            const cursorPostfix = cursorID ? `&qopts.cursor_id=${cursorID}` : '';
            return `${ServerUtils.earningsReleasesUrl}?api_key=${ServerUtils.apiKey()}${cursorPostfix}`;
        },
        getEarningsReleasesUrl: (symbol) => {
            return `${ServerUtils.earningsReleasesUrl}?ticker=${symbol}&api_key=${ServerUtils.apiKey()}`;
        },
        getMetadataUrl(symbol) {
            return `${ServerUtils.mtUrl}?ticker=${symbol}&api_key=${ServerUtils.apiKey()}`;
        },
        hasSplits(symbol) {
            const url = ServerUtils.earningsReleases.getMetadataUrl(symbol);
            console.log('calling hasSplits', symbol);
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
        getAdjustedEps(rawData, adjustments, reportDate, fields) {
            const relevantAdj = adjustments.filter(adj => {
                const {
                    adjType,
                    dateString: adjDate,
                } = adj;

                if (![
                    5,
                    6,
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
        processRowsForCSV(rows) {
            return rows.map(row => {
                const {
                    reportDate,
                    isAfterMarketClose,
                    endDateNextFiscalQuarter,
                    symbol,
                    companyName,
                    originalEpsExpectation,
                    pctExpEpsOverOriginalEpsExpectation,
                    originalAsOfExpectation,
                    expectedEps,
                    actualEps,
                    expectedEpsNextQt,
                    purchaseDate: dateBeforeRelease,
                    purchasePrice: priceBeforeRelease,
                    purchasePriceSMA50,
                    purchasePriceSMA200,
                    saleDate1: dateAfterRelease,
                    salePrice1: priceAfterRelease,
                    saleDate2: dateLater,
                    salePrice2: priceLater,
                    saleDate3: dateLatest,
                    salePrice3: priceLatest,
                    priorSaleDate,
                    priorSalePrice,
                    priorSalePriceSMA50,
                    priorSalePriceSMA200,
                    avgRating,
                    numRatings,
                    numRecentDowngrades,
                    numRecentUpgrades,
                    averageRatingChangeDate,
                    altAvgRatingWithAdjRatings,

                    epsActualPreviousFiscalQuarter,
                    pctExpEpsOverPrevQt,
                    epsActualOneYearAgoFiscalQuarter,
                    pctExpEpsOverOneYearAgo,

                    vooOpenPriceOnPurchaseDate,
                    vooSMA,
                    vooSMA50DaysAgo,
                    vooSMA200DaysAgo,
                } = row;

                return {
                    'Release Date': Utils.convertToStringDate(reportDate),
                    'Is After Mkt Close': isAfterMarketClose ? 'Yes' : 'No',
                    'Qt': Utils.convertToStringDate(endDateNextFiscalQuarter),
                    'Symbol': symbol,
                    'Co Name': companyName,
                    'Average Rating (0-120)': _.isNaN(avgRating) ? null : avgRating.toFixed(2),
                    '# of Ratings': numRatings,
                    'Avg R. Ch. Date': averageRatingChangeDate,
                    'Alt R (adj r)': _.isNaN(altAvgRatingWithAdjRatings) ? null : altAvgRatingWithAdjRatings.toFixed(2),
                    '# Recent Downgr': numRecentDowngrades,
                    '# Recent Upgr': numRecentUpgrades,
                    '1st Eps Exp': originalEpsExpectation?.toFixed(4),
                    '% Exp / 1st Exp': pctExpEpsOverOriginalEpsExpectation?.toFixed(4),
                    '1st Eps Exp Date': originalAsOfExpectation,
                    'Prior Sale Date': priorSaleDate,
                    'Prior Sale Price': priorSalePrice,
                    'Prior SMA 50': priorSalePriceSMA50?.toFixed(2),
                    'Prior SMA 200': priorSalePriceSMA200?.toFixed(2),
                    'Exp EPS': expectedEps?.toFixed(4),
                    'Act EPS': actualEps?.toFixed(4),
                    'Exp EPS Next Qt': expectedEpsNextQt?.toFixed(4),
                    'Act EPS (prev qt)': epsActualPreviousFiscalQuarter?.toFixed(4),
                    'Exp / prev qt': undefined,
                    '% Exp / prev qt': _.isNumber(pctExpEpsOverPrevQt) ? pctExpEpsOverPrevQt.toFixed(4) : null,
                    'Act EPS (1 yr ago)': epsActualOneYearAgoFiscalQuarter?.toFixed(4),
                    'Exp / 1 yr': undefined,
                    '% Exp / 1 yr': _.isNumber(pctExpEpsOverOneYearAgo) ? pctExpEpsOverOneYearAgo.toFixed(4) : null,
                    'Price Before': priceBeforeRelease?.toFixed(2),
                    'Before SMA 50': purchasePriceSMA50?.toFixed(2),
                    'Before SMA 200': purchasePriceSMA200?.toFixed(2),
                    'Date Before': dateBeforeRelease,
                    'Price After': priceAfterRelease?.toFixed(2),
                    'After / Before': (priceAfterRelease / priceBeforeRelease).toFixed(4),
                    'Date After': dateAfterRelease,
                    'Price Later': priceLater?.toFixed(2),
                    'Later / Before': (priceLater / priceBeforeRelease).toFixed(4),
                    'Date Later': dateLater,
                    'Price Latest': priceLatest?.toFixed(2),
                    'Latest / Before': (priceLatest / priceBeforeRelease).toFixed(4),
                    'Date Latest': dateLatest,
                    'vooOpenPriceOnPurchaseDate': vooOpenPriceOnPurchaseDate?.toFixed(4),
                    'vooSMA': vooSMA?.toFixed(4),
                    'vooSMA50DaysAgo': vooSMA50DaysAgo?.toFixed(4),
                    'vooSMA200DaysAgo': vooSMA200DaysAgo?.toFixed(4),
                };
            });
        },
    },
    runPremiumCheck(context) {
        if (!context) {
            throw new Meteor.Error('something is not right');
        }
        if (context.connection && !Permissions.isPremium()) {
            throw new Meteor.Error('you do not have access');
        }
    },
};
