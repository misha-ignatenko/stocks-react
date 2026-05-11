import { Meteor } from "meteor/meteor";
import moment from "moment-timezone";
const momentBiz = require("moment-business-days");
import { Utils } from "./utils";
import _ from "underscore";

let ServerUtils;
if (Meteor.isServer) {
    ServerUtils = require("../server/utils").ServerUtils;
}

export const EarningsReleases = new Meteor.Collection("earningsReleases", {
    transform(doc) {
        return {
            ...doc,
            async adjustForSplits() {
                if (!this.adjustedForSplits) {
                    const { asOf, symbol, insertedDate } = this;

                    const asOfString = insertedDate
                        ? moment(insertedDate)
                              .add(1, "days")
                              .format(Utils.dateFormat)
                        : asOf;

                    const fields = [
                        "epsMeanEstimateNextFiscalQuarter",
                        "epsActualPreviousFiscalQuarter",
                        "epsActualOneYearAgoFiscalQuarter",
                    ].filter((field) => _.isNumber(this[field]));
                    const original = _.pick(this, fields);

                    const adjustments =
                        await ServerUtils.prices.getAllAdjustments(symbol);

                    const adjusted =
                        ServerUtils.earningsReleases.getAdjustedEps(
                            [original],
                            adjustments,
                            asOfString,
                            fields,
                        )[0];

                    _.extend(this, adjusted);

                    this.adjustedForSplits = true;
                }
            },
            async getQuarterlyReleaseAtOffset(quartersForward = 1) {
                if (quartersForward === 0) {
                    return this;
                }
                const goingForward = quartersForward > 0;
                const sortDirection = goingForward ? 1 : -1;
                const { symbol, endDateNextFiscalQuarter } = this;
                const query = {
                    symbol,
                    endDateNextFiscalQuarter: Utils.dateRangeAround(
                        Utils.addCalendarDays(
                            endDateNextFiscalQuarter,
                            Utils.avgDaysInQuarter * quartersForward,
                        ),
                        45,
                    ),
                    ...Utils.companyConfirmedQuery,
                };
                return await EarningsReleases.findOneAsync(query, {
                    sort: { asOf: sortDirection },
                });
            },
            async getSimilarReleases() {
                const { symbol, endDateNextFiscalQuarter } = this;
                const query = {
                    symbol,
                    endDateNextFiscalQuarter,
                    ...Utils.companyConfirmedQuery,
                };
                return await EarningsReleases.find(query).fetchAsync();
            },
            async getActualRawEps() {
                // step 1. get all similar releases, then look at ActualEarnings
                const similarReleases = await this.getSimilarReleases();
                const allReleaseIds = _.pluck(similarReleases, "_id");
                const actuals = await ActualEarnings.find({
                    earningsReleaseIDs: { $in: allReleaseIds },
                }).fetchAsync();
                if (actuals.length === 1) {
                    return actuals[0].eps;
                }

                // step 2. lookup releases 1 year in the future by lastYearRptDt or endDateOneYearAgoFiscalQuarter
                const {
                    symbol,
                    reportDateNextFiscalQuarter,
                    endDateNextFiscalQuarter,
                } = this;
                const reportDateStr = Utils.convertToStringDate(
                    reportDateNextFiscalQuarter,
                );
                const [yyyy, mm, dd] = reportDateStr.split("-");
                const targetLastYearRptDt = `${parseInt(mm)}/${dd}/${yyyy}`;

                const oneYearFutureReleaseQuery = {
                    symbol,
                    ...Utils.companyConfirmedQuery,
                    epsActualOneYearAgoFiscalQuarter: {
                        $exists: true,
                        $ne: null,
                    },
                    $or: [
                        {
                            lastYearRptDt: targetLastYearRptDt,
                            source: "nasdaq",
                        },
                        {
                            endDateOneYearAgoFiscalQuarter:
                                endDateNextFiscalQuarter,
                            source: { $ne: "nasdaq" },
                        },
                    ],
                };
                const oneYearFutureReleases = await EarningsReleases.find(
                    oneYearFutureReleaseQuery,
                    {
                        fields: {
                            epsActualOneYearAgoFiscalQuarter: 1,
                        },
                    },
                ).fetchAsync();
                const oneYearFutureEps = _.uniq(
                    _.pluck(
                        oneYearFutureReleases,
                        "epsActualOneYearAgoFiscalQuarter",
                    ),
                );
                if (oneYearFutureEps.length === 1) {
                    return oneYearFutureEps[0];
                }

                // step 3. lookup releases 1 quarter in the future by endDateNextFiscalQuarter
                const oneQuarterFutureReleaseQuery = {
                    symbol,
                    ...Utils.companyConfirmedQuery,
                    epsActualPreviousFiscalQuarter: {
                        $exists: true,
                        $ne: null,
                    },
                    endDatePreviousFiscalQuarter: endDateNextFiscalQuarter,
                };
                const oneQuarterFutureReleases = await EarningsReleases.find(
                    oneQuarterFutureReleaseQuery,
                    {
                        fields: {
                            epsActualPreviousFiscalQuarter: 1,
                        },
                    },
                ).fetchAsync();
                const oneQuarterFutureEps = _.uniq(
                    _.pluck(
                        oneQuarterFutureReleases,
                        "epsActualPreviousFiscalQuarter",
                    ),
                );
                if (oneQuarterFutureEps.length === 1) {
                    return oneQuarterFutureEps[0];
                }

                console.warn(
                    "Step 1 inconsistent distinct EPS values",
                    this._id,
                    allReleaseIds,
                    "but found",
                    actuals,
                );
                console.warn(
                    "Step 2 inconsistent distinct EPS values",
                    this._id,
                    oneYearFutureReleaseQuery,
                    oneYearFutureEps,
                    oneYearFutureReleases,
                );
                console.warn(
                    "Step 3 inconsistent distinct EPS values",
                    this._id,
                    oneQuarterFutureReleaseQuery,
                    oneQuarterFutureEps,
                    oneQuarterFutureReleases,
                );
            },
            getPurchaseDate(advancePurchaseDays = 0) {
                const { reportTimeOfDayCode, reportDateNextFiscalQuarter } =
                    this;
                const reportDateString = Utils.convertToStringDate(
                    reportDateNextFiscalQuarter,
                );
                const isAfterMarketClose = reportTimeOfDayCode === 1;
                const purchaseDate = isAfterMarketClose
                    ? Utils.businessAdd(reportDateString, -advancePurchaseDays)
                    : Utils.businessAdd(
                          reportDateString,
                          -1 - advancePurchaseDays,
                      );
                return purchaseDate;
            },
            getSaleDate(saleDelayInDays) {
                const saleDate1 = this.getPurchaseDate(-1);
                return Utils.businessAdd(saleDate1, saleDelayInDays);
            },
        };
    },
});
export const RatingChanges = new Meteor.Collection("ratingChanges");
export const ResearchCompanies = new Meteor.Collection("researchCompanies");
export const RatingScales = new Meteor.Collection("ratingScales");

export const Portfolios = new Mongo.Collection("portfolios");
export const PortfolioItems = new Mongo.Collection("portfolioItems");

export const Settings = new Mongo.Collection("settings");
export const Stocks = new Mongo.Collection("stocks");

export const SymbolMappings = new Mongo.Collection("symbolMappings");

export const EarningsReleasesFinnhubMonitoring = new Mongo.Collection(
    "earningsReleasesFinnhubMonitoring",
);

export const EarningsReleasesNasdaqMonitoring = new Mongo.Collection(
    "earningsReleasesNasdaqMonitoring",
);

export const MarketCaps = new Mongo.Collection("marketCaps");

export const ActualEarnings = new Mongo.Collection("actualEarnings");
