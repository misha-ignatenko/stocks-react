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
                        "streetMeanEstimateNextFiscalQuarter",
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
            async getPriorConfirmedRelease() {
                const previousQuarterEndDate =
                    this.endDatePreviousFiscalQuarter;
                return await EarningsReleases.findOneAsync(
                    {
                        symbol: this.symbol,
                        endDateNextFiscalQuarter: previousQuarterEndDate,
                        reportSourceFlag: 1,
                    },
                    {
                        sort: { asOf: -1 },
                    },
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

export const EarningsReleasesYahooMonitoring = new Mongo.Collection(
    "earningsReleasesYahooMonitoring",
);
