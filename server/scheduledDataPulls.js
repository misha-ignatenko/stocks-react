import moment from 'moment-timezone';
import _ from 'underscore';
import { Random } from 'meteor/random';

function importEarningsReleases() {
    Meteor.call('importData', [], 'earnings_releases_new', true);
    Meteor.call('sendMissingEarningsReleaseSymbolsEmail');
}

Meteor.startup(function() {

    // skip data pull if dev env
    if (Meteor.isDevelopment) return;

    SyncedCron.add({
        name: 'earnings releases',
        schedule: function(parser) {
            // 7am & 2pm utc
            return parser.cron('0 7,14 * * *');
        },
        job: function() {
            Meteor.defer(() => {
                importEarningsReleases();
            });
        },
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

    SyncedCron.add({
        name: '1st job',
        schedule: function(parser) {
            return parser.text('every weekday at 14:30');
        },
        job: function() {
            Meteor.defer(() => {
                Meteor.call('getEarningsAnalysis', {
                    startDate: Utils.businessAdd(Utils.todaysDate(), 1),
                    endDate: Utils.businessAdd(Utils.todaysDate(), 2),
                    ...baseOptions,
                });
            });
        },
    });

    SyncedCron.add({
        name: '2nd job',
        schedule: function(parser) {
            return parser.text('every weekday at 15:00');
        },
        job: function() {
            Meteor.defer(() => {
                Meteor.call('getEarningsAnalysis', {
                    startDate: Utils.businessAdd(Utils.todaysDate(), -1),
                    endDate: Utils.todaysDate(),
                    ...baseOptions,
                });
            });
        },
    });

    SyncedCron.start();

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