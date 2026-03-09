import { Meteor } from "meteor/meteor";
import moment from "moment-timezone";
import _ from "underscore";
import { check, Match } from "meteor/check";
import { EJSON } from "meteor/ejson";
const momentBiz = require("moment-business-days");
const { performance } = require("perf_hooks");
import {
    EarningsReleases,
    EarningsReleasesFinnhubMonitoring,
    EarningsReleasesNasdaqMonitoring,
    RatingChanges,
    ResearchCompanies,
    RatingScales,
    Settings,
    Stocks,
    SymbolMappings,
} from "../lib/collections";
import { Permissions } from "../lib/permissions";
import { Utils } from "../lib/utils";
import { ServerUtils, yahooFinance } from "./utils";

const dateStringSortDesc = { dateString: -1 };
const researchFirmIDsToExclude = ["vt29AuAATaAu7r3rS", "TMbx3pyYK8gSqH3W6"];
const YYYYMMDD = Utils.dateFormatYYYYMMDD;
const YYYY_MM_DD = Utils.dateFormat;
const ADJ_CLOSE = "adjClose";
const nonCanadaFilter = {
    currencyCode: { $nin: ["CND"] },
    exchange: { $nin: ["NASDAQ Other OTC"] },
};

const getRatingChangesQuery = () => {
    return {
        researchFirmId: { $nin: researchFirmIDsToExclude },
        dateString: {
            $gte: Utils.monthsAgo(Utils.ratingChangesLookbackMonths),
        },
    };
};

Meteor.methods({
    async getLatestRatingChanges() {
        console.log("getLatestRatingChanges");
        const ratingChanges = await RatingChanges.find(
            getRatingChangesQuery(),
            {
                sort: dateStringSortDesc,
                limit: await ServerUtils.ratingsChangesLimitGlobal(),
            },
        ).fetchAsync();

        return await ServerUtils.getExtraRatingChangeData(ratingChanges);
    },

    async getLatestRatingChangesForSymbol(symbol) {
        check(symbol, String);
        console.log("getLatestRatingChangesForSymbol", symbol);

        const ratingChanges = await RatingChanges.find(
            _.extend(getRatingChangesQuery(), {
                symbol: symbol,
            }),
            {
                sort: dateStringSortDesc,
                limit: await ServerUtils.ratingsChangesLimitSymbol(),
            },
        ).fetchAsync();

        return await ServerUtils.getExtraRatingChangeData(ratingChanges);
    },

    async getRatingChangeMetadata() {
        return {
            numChanges: await RatingChanges.find().countAsync(),
            numFirms: await ResearchCompanies.find().countAsync(),
        };
    },

    async ratingChangesForSymbol(options) {
        check(options, {
            symbol: String,
            startDate: String,
            endDate: String,
        });
        const { symbol, startDate, endDate } = options;
        console.log("calling ratingChangesForSymbol", options);

        let query = {
            symbol,
            $and: [{ dateString: { $gte: startDate, $lte: endDate } }],
        };
        if (!(await Permissions.isPremium())) {
            const lookback = await Utils.getCachedSetting(
                "clientSettings.upcomingEarningsReleases.numberOfDaysBeforeTodayForRatingChangesPublicationIfNoUser",
            );
            const noUserStartDate = moment()
                .subtract(lookback, "days")
                .format(YYYY_MM_DD);

            query.$and.push({
                dateString: { $gte: noUserStartDate },
            });
        }

        return await RatingChanges.find(query, {
            fields: {
                _id: 1,
                symbol: 1,
                date: 1,
                dateString: 1,
                oldRatingId: 1,
                newRatingId: 1,
                researchFirmId: 1,
            },
            sort: { dateString: 1 },
        }).fetchAsync();
    },

    async getPricesForSymbol(symbol) {
        check(symbol, String);

        await ServerUtils.runPremiumCheck(this);
        return await ServerUtils.prices.getAllPrices(symbol);
    },

    async emailPricesForSymbol(symbol) {
        const prices = await Meteor.callAsync("getPricesForSymbol", symbol);
        const maxDate = Utils.getMinMaxDate(prices).max;
        await ServerUtils.emailJSON(
            prices,
            `${symbol}_prices_${maxDate}.json`,
            `prices for ${symbol} - ${maxDate}`,
        );
    },

    async getEarliestRatingChange(symbol) {
        check(symbol, String);

        const r = await RatingChanges.findOneAsync(
            { symbol },
            { sort: { dateString: 1 }, fields: { dateString: 1 } },
        );
        return r?.dateString;
    },

    async getUpcomingEarningsReleases() {
        const daysToAdd = this.userId
            ? 10
            : await Utils.getCachedSetting(
                  "clientSettings.upcomingEarningsReleases.numberOfDaysFromTodayForEarningsReleasesPublicationIfNoUser",
              );
        const startDate = Utils.convertToNumberDate(Utils.todaysDate());
        const endDate = Utils.convertToNumberDate(Utils.businessAdd(Utils.todaysDate(), daysToAdd));

        const closestWeekDay = +(await Utils.getClosestPreviousWeekDayDateByCutoffTime(
            undefined,
            YYYYMMDD,
        ));
        const query = {
            $and: [
                {
                    reportDateNextFiscalQuarter: {
                        $gte: Math.max(startDate, closestWeekDay),
                        $lte: endDate,
                    },
                },
                {
                    ...nonCanadaFilter,
                },
                {
                    reportSourceFlag: 1,
                },
            ],
        };

        const earningsReleases = await EarningsReleases.find(query, {
            sort: {
                reportDateNextFiscalQuarter: 1,
                asOf: -1,
            },
        }).fetchAsync();

        const sorted = _.sortBy(earningsReleases, (e) => {
            // see _convertQuandlZEAfieldName for more info
            return (
                e.reportDateNextFiscalQuarter * 10 +
                (e.reportTimeOfDayCode === 2
                    ? 1
                    : e.reportTimeOfDayCode === 3
                      ? 2
                      : e.reportTimeOfDayCode === 1
                        ? 3
                        : 4)
            );
        });
        sorted.forEach((e) => {
            e.timeOfDay = Utils.earningsTimeOfDayMap[e.reportTimeOfDayCode];
            e.key = `${e.reportDateNextFiscalQuarter}-${e.reportTimeOfDayCode}-${e.symbol}`;
        });
        return _.uniq(sorted, false, (e) => e.key);
    },

    async getUpcomingEarningsReleasesFinnhub() {
        const startDate = +moment().format(YYYYMMDD);
        const endDate = +moment().add(10, "days").format(YYYYMMDD);

        const releases = await EarningsReleasesFinnhubMonitoring.find(
            {
                reportDateNextFiscalQuarter: {
                    $gte: startDate,
                    $lte: endDate,
                },
            },
            {
                sort: { reportDateNextFiscalQuarter: 1, asOf: -1 },
            },
        ).fetchAsync();

        // chronological time-of-day order: before open (2), during (3), after close (1), unknown (4)
        const timeOfDayOrder = { 2: 1, 3: 2, 1: 3, 4: 4 };
        return _.uniq(
            _.sortBy(
                releases,
                (e) =>
                    e.reportDateNextFiscalQuarter * 10 +
                    (timeOfDayOrder[e.reportTimeOfDayCode] ?? 4),
            ),
            false,
            (e) => `${e.reportDateNextFiscalQuarter}-${e.symbol}`,
        );
    },

    async getUpcomingEarningsReleasesNasdaq() {
        const startDate = +moment().format(YYYYMMDD);
        const endDate = +moment().add(10, "days").format(YYYYMMDD);

        const releases = await EarningsReleasesNasdaqMonitoring.find(
            { reportDateNextFiscalQuarter: { $gte: startDate, $lte: endDate } },
            { sort: { reportDateNextFiscalQuarter: 1, asOf: -1 } },
        ).fetchAsync();

        const timeOfDayOrder = { 2: 1, 3: 2, 1: 3, 4: 4 };
        return _.uniq(
            _.sortBy(
                releases,
                (e) => e.reportDateNextFiscalQuarter * 10 + (timeOfDayOrder[e.reportTimeOfDayCode] ?? 4),
            ),
            false,
            (e) => `${e.reportDateNextFiscalQuarter}-${e.symbol}`,
        );
    },

    async compareEarningsReleasesByDate({ date }) {
        check(date, Number); // YYYYMMDD integer

        const [mainReleases, nasdaqReleases] = await Promise.all([
            EarningsReleases.find(
                {
                    reportDateNextFiscalQuarter: date,
                    reportSourceFlag: 1,
                    ...nonCanadaFilter,
                },
                { sort: { asOf: -1 } },
            ).fetchAsync(),
            EarningsReleasesNasdaqMonitoring.find(
                { reportDateNextFiscalQuarter: date },
                { sort: { asOf: -1 } },
            ).fetchAsync(),
        ]);

        // deduplicate by symbol, keeping most recent asOf
        const mainBySymbol = _.indexBy(
            _.uniq(mainReleases, false, (e) => e.symbol),
            "symbol",
        );
        const nasdaqBySymbol = _.indexBy(
            _.uniq(nasdaqReleases, false, (e) => e.symbol),
            "symbol",
        );

        const mainSymbols = Object.keys(mainBySymbol);
        const nasdaqSymbols = new Set(Object.keys(nasdaqBySymbol));

        const overlapping = mainSymbols.filter((s) => nasdaqSymbols.has(s));
        const onlyInMain = mainSymbols.filter((s) => !nasdaqSymbols.has(s));
        const onlyInNasdaq = [...nasdaqSymbols].filter((s) => !mainBySymbol[s]);

        const groupByTimeOfDay = (symbols, sourceMap) =>
            _.groupBy(symbols, (s) => sourceMap[s]?.reportTimeOfDayCode ?? 4);

        return {
            overlapping: groupByTimeOfDay(overlapping, mainBySymbol),
            onlyInMain: groupByTimeOfDay(onlyInMain, mainBySymbol),
            onlyInNasdaq: groupByTimeOfDay(onlyInNasdaq, nasdaqBySymbol),
        };
    },

    insertAltRatingScale: async function (
        firmNameStr,
        mainRatingString,
        mainRatingStringExactMatchBool,
        alternativeRatingString,
    ) {
        var _user = await Meteor.userAsync();
        if (!_user) {
            throw new Meteor.Error("Please log in.");
        } else {
            var _dataImportPermissions =
                _user.permissions && _user.permissions.dataImports;
            var _canImportRatingScales =
                _dataImportPermissions &&
                _.contains(_dataImportPermissions, "canImportRatingScales");
            if (!_canImportRatingScales) {
                throw new Meteor.Error(
                    "You do not have permission to import rating scales.",
                );
            }
        }

        var _researchFirmQuery = {
            name: { $regex: firmNameStr },
        };
        var _firms =
            await ResearchCompanies.find(_researchFirmQuery).fetchAsync();

        var _firmId = _firms.length === 1 ? _firms[0]._id : null;
        if (_firmId) {
            console.log("the firm id is: ", _firmId);
            var _ratingScaleQuery = {
                firmRatingFullString: mainRatingStringExactMatchBool
                    ? mainRatingString
                    : { $regex: mainRatingString },
                researchFirmId: _firmId,
            };
            var _ratingScales =
                await RatingScales.find(_ratingScaleQuery).fetchAsync();

            var _ratingScaleId =
                _ratingScales.length === 1 ? _ratingScales[0]._id : null;
            if (_ratingScaleId) {
                console.log("rating scale id: ", _ratingScaleId);

                var _alternativeRatingScale = {
                    researchFirmId: _firmId,
                    type: "alternative",
                    ratingString: alternativeRatingString,
                    referenceRatingScaleId: _ratingScaleId,
                };

                if (
                    !(await RatingScales.findOneAsync(_alternativeRatingScale))
                ) {
                    var _newId = await RatingScales.insertAsync(
                        _alternativeRatingScale,
                    );
                    console.log("inserted id: ", _newId);
                }
            } else {
                console.log(
                    "cannot find exactly one rating scale with query: ",
                    _ratingScaleQuery,
                );
            }
        } else {
            console.log("cannot find firm with query: ", _researchFirmQuery);
        }

        return;
    },
    addNewSymbolMapping: async function (localStr, fromStr, universalStr) {
        var _obj = {
            symbolStr: localStr,
            from: fromStr,
            universalSymbolStr: universalStr,
        };
        if ((await SymbolMappings.find(_obj).countAsync()) == 0) {
            return await SymbolMappings.insertAsync(_obj);
        }
    },

    getRegressionPerformance: async function (
        symbol,
        maxRatingChangeDate,
        priceCheckDate,
    ) {
        check(symbol, String);
        check(maxRatingChangeDate, String);
        check(priceCheckDate, String);
        await ServerUtils.runPremiumCheck(this);
        console.log(
            "getRegressionPerformance",
            symbol,
            maxRatingChangeDate,
            priceCheckDate,
        );

        // step 1. get all rating changes for symbol up to maxRatingChangeDate
        var _ratingChangesForRegr = await RatingChanges.find(
            { symbol: symbol, dateString: { $lte: maxRatingChangeDate } },
            { sort: { dateString: 1 } },
        ).fetchAsync();

        // step 2. get all stock prices for symbol between earliest rating change's closest prior business day and maxRatingChangeDate
        //moment().toISOString().substring(10,24)
        var _regrStart = await Utils.getClosestPreviousWeekDayDateByCutoffTime(
            moment(
                _ratingChangesForRegr[0].dateString +
                    moment().toISOString().substring(10, 24),
            ).tz("America/New_York"),
        );
        var _regrEnd = maxRatingChangeDate;
        var _allPrices = await ServerUtils.prices.getAllPrices(symbol);
        var _pricesForRegr = Utils.stockPrices.getPricesBetween(
            _allPrices,
            _regrStart,
            _regrEnd,
        );

        // step 3. check that have all the needed prices in date range
        var _availablePricesStart = _pricesForRegr[0].dateString;
        var _availablePricesEnd = _.last(_pricesForRegr).dateString;
        if (
            _regrStart === _availablePricesStart &&
            _regrEnd === _availablePricesEnd
        ) {
            const ratingChanges = await RatingChanges.find({
                symbol,
            }).fetchAsync();
            var _averageAnalystRatingSeries =
                await Utils.ratingChanges.generateAverageAnalystRatingTimeSeries(
                    symbol,
                    _regrStart,
                    _regrEnd,
                    ratingChanges,
                );
            var _avgRatingsSeriesEveryDay =
                Utils.ratingChanges.generateAverageAnalystRatingTimeSeriesEveryDay(
                    _averageAnalystRatingSeries,
                    _pricesForRegr,
                );

            var _priceReactionDelayInDays = 0;
            var pctDownPerDay = 0.5;
            var pctUpPerDay = 0.5;
            var stepSizePow = -7;
            var regrIterNum = 30;
            var _rollingNum = 50;
            var _rollingPx = Utils.stockPrices.getSimpleRollingPx(
                _allPrices,
                _regrStart,
                _rollingNum,
            );
            var _rollingPxEnd = Utils.stockPrices.getSimpleRollingPx(
                _allPrices,
                _regrEnd,
                _rollingNum,
            );
            var _rollingPriceCheck = Utils.stockPrices.getSimpleRollingPx(
                _allPrices,
                priceCheckDate,
                _rollingNum,
            );
            console.log(
                "START AND END: ",
                _regrStart,
                _regrEnd,
                priceCheckDate,
            );
            var _weightedRatingsSeriesEveryDay =
                Utils.ratingChanges.generateWeightedAnalystRatingsTimeSeriesEveryDay(
                    _avgRatingsSeriesEveryDay,
                    _regrStart,
                    _regrEnd,
                    _pricesForRegr,
                    _priceReactionDelayInDays,
                    "adjClose",
                    pctDownPerDay,
                    pctUpPerDay,
                    Math.pow(10, stepSizePow),
                    regrIterNum,
                );
            _weightedRatingsSeriesEveryDay =
                _weightedRatingsSeriesEveryDay.ratings;

            // step 5. get all future prices
            var _futurePrices = Utils.stockPrices.getPricesBetween(
                _allPrices,
                _regrEnd,
                priceCheckDate,
            );
            console.log("length 1: ", _futurePrices.length);

            // step 6. make sure all the needed future prices are in the db
            if (
                _futurePrices[0].dateString !== _regrEnd ||
                _.last(_futurePrices).dateString !== priceCheckDate
            ) {
                throw new Meteor.Error(
                    "make sure there are prices for " +
                        symbol +
                        " from " +
                        _regrEnd +
                        " to " +
                        priceCheckDate,
                );
            }

            // step 7.1: project last item in _avgRatingsSeriesEveryDay to all future prices
            var _lastAvg = _.last(_avgRatingsSeriesEveryDay);

            // step 8.1: project last item in _weightedRatingsSeriesEveryDay to all future prices
            var _lastWgt = _.last(_weightedRatingsSeriesEveryDay);

            // figure out the same but if predictions were based on the entire date range (regr + future)
            // step 5*. get all prices
            var _regrAndFuturePrices = Utils.stockPrices.getPricesBetween(
                _allPrices,
                _regrStart,
                priceCheckDate,
            );
            console.log("length 2: ", _regrAndFuturePrices.length);

            // step 6*. make sure have all the needed prices
            if (
                _regrAndFuturePrices[0].dateString !== _regrStart ||
                _.last(_regrAndFuturePrices).dateString !== priceCheckDate
            ) {
                throw new Meteor.Error(
                    "make sure there are prices for " +
                        symbol +
                        " from " +
                        _regrStart +
                        " to " +
                        priceCheckDate,
                );
            }

            // step 8.1*. project all prices onto daily WGT rating series (copy over all existing _weightedRatingsSeriesEveryDay
            // and copy over the last item from _weightedRatingsSeriesEveryDay to all the remaining future days
            var _regrAndFutureWgtRatingsEveryDay = _.map(
                _regrAndFuturePrices,
                function (p, idx) {
                    if (p.dateString > _lastWgt.dateString) {
                        // just copy over the last wgt rating
                        return {
                            date: p.date,
                            rating: _lastWgt.weightedRating,
                            dateString: p.dateString,
                        };
                    } else {
                        // copy over historical daily wgt rating from regression
                        var _w = _weightedRatingsSeriesEveryDay[idx];
                        if (p.dateString !== _w.dateString) {
                            throw new Meteor.Error(
                                "error while projecting daily weighted ratings into the future: " +
                                    p.dateString +
                                    " " +
                                    _w.dateString,
                            );
                        }

                        return {
                            date: p.date,
                            rating: _w.weightedRating,
                            dateString: p.dateString,
                        };
                    }
                },
            );

            // step 8.2*. get predictions based on ALL daily wgt ratings from regression AND future.
            var _predictOnWgtRegrAndFut =
                Utils.ratingChanges.predictionsBasedOnRatings(
                    _regrAndFutureWgtRatingsEveryDay,
                    _regrAndFuturePrices,
                    "adjClose",
                    _rollingPx,
                    0,
                    120,
                    60,
                    pctDownPerDay,
                    pctUpPerDay,
                );

            // step 9.1*. project all prices onto daily AVG rating series
            var _regrAndFutureAvgRatingsEveryDay = _.map(
                _regrAndFuturePrices,
                function (p, idx) {
                    if (p.dateString > _lastAvg.dateString) {
                        // just copy over the last avg rating
                        return {
                            date: p.date,
                            rating: _lastAvg.avg,
                            dateString: p.dateString,
                        };
                    } else {
                        // copy over historical daily avg rating from regression
                        var _a = _avgRatingsSeriesEveryDay[idx];
                        if (p.dateString !== _a.dateString) {
                            throw new Meteor.Error(
                                "error while projecting daily weighted ratings into the future: " +
                                    p.dateString +
                                    " " +
                                    _a.dateString,
                            );
                        }

                        return {
                            date: p.date,
                            rating: _a.avg,
                            dateString: p.dateString,
                        };
                    }
                },
            );

            // step 9.2*. get predictions based on ALL daily avg ratings from regression AND future.
            var _predictOnAvgRegrAndFut =
                Utils.ratingChanges.predictionsBasedOnRatings(
                    _regrAndFutureAvgRatingsEveryDay,
                    _regrAndFuturePrices,
                    "adjClose",
                    _rollingPx,
                    0,
                    120,
                    60,
                    pctDownPerDay,
                    pctUpPerDay,
                );

            return {
                avgRatingsExtended: _regrAndFutureAvgRatingsEveryDay,
                wgtRatingsExtended: _regrAndFutureWgtRatingsEveryDay,
                px: _regrAndFuturePrices,
                altAvg: _predictOnAvgRegrAndFut,
                altWgt: _predictOnWgtRegrAndFut,
                actualStart: _.first(_futurePrices),
                actualEnd: _.last(_futurePrices),
                earliestRatingChangeDate: _ratingChangesForRegr[0]?.dateString,
                latestRatingChangeDate: _.last(_ratingChangesForRegr)
                    ?.dateString,
                avgRatingsDaily: _avgRatingsSeriesEveryDay,
                wgtRatingsDaily: _weightedRatingsSeriesEveryDay,
                rollingRegrStart: _rollingPx,
                rollingRegrEnd: _rollingPxEnd,
                rollingPriceCheck: _rollingPriceCheck,
                regrStartDate: _regrStart,
            };
        } else {
            console.log(
                "mismatch with prices history: ",
                _regrStart,
                _availablePricesStart,
                _regrEnd,
                _availablePricesEnd,
            );
        }
    },

    async getEarningsAnalysis(options) {
        check(options, {
            startDate: String,
            endDate: String,
            saleDelayInDays: Match.Maybe(Number),
            saleDelayInDaysFinal: Match.Maybe(Number),
            ratingChangesDelayInDays: Match.Maybe(Number),
            ratingChangesLookbackInDays: Match.Maybe(Number),
            isForecast: Match.Maybe(Boolean),
            advancePurchaseDays: Match.Maybe(Number),
            symbol: Match.Optional(String),
            isRecursive: Match.Optional(Boolean),
            includeHistory: Match.Optional(Boolean),
            bizDaysLookbackForHistory: Match.Optional(Number),
            emailResults: Match.Optional(Boolean),
            returnExpected: Match.Optional(Boolean),
            isHistory: Match.Optional(Boolean),
        });

        await ServerUtils.runPremiumCheck(this);

        const start = performance.now();
        const getEmailText = () =>
            EJSON.stringify({
                options,
                ms: performance.now() - start,
            });

        const {
            startDate,
            endDate,
            saleDelayInDays = 5,
            saleDelayInDaysFinal = 10,
            ratingChangesDelayInDays = 5,
            ratingChangesLookbackInDays = 750,
            isForecast = false,
            advancePurchaseDays = 0,
            symbol,
            isRecursive = false,
            includeHistory = false,
            bizDaysLookbackForHistory = 500,
            emailResults = false,
            returnExpected = false,
            isHistory = false,
        } = options;

        const fileName = `${startDate}_${endDate}_${advancePurchaseDays + saleDelayInDays}_${saleDelayInDaysFinal}-.csv`;

        console.log("getEarningsAnalysis", {
            startDate,
            endDate,
            saleDelayInDays,
            saleDelayInDaysFinal,
            ratingChangesDelayInDays,
            ratingChangesLookbackInDays,
            isForecast,
            advancePurchaseDays,
            symbol,
            isRecursive,
            includeHistory,
            bizDaysLookbackForHistory,
            emailResults,
            returnExpected,
            isHistory,
            fileName,
        });

        if (symbol && isRecursive) {
            const reportDates = await ServerUtils.earningsReleases.getHistory(
                symbol,
                startDate,
                endDate,
                false,
                true,
            );
            const lastQuarter = _.max(
                _.pluck(reportDates, "endDateNextFiscalQuarter"),
            );
            const results = [];
            for (const {
                reportDateNextFiscalQuarter: reportDate,
                endDateNextFiscalQuarter: quarter,
            } of reportDates) {
                const dateString = Utils.convertToStringDate(reportDate);
                const isLastReportDate = quarter === lastQuarter;
                const result = await Meteor.callAsync(
                    "getEarningsAnalysis",
                    _.extend({}, options, {
                        isRecursive: false,
                        startDate: dateString,
                        endDate: dateString,
                        isForecast: isForecast && isLastReportDate,
                        emailResults: false,
                        isHistory: true,
                    }),
                );
                results.push(...result);
            }
            return results;
        }

        const validRatingScaleIDsMap =
            await ServerUtils.getNumericRatingScalesMap();

        const expectedReleasesQuery = {
            $and: [
                {
                    epsMeanEstimateNextFiscalQuarter: { $nin: [null] },
                    reportDateNextFiscalQuarter: {
                        $gte: Utils.convertToNumberDate(startDate),
                        $lte: Utils.convertToNumberDate(endDate),
                    },
                    reportSourceFlag: 1,
                    ...((returnExpected && emailResults) || isHistory
                        ? {}
                        : {
                              asOf: {
                                  // allow 1 more day, because legacy earnings releases do not have
                                  // `insertedDate` and their `asOf` gets moved to the next
                                  // day right after release if latest release isn't in the API yet
                                  $lte: Utils.businessAdd(endDate, 2),
                              },
                          }),

                    ...nonCanadaFilter,
                },
            ],
        };

        if (isHistory) {
            /**
             * legacy earnings releases do not have `insertedDate` or `insertedDateStr`, so i need a proxy
             * based on the `asOf` date.
             */
            const insertedBeforeEndDateOrLegacyQuery = {
                $or: [
                    {
                        insertedDateStr: { $lte: endDate },
                    },
                    {
                        insertedDateStr: { $exists: false },
                        asOf: { $lte: Utils.businessAdd(endDate, 2) },
                    },
                ],
            };
            expectedReleasesQuery.$and.push(insertedBeforeEndDateOrLegacyQuery);
        }

        if (symbol) {
            expectedReleasesQuery.symbol = symbol;
        }
        if (isForecast) {
            expectedReleasesQuery.$or = [
                {
                    reportDateNextFiscalQuarter:
                        Utils.convertToNumberDate(startDate),
                    // after market close
                    reportTimeOfDayCode: { $in: [1] },
                },
                {
                    reportDateNextFiscalQuarter:
                        Utils.convertToNumberDate(endDate),
                    // before or during open
                    reportTimeOfDayCode: { $in: [2, 3] },
                },
            ];
        }
        if (advancePurchaseDays) {
            // expectedReleasesQuery.insertedDate = {
            //     $lte: momentBiz(startDate).businessAdd(-advancePurchaseDays).toDate(),
            // };
        }

        // these are the expected earnings releases within the requested date range
        const expectedEarningsReleases = await EarningsReleases.find(
            expectedReleasesQuery,
            {
                sort: { asOf: -1 },
            },
        ).fetchAsync();

        if (expectedEarningsReleases.length === 0) {
            if (symbol) {
                console.log("cannot find expected release for", symbol);
            }
            return [];
        }

        console.log(
            "expectedEarningsReleases",
            expectedEarningsReleases.length,
            EJSON.stringify(expectedReleasesQuery),
        );

        if (returnExpected && emailResults) {
            const pricesSet = new Set();
            const prices = [];
            const lookback = 5 + 265;
            const lookahead = 15;

            // todo: check this logic
            /*
            expectedEarningsReleases = expectedEarningsReleases.filter(e => {
                const {
                    insertedDateStr,
                    asOf,
                } = e;
                const dateAfter = e.getSaleDate(0);

                if (insertedDateStr) {
                    return insertedDateStr <= dateAfter;
                } else {
                    return asOf <= Utils.businessAdd(dateAfter, 2);
                }
            });
            */

            for (const expectedRelease of expectedEarningsReleases) {
                const dateBefore =
                    expectedRelease.getPurchaseDate(advancePurchaseDays);
                const dateAfter = expectedRelease.getSaleDate(0);

                _.extend(expectedRelease, {
                    dateBefore,
                    dateAfter,
                });

                const symbol = expectedRelease.symbol;
                for (const daysToAdd of _.range(-lookback, lookahead + 1)) {
                    const dateString = Utils.businessAdd(dateBefore, daysToAdd);
                    const key = `${symbol}_${dateString}`;
                    if (pricesSet.has(key)) {
                        continue;
                    }

                    pricesSet.add(key);

                    const price = await ServerUtils.prices.getPriceOnDayNew({
                        symbol,
                        dateString,
                        isStrict: false,
                    });
                    const vooPrice = await ServerUtils.prices.getPriceOnDayNew({
                        symbol: "VOO",
                        dateString,
                    });

                    prices.push({
                        symbol,
                        dateString,
                        price,
                        vooPrice,
                    });
                }
            }

            const uniqueReleases = _.uniq(
                expectedEarningsReleases,
                false,
                (e) => {
                    return `${e.symbol}_${e.dateBefore}`;
                },
            );

            await ServerUtils.emailCSV(
                uniqueReleases,
                fileName,
                fileName,
                getEmailText(),
            );
            await ServerUtils.emailCSV(
                prices,
                fileName,
                fileName + " prices",
                getEmailText(),
            );
            return uniqueReleases;
        }

        if (includeHistory) {
            const symbols = _.uniq(_.pluck(expectedEarningsReleases, "symbol"));
            const historicalRows = [];
            for (const symbol of symbols) {
                const result = await Meteor.callAsync(
                    "getEarningsAnalysis",
                    _.extend({}, options, {
                        startDate: momentBiz(startDate)
                            .businessAdd(-bizDaysLookbackForHistory)
                            .format(YYYY_MM_DD),
                        isRecursive: true,
                        symbol,
                        includeHistory: false,
                        emailResults: false,
                    }),
                );
                historicalRows.push(...result);
            }

            if (emailResults) {
                await ServerUtils.emailCSV(
                    ServerUtils.earningsReleases.processRowsForCSV(
                        historicalRows,
                    ),
                    fileName,
                    fileName,
                    getEmailText(),
                );
            }

            return historicalRows;
        }

        const expectedMap = new Map();
        const uniqueExpectedEarningsReleases = expectedEarningsReleases.filter(
            (e) => {
                const {
                    symbol,
                    asOf,
                    reportDateNextFiscalQuarter,
                    insertedDateStr,
                } = e;

                if (expectedMap.has(symbol)) {
                    return false;
                }

                // see note above in `expectedReleasesQuery` for why `subtract` is needed
                const asOfFormatted = Utils.convertToNumberDate(
                    Utils.businessAdd(asOf, -2),
                );
                if (asOfFormatted <= reportDateNextFiscalQuarter) {
                    expectedMap.set(symbol, e);
                    return true;
                }
            },
        );
        if (uniqueExpectedEarningsReleases.length === 0) {
            // todo: address this
            console.log(
                "NO uniqueExpectedEarningsReleases",
                expectedEarningsReleases,
            );
            return [];
        }

        const actualReleasesQuery = {
            $or: uniqueExpectedEarningsReleases.map((e) => {
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
                    asOf: { $gt: Utils.convertToStringDate(minAsOfDate) },
                };
            }),
        };
        const actualEarningsReleases = await EarningsReleases.find(
            actualReleasesQuery,
            {
                sort: { asOf: 1 },
                ...(symbol && { limit: 1 }),
            },
        ).fetchAsync();
        const actualMap = new Map();
        const uniqueActualEarningsReleases = actualEarningsReleases.filter(
            (e) => {
                const { symbol } = e;
                if (actualMap.has(symbol)) {
                    return;
                }
                actualMap.set(symbol, e);
                return true;
            },
        );

        const expectedSymbols = _.pluck(
            uniqueExpectedEarningsReleases,
            "symbol",
        );
        const actualSymbols = _.pluck(uniqueActualEarningsReleases, "symbol");
        console.log(
            "cannot find a corresponding earnings release for expected: ",
            _.difference(expectedSymbols, actualSymbols),
        );

        const results = [];

        const getRateOfChange = (exp, act) => {
            if (_.isNumber(exp) && _.isNumber(act)) {
                if (exp === act) {
                    return 0;
                }
                if (act === 0) {
                    return exp / Math.abs(exp);
                }
                const diff = exp - act;
                return diff / Math.abs(act);
            }
        };

        for (const e of isForecast
            ? uniqueExpectedEarningsReleases
            : uniqueActualEarningsReleases) {
            const { symbol } = e;

            const expectedE = expectedMap.get(symbol);
            const actualE = actualMap.get(symbol);

            await expectedE.adjustForSplits();
            if (actualE) {
                await actualE.adjustForSplits();
            }

            const actualEps = actualE?.epsActualPreviousFiscalQuarter;
            const expectedEpsNextQt = actualE?.epsMeanEstimateNextFiscalQuarter;

            const reportDate = expectedE.reportDateNextFiscalQuarter;

            const expectedAsOf = expectedE.asOf;
            const {
                reportTimeOfDayCode,
                timeOfDayDescription,
                insertedDate,
                epsMeanEstimateNextFiscalQuarter: expectedEps,
                epsActualPreviousFiscalQuarter,
                epsActualOneYearAgoFiscalQuarter,
                endDateNextFiscalQuarter,
                companyName,
            } = expectedE;

            const firstEverExpectation = await EarningsReleases.findOneAsync(
                {
                    symbol,
                    endDateNextFiscalQuarter,
                },
                {
                    sort: { asOf: 1 },
                    fields: {
                        epsMeanEstimateNextFiscalQuarter: 1,
                        asOf: 1,
                        insertedDate: 1,
                        symbol: 1,
                    },
                },
            );
            await firstEverExpectation.adjustForSplits();
            const {
                epsMeanEstimateNextFiscalQuarter: originalEpsExpectation,
                asOf: originalAsOfExpectation,
                insertedDate: originalInsertedDateExpectation,
            } = firstEverExpectation;
            const firstEpsExpDate = originalInsertedDateExpectation
                ? moment(originalInsertedDateExpectation).format(YYYY_MM_DD)
                : originalAsOfExpectation;

            const isAfterMarketClose = reportTimeOfDayCode === 1;
            // todo: buy in advance, need to modify asOf in `expectedReleasesQuery`
            // const purchaseDate = expectedE.getPurchaseDate(advancePurchaseDays + (isForecast ? 1 : 0));
            const purchaseDate = expectedE.getPurchaseDate(advancePurchaseDays);
            const saleDate1 = expectedE.getSaleDate(0);
            const saleDate2 = momentBiz(saleDate1)
                .businessAdd(saleDelayInDays)
                .format(YYYY_MM_DD);
            const saleDate3 = momentBiz(saleDate1)
                .businessAdd(saleDelayInDaysFinal)
                .format(YYYY_MM_DD);

            const vooPrices = await ServerUtils.prices.getAllPrices("VOO");
            const vooOpenPriceOnPurchaseDate =
                await Utils.stockPrices.getPriceOnDay(
                    vooPrices,
                    purchaseDate,
                    "open",
                );
            const vooSMA50Date = momentBiz(purchaseDate)
                .businessAdd(-50)
                .format(YYYY_MM_DD);
            const vooSMA50DaysAgo = Utils.stockPrices.getSimpleRollingPx(
                vooPrices,
                vooSMA50Date,
                10,
                !isForecast,
            );
            const vooSMA200Date = momentBiz(purchaseDate)
                .businessAdd(-200)
                .format(YYYY_MM_DD);
            const vooSMA200DaysAgo = Utils.stockPrices.getSimpleRollingPx(
                vooPrices,
                vooSMA200Date,
                10,
                !isForecast,
            );
            const vooSMA = Utils.stockPrices.getSimpleRollingPx(
                vooPrices,
                purchaseDate,
                10,
                !isForecast,
            );

            const inc50Price = vooOpenPriceOnPurchaseDate / vooSMA50DaysAgo;
            const inc200Price = vooOpenPriceOnPurchaseDate / vooSMA200DaysAgo;
            const inc50SMA = vooSMA / vooSMA50DaysAgo;
            const inc200SMA = vooSMA / vooSMA200DaysAgo;

            const prices = await ServerUtils.prices.getAllPrices(symbol);
            const purchasePrice = await Utils.stockPrices.getPriceOnDay(
                prices,
                purchaseDate,
            );
            const purchasePriceSMA50 = Utils.stockPrices.getSimpleRollingPx(
                prices,
                purchaseDate,
                50,
                !isForecast,
            );
            const purchasePriceSMA200 = Utils.stockPrices.getSimpleRollingPx(
                prices,
                purchaseDate,
                200,
                !isForecast,
            );
            const salePrice1 = await Utils.stockPrices.getPriceOnDay(
                prices,
                saleDate1,
            );
            const salePrice2 = await Utils.stockPrices.getPriceOnDay(
                prices,
                saleDate2,
            );
            const salePrice3 = await Utils.stockPrices.getPriceOnDay(
                prices,
                saleDate3,
            );

            const ratingChangesCutoffDate = momentBiz(purchaseDate)
                .businessAdd(-ratingChangesDelayInDays)
                .format(YYYY_MM_DD);
            const ratingChangesEarliestDate = momentBiz(purchaseDate)
                .businessAdd(
                    -ratingChangesDelayInDays - ratingChangesLookbackInDays,
                )
                .format(YYYY_MM_DD);
            const ratingChanges = await ServerUtils.getLatestRatings(
                symbol,
                ratingChangesEarliestDate,
                // todo: if isForecast is true, ignore the ratingChangesCutoffDate
                ratingChangesCutoffDate,
                validRatingScaleIDsMap,
            );
            const sumOfDatesMs = Utils.sum(
                ratingChanges.map((r) => moment(r.dateString).valueOf()),
            );
            const averageRatingChangeDate = moment(
                sumOfDatesMs / ratingChanges.length,
            ).format(YYYY_MM_DD);
            const ratings = ratingChanges.map((rc) =>
                validRatingScaleIDsMap.get(rc.newRatingId),
            );
            const avgRating = Utils.avg(ratings);

            const altRatingsWithAdjRatings =
                await ServerUtils.getAltAdjustedRatings(
                    ratingChanges,
                    prices,
                    purchaseDate,
                );
            const altAvgRatingWithAdjRatings = Utils.avg(
                altRatingsWithAdjRatings,
            );

            let numRecentUpgrades;
            let numRecentDowngrades;
            let priorSaleDate;
            let priorSalePrice;
            let priorSalePriceSMA50;
            let priorSalePriceSMA200;
            const priorConfirmedRelease =
                await expectedE.getPriorConfirmedRelease();
            if (priorConfirmedRelease) {
                const priorPurchaseDate =
                    priorConfirmedRelease.getPurchaseDate(advancePurchaseDays);
                priorSaleDate =
                    priorConfirmedRelease.getSaleDate(saleDelayInDaysFinal);
                priorSalePrice = await Utils.stockPrices.getPriceOnDay(
                    prices,
                    priorSaleDate,
                );
                priorSalePriceSMA50 = Utils.stockPrices.getSimpleRollingPx(
                    prices,
                    priorSaleDate,
                    50,
                );
                priorSalePriceSMA200 = Utils.stockPrices.getSimpleRollingPx(
                    prices,
                    priorSaleDate,
                    200,
                );
                const priorCutoffDateForRatingChanges = momentBiz(
                    priorPurchaseDate,
                )
                    .businessAdd(-ratingChangesDelayInDays)
                    .format(YYYY_MM_DD);
                const newRatingChangesStartDate = momentBiz(
                    priorCutoffDateForRatingChanges,
                )
                    .businessAdd(1)
                    .format(YYYY_MM_DD);
                const ratingChangesSinceLastEarningsRelease =
                    await ServerUtils.getLatestRatings(
                        symbol,
                        newRatingChangesStartDate,
                        ratingChangesCutoffDate,
                    );
                numRecentUpgrades = 0;
                numRecentDowngrades = 0;
                for (const rc of ratingChangesSinceLastEarningsRelease) {
                    if (await ServerUtils.ratingChanges.isUpgrade(rc)) {
                        numRecentUpgrades++;
                    } else if (
                        await ServerUtils.ratingChanges.isDowngrade(rc)
                    ) {
                        numRecentDowngrades++;
                    }
                }
            }

            const data = {
                insertedDate,
                symbol,
                companyName,
                expectedEps,
                actualEps,
                expectedEpsNextQt,
                reportDate,
                expectedAsOf,
                timeOfDayDescription,
                endDateNextFiscalQuarter,
                originalEpsExpectation,
                pctExpEpsOverOriginalEpsExpectation: getRateOfChange(
                    expectedEps,
                    originalEpsExpectation,
                ),
                originalAsOfExpectation: firstEpsExpDate,

                isAfterMarketClose,
                purchaseDate,
                saleDate1,
                saleDate2,
                saleDate3,
                priorSaleDate,
                ratingChangesCutoffDate,
                avgRating,
                numRatings: ratings.length,
                numRecentDowngrades,
                numRecentUpgrades,
                averageRatingChangeDate,
                altAvgRatingWithAdjRatings,

                epsActualPreviousFiscalQuarter,
                pctExpEpsOverPrevQt: getRateOfChange(
                    expectedEps,
                    epsActualPreviousFiscalQuarter,
                ),
                epsActualOneYearAgoFiscalQuarter,
                pctExpEpsOverOneYearAgo: getRateOfChange(
                    expectedEps,
                    epsActualOneYearAgoFiscalQuarter,
                ),

                purchasePrice,
                purchasePriceSMA50,
                purchasePriceSMA200,
                salePrice1,
                salePrice2,
                salePrice3,
                priorSalePrice,
                priorSalePriceSMA50,
                priorSalePriceSMA200,

                vooOpenPriceOnPurchaseDate,
                vooSMA,
                vooSMA50DaysAgo,
                vooSMA200DaysAgo,

                inc50Price,
                inc200Price,
                inc50SMA,
                inc200SMA,
            };
            results.push(data);
        }

        if (emailResults && !includeHistory) {
            await ServerUtils.emailCSV(
                ServerUtils.earningsReleases.processRowsForCSV(results),
                fileName,
                fileName,
                getEmailText(),
            );
        }

        return results;
    },
});

Accounts.onCreateUser(function (options, user) {
    var _createdUser;
    if (options.registered === undefined) {
        _createdUser = _.extend(user, { registered: false });
    } else {
        _createdUser = _.extend(user, { registered: options.registered });
    }

    //set premium to false no matter what
    _createdUser.premium = false;
    _createdUser.permissions = {};
    _createdUser.showDataImportsTab = false;

    return _createdUser;
});

Meteor.methods({
    registerRealAccountFromDummy: function (newUsername, newPassword) {
        check(newUsername, String);
        check(newPassword, String);

        var dummyUserId = Meteor.userId();
        Accounts.setUsername(dummyUserId, newUsername);
        Accounts.setPassword(dummyUserId, newPassword);
        Meteor.users.update(
            { _id: dummyUserId },
            { $set: { registered: true } },
        );
        return { username: newUsername, password: newPassword };
    },

    async getSimilarSymbols(symbol) {
        check(symbol, String);

        if (symbol.length < 1) return [];

        const symbols = await Stocks.find(
            {
                _id: { $regex: symbol.toUpperCase() },
            },
            {
                fields: { _id: 1 },
                limit: 25,
            },
        ).fetchAsync();
        return _.pluck(symbols, "_id");
    },

    async checkIfSymbolExists(symbol) {
        check(symbol, String);

        try {
            console.log("getting yahoo finance quote for symbol", symbol);
            const quote = await yahooFinance.quote(symbol);
            if (quote) return true;
        } catch (e) {
            // symbol not found in Yahoo Finance, fall through to other checks
        }

        async function checkDatatable(url) {
            try {
                const response = await fetch(url);
                const json = await response.json();
                return json.datatable.data.length > 0;
            } catch (e) {
                return false;
            }
        }

        const urls = [
            await ServerUtils.earningsReleases.getEarningsReleasesUrl(symbol),
        ];

        for (const url of urls) {
            if (await checkDatatable(url)) {
                return true;
            }
        }
        return false;
    },

    async insertNewStockSymbols(symbolsArray) {
        check(symbolsArray, [String]);

        const result = {};
        const symbols = symbolsArray.map((s) => s.toUpperCase());
        console.log("insertNewStockSymbols", symbols);

        // Look up all symbols in one query
        const existingSymbols = new Set(
            await Stocks.rawCollection().distinct("_id", {
                _id: { $in: symbols },
            }),
        );

        // Process all symbols in one pass
        for (const symbol of symbols) {
            if (existingSymbols.has(symbol)) {
                result[symbol] = true;
            } else {
                const exists = await Meteor.callAsync(
                    "checkIfSymbolExists",
                    symbol,
                );
                if (exists) {
                    await Stocks.insertAsync({ _id: symbol });
                }
                result[symbol] = exists;
            }
        }

        return result;
    },
});
