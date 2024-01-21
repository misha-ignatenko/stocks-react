import moment from 'moment-timezone';
const momentBiz = require('moment-business-days');

EarningsReleases = new Meteor.Collection("earningsReleases");
RatingChanges = new Meteor.Collection("ratingChanges");
ResearchCompanies = new Meteor.Collection("researchCompanies");
RatingScales = new Meteor.Collection("ratingScales");

Portfolios = new Mongo.Collection("portfolios");
PortfolioItems = new Mongo.Collection("portfolioItems");
PortfolioPermissions = new Mongo.Collection("portfolioPermissions");

Settings = new Mongo.Collection("settings");
Stocks = new Mongo.Collection("stocks");

SymbolMappings = new Mongo.Collection('symbolMappings');

EarningsReleases.helpers({
    adjustForSplits() {
        if (!this.adjustedForSplits) {
            const {
                asOf,
                symbol,
                insertedDate,
            } = this;

            const asOfString = insertedDate ?
                moment(insertedDate).add(1, 'days').format(Utils.dateFormat) :
                asOf;

            const fields = [
                'epsMeanEstimateNextFiscalQuarter',
                'streetMeanEstimateNextFiscalQuarter',
                'epsActualPreviousFiscalQuarter',
                'epsActualOneYearAgoFiscalQuarter',
            ].filter(field => _.isNumber(this[field]));
            const original = _.pick(this, fields);

            const adjustments = ServerUtils.prices.getAllAdjustments(symbol);

            const adjusted = ServerUtils.earningsReleases.getAdjustedEps(
                [original],
                adjustments,
                asOfString,
                fields
            )[0];

            _.extend(this, adjusted);

            this.adjustedForSplits = true;
        }
    },
    getPriorConfirmedRelease() {
        const previousQuarterEndDate = this.endDatePreviousFiscalQuarter;
        return EarningsReleases.findOne(
            {
                symbol: this.symbol,
                endDateNextFiscalQuarter: previousQuarterEndDate,
                reportSourceFlag: 1,
            },
            {
                sort: {asOf: -1},
            }
        );
    },
    getPurchaseDate(advancePurchaseDays=0) {
        const {
            reportTimeOfDayCode,
            reportDateNextFiscalQuarter,
        } = this;
        const reportDateString = Utils.convertToStringDate(reportDateNextFiscalQuarter);
        const isAfterMarketClose = reportTimeOfDayCode === 1;
        const purchaseDate = isAfterMarketClose ?
            momentBiz(reportDateString).businessAdd(-advancePurchaseDays).format(Utils.dateFormat) :
            momentBiz(reportDateString).businessAdd(-1-advancePurchaseDays).format(Utils.dateFormat);
        return purchaseDate;
    },
    getSaleDate(saleDelayInDays) {
        const saleDate1 = this.getPurchaseDate(-1);
        return momentBiz(saleDate1).businessAdd(saleDelayInDays).format(Utils.dateFormat);;
    },
});
