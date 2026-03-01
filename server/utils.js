import _ from 'underscore';
import { EJSON } from 'meteor/ejson';
const { convertArrayToCSV } = require('convert-array-to-csv');
import { Utils } from '../lib/utils';
import { Permissions } from '../lib/permissions';
import { ResearchCompanies, RatingScales, EarningsReleases, RatingChanges, Settings } from '../lib/collections';
import { Meteor } from 'meteor/meteor';
import { Email } from './email';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export const ServerUtils = {

    async setSetting(field, value) {
        return await Settings.updateAsync(await Utils.getSetting('_id'), {$set: {
            [field]: value,
        }});
    },

    async getEmailTo() {
        return await Utils.getCachedSetting('serverSettings.ratingsChanges.emailTo');
    },
    async getEmailFrom() {
        return await Utils.getCachedSetting('serverSettings.ratingsChanges.emailFrom');
    },
    async emailCSV(rows, fileName = 'sample.csv', subject = 'csv file', text = 'see attached') {
        const csv = convertArrayToCSV(rows);

        await Email.send({
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
    async emailJSON(data, fileName = 'sample.json', subject = 'json file', text = 'see attached') {
        const json = JSON.stringify(data);

        await Email.send({
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

    async ratingsChangesLimitGlobal() {
        return await Utils.getCachedSetting('serverSettings.ratingsChanges.dashboardLimitGlobal');
    },
    async ratingsChangesLimitSymbol() {
        return await Utils.getCachedSetting('serverSettings.ratingsChanges.dashboardLimitSymbol');
    },
    async getExtraRatingChangeData(ratingChanges) {
        let firmMap = new Map();
        const firmIDs = _.pluck(ratingChanges, 'researchFirmId');
        (await ResearchCompanies.find({
            _id: {$in: firmIDs},
        }, {
            fields: {
                name: 1,
            },
        }).fetchAsync()).forEach(company => {
            firmMap.set(company._id, company);
        });

        let ratingMap = new Map();
        const oldRatingIDs = _.pluck(ratingChanges, 'oldRatingId');
        const newRatingIDs = _.pluck(ratingChanges, 'newRatingId');
        const ratingIDs = _.union(oldRatingIDs, newRatingIDs);
        (await RatingScales.find({
            _id: {$in: ratingIDs},
        }, {
            fields: {
                firmRatingFullString: 1,
            },
        }).fetchAsync()).forEach(rating => {
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
    async getLatestRatings(symbol, startDate, endDate, validRatingScaleIDsMap) {
        if (!validRatingScaleIDsMap) {
            validRatingScaleIDsMap = await ServerUtils.getNumericRatingScalesMap();
        }
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
        const ratingChanges = (await RatingChanges.rawCollection().aggregate([
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
    async getAltAdjustedRatings(ratingChanges, prices, purchaseDate) {
        /**
         * this factor means if a stock has the max possible rating, it's expected
         * to increase its price by this factor
         */
        const factor = 2;
        const priceOnPurchaseDay = await Utils.stockPrices.getPriceOnDay(prices, purchaseDate);
        const ratingScales = await ServerUtils.getNumericRatingScalesMap();
        const midpoint = Utils.constantFeatureValue;

        const results = [];
        for (const r of ratingChanges) {
            const {
                dateString: ratingChangeDate,
                newRatingId,
            } = r;
            const priceOnRatingChangeDay = await Utils.stockPrices.getPriceOnDay(prices, ratingChangeDate);
            const priceIncreaseRatio = priceOnPurchaseDay / priceOnRatingChangeDay;
            const progressRatio = (priceIncreaseRatio - 1) / (factor - 1);
            const currentRating = ratingScales.get(newRatingId);
            const adjRating = midpoint + (1 - progressRatio) * (currentRating - midpoint);

            results.push(adjRating);
        }
        return results;
    },

    cachedRatingScales: undefined,
    async getNumericRatingScalesMap() {
        if (!this.cachedRatingScales) {
            this.cachedRatingScales = await this.getNumericRatingScalesMapNonCached();
            Meteor.setTimeout(() => {
                this.cachedRatingScales = undefined;
            }, 10 * 60 * 1000); // 10 min
        }
        return this.cachedRatingScales;
    },
    async getNumericRatingScalesMapNonCached() {
        const validRatingScaleIDsMap = new Map();
        (await RatingScales.find(
            {universalScaleValue: {
                $not: {$type: 2},
                $exists: true,
            }},
            {fields: {universalScaleValue: 1}}
        ).fetchAsync()).forEach(({_id, universalScaleValue}) => {
            validRatingScaleIDsMap.set(_id, universalScaleValue);
        });
        return validRatingScaleIDsMap;
    },

    maybePopulateDataFromContent(response) {
        if (!response.data && response.content) {
            response.data = EJSON.parse(response.content);
        }
    },

    apiKey: async function () {
        return await Utils.getCachedSetting('dataImports.earningsReleases.quandlZeaAuthToken');
    },

    earningsReleasesUrl: 'https://data.nasdaq.com/api/v3/datatables/ZACKS/EA',
    mtUrl: 'https://data.nasdaq.com/api/v3/datatables/ZACKS/MT',
    pricesUrl: 'https://data.nasdaq.com/api/v3/datatables/NDAQ/USEDHADJ',
    pricesUrlUnadj: 'https://data.nasdaq.com/api/v3/datatables/NDAQ/USEDH',

    prices: {

        async getPricesUrl(symbol, cursorID, isUnadj = false, date = null) {
            const cursorPostfix = cursorID ? `&qopts.cursor_id=${cursorID}` : '';
            const datePostfix = date ? `&date=${date}` : '';

            return `${isUnadj ? ServerUtils.pricesUrlUnadj : ServerUtils.pricesUrl}?symbol=${symbol}&api_key=${await ServerUtils.apiKey()}${cursorPostfix}${datePostfix}`;
        },

        getFormattedPriceObj(item, columnDefinitions) {
            const priceObj = {};
            columnDefinitions.forEach((columnDefObj, columnDefItemIndex) => {
                priceObj[columnDefObj['name']] = item[columnDefItemIndex];
            });

            if (priceObj.close_adj < 0 || priceObj.close < 0) {
                console.log('negative close', priceObj);
            }

            return _.extend(_.pick(priceObj, [
                'symbol',
                'symbol_new',
                'open',
                'high',
                'low',
                'close',
                'volume',
                'dividend',
                'split',
                'action',
                'value',
                'composite_figi',
                'share_class_figi',
            ]), {
                date: new Date(priceObj.date + 'T00:00:00.000+0000'),
                dateString: priceObj.date,

                adjOpen: priceObj.open_adj,
                adjHigh: priceObj.high_adj,
                adjLow: priceObj.low_adj,
                adjClose: Math.abs(priceObj.close_adj),
                adjVolume: priceObj.volume_adj,

                source: 'nasdaq_usedhadj',
            });
        },

        adjustmentsCache: {},
        clearAdjustmentsCache() {
            this.adjustmentsCache = {};
        },
        async getAllAdjustments(symbol) {
            if (!_.has(this.adjustmentsCache, symbol)) {
                this.adjustmentsCache[symbol] = await this.getAllAdjustmentsNonCached(symbol);
                Meteor.setTimeout(() => {
                    delete this.adjustmentsCache[symbol];
                }, 10 * 60 * 1000); // 10 min
            }
            return this.adjustmentsCache[symbol];
        },
        async getAllAdjustmentsNonCached(symbol) {
            const hasSplits = await ServerUtils.earningsReleases.hasSplits(symbol);
            if (hasSplits) {
                const {splitDate} = hasSplits;
                const adjustments = (await ServerUtils.prices.getAllPrices(symbol, undefined, splitDate)).filter(p => p.hasAdjustment);
                return adjustments;
            }

            return [];
        },

        pricesCache: {},
        pricesCacheMap: new Map(),
        async getAllPrices(symbol, getMap = false) {
            if (!_.has(this.pricesCache, symbol)) {
                const pricesForSymbol = await this.getAllPricesNonCached(symbol);
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
        async getAllPricesNonCached(symbol) {
            try {
                const result = await yahooFinance.chart(symbol, {
                    period1: '2000-01-01',
                    interval: '1d',
                });

                const prices = result.quotes
                    .filter(item => item.close != null)
                    .map(item => {
                        const dateString = item.date.toISOString().slice(0, 10);
                        const round = v => v != null ? Math.round(v * 100) / 100 : v;
                        const adjClose = round(item.adjclose ?? item.close);
                        const adjRatio = adjClose / item.close;
                        return {
                            symbol,
                            date: item.date,
                            dateString,
                            open: round(item.open),
                            high: round(item.high),
                            low: round(item.low),
                            close: round(item.close),
                            volume: item.volume,
                            adjOpen: round(item.open * adjRatio),
                            adjHigh: round(item.high * adjRatio),
                            adjLow: round(item.low * adjRatio),
                            adjClose,
                            adjVolume: item.volume,
                            source: 'yahoo_finance',
                        };
                    })
                    .filter(p => Utils.isBusinessDay(p.dateString));

                return _.sortBy(prices, 'dateString');
            } catch (error) {
                console.log('getAllPricesNonCached error', symbol, error);
                return [];
            }
        },
        async getAllPricesNonCachedOld(symbol, isUnadj = false) {
            const prices = [];
            console.log("inside getPricesForSymbol: ", symbol);

            try {
                let cursorID;

                do {
                    const url = await ServerUtils.prices.getPricesUrl(symbol, cursorID, isUnadj);
                    const response = await fetch(url);
                    const result = {data: await response.json()};
                    ServerUtils.maybePopulateDataFromContent(result);

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
                    cursorID = result.data.meta.next_cursor_id;
                } while (cursorID);

            } catch (error) {
                console.log('getAllPricesNonCached error', symbol, error);
            }

            return _.sortBy(prices, 'dateString');
        },
        async getPriceOnDayNew({
            symbol,
            dateString,
            returnObj = false,
            priceField = 'adjClose',
            isStrict = true,
        }) {
            const symbolPricesMap = await this.getAllPrices(symbol, true);
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
        async isUpgrade(rc) {
            const {
                oldRatingId,
                newRatingId,
            } = rc;

            const map = await ServerUtils.getNumericRatingScalesMap();
            if (map.has(oldRatingId) && map.has(newRatingId)) {
                return map.get(newRatingId) > map.get(oldRatingId);
            } else if (map.has(newRatingId)) {
                return map.get(newRatingId) > 60;
            }
        },
        async isDowngrade(rc) {
            const {
                oldRatingId,
                newRatingId,
            } = rc;

            const map = await ServerUtils.getNumericRatingScalesMap();
            if (map.has(oldRatingId) && map.has(newRatingId)) {
                return map.get(newRatingId) < map.get(oldRatingId);
            } else if (map.has(newRatingId)) {
                return map.get(newRatingId) < 60;
            }
        },
        async getOldAndNewRatings(rc) {
            const {
                oldRatingId,
                newRatingId,
            } = rc;

            const map = await ServerUtils.getNumericRatingScalesMap();
            return {
                oldRating: map.get(oldRatingId),
                newRating: map.get(newRatingId),
            };
        },
    },
    earningsReleases: {
        async getHistory(symbol, startDateStr, endDateStr, returnOnlyReportDates=false, returnObjects=false) {
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

                return (await EarningsReleases.find(query, {
                    fields: {
                        reportDateNextFiscalQuarter: 1,
                        endDateNextFiscalQuarter: 1,
                    },
                    sort: {
                        reportDateNextFiscalQuarter: 1,
                    },
                }).fetchAsync()).filter(e => {
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
                await EarningsReleases.rawCollection().distinct('reportDateNextFiscalQuarter', query),
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
        getAllEarningsReleasesUrl: async (cursorID) => {
            const cursorPostfix = cursorID ? `&qopts.cursor_id=${cursorID}` : '';
            return `${ServerUtils.earningsReleasesUrl}?api_key=${await ServerUtils.apiKey()}${cursorPostfix}`;
        },
        getEarningsReleasesUrl: async (symbol) => {
            return `${ServerUtils.earningsReleasesUrl}?ticker=${symbol}&api_key=${await ServerUtils.apiKey()}`;
        },
        getMetadataUrl: async (symbol) => {
            return `${ServerUtils.mtUrl}?ticker=${symbol}&api_key=${await ServerUtils.apiKey()}`;
        },
        hasSplits: async (symbol) => {
            const url = await ServerUtils.earningsReleases.getMetadataUrl(symbol);
            console.log('calling hasSplits', symbol);
            const response = await fetch(url);
            const json = {data: await response.json()};
            ServerUtils.maybePopulateDataFromContent(json);
            const {
                columns,
                data,
            } = json.data.datatable;

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
    async runPremiumCheck(context) {
        if (!context) {
            throw new Meteor.Error('something is not right');
        }
        if (context.connection && !await Permissions.isPremium()) {
            throw new Meteor.Error('you do not have access');
        }
    },
};
