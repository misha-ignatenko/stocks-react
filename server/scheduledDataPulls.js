import cron from 'node-cron';
import moment from 'moment-timezone';
import _ from 'underscore';
import { Meteor } from 'meteor/meteor';
import { Utils } from '../lib/utils';

function importEarningsReleases() {
    Meteor.call('importData', [], 'earnings_releases_new', true);
    Meteor.call('sendMissingEarningsReleaseSymbolsEmail');
}

Meteor.startup(function() {

    // skip data pull if dev env
    if (Meteor.isDevelopment) return;

    // 7am & 2pm utc
    cron.schedule('0 7,14 * * *', () => {
        console.log('Running: earnings releases');
        Meteor.defer(() => {
            importEarningsReleases();
        });
    });

    const baseOptions = {
        advancePurchaseDays: 1,
        saleDelayInDays: 2,
        saleDelayInDaysFinal: 10,
        ratingChangesLookbackInDays: 500,
        isForecast: true,
        includeHistory: true,
        bizDaysLookbackForHistory: 1000,
        emailResults: true,
    };

    // every weekday at 14:30
    cron.schedule('30 14 * * 1-5', () => {
        console.log('Running: 1st job');
        Meteor.defer(() => {
            Meteor.call('getEarningsAnalysis', {
                startDate: Utils.businessAdd(Utils.todaysDate(), 1),
                endDate: Utils.businessAdd(Utils.todaysDate(), 2),
                ...baseOptions,
            });
        });
    });

    // every weekday at 15:00
    cron.schedule('0 15 * * 1-5', () => {
        console.log('Running: 2nd job');
        Meteor.defer(() => {
            Meteor.call('getEarningsAnalysis', {
                startDate: Utils.businessAdd(Utils.todaysDate(), -1),
                endDate: Utils.todaysDate(),
                ...baseOptions,
            });
        });
    });

    console.log('Cron jobs initialized');

});

Meteor.methods({
    importEarningsReleases()  {
        ServerUtils.runPremiumCheck(this);

        importEarningsReleases();
    },
    async "sendMissingEarningsReleaseSymbolsEmail"() {
        // get all available stocks (symbols are _id attributes in universal format)
        var _allUniqueStockSymbols = _.uniq(StocksReactUtils.symbols.getLiveSymbols());

        // get all available unique earnings release records (symbols are symbol attributes in universal format)
        var _uniqueEarningsReleaseSymbols = await EarningsReleases._collection.rawCollection().distinct("symbol").then(symbols => {return symbols;});


        // figure out which stocks have no earnings releases
        var _symbolsThatHaveBidsOrAsks = _.difference(_allUniqueStockSymbols, _uniqueEarningsReleaseSymbols);


        Email.send({
            subject: 'MISSING earnings release symbols',
            text: JSON.stringify({
                timeNow: new Date(),
                missingSymbols: _symbolsThatHaveBidsOrAsks
            })
        });
    },
});