import moment from 'moment-timezone';

EarningsReleases = new Meteor.Collection("earningsReleases");
RatingChanges = new Meteor.Collection("ratingChanges");
ResearchCompanies = new Meteor.Collection("researchCompanies");
RatingScales = new Meteor.Collection("ratingScales");

Portfolios = new Mongo.Collection("portfolios");
PortfolioItems = new Mongo.Collection("portfolioItems");
PortfolioPermissions = new Mongo.Collection("portfolioPermissions");

Settings = new Mongo.Collection("settings");
QuandlDataPullErrors = new Mongo.Collection("quandlDataPullErrors");
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
});
