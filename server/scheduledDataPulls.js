import moment from 'moment-timezone';
import _ from 'underscore';
import { Random } from 'meteor/random';

var _serverSideVarCount = 0;

function importEarningsReleases() {
    Meteor.call('importData', [], 'earnings_releases_new', true);
    Meteor.call('sendMissingEarningsReleaseSymbolsEmail');
}

Meteor.startup(function() {
    //var _timeEveryDayInIsoToPull = "06:30:00.000";

    // skip data pull if dev env
    if (Meteor.isDevelopment) return;

    Meteor.setInterval(function(){
        var _quandlSettings = ServerUtils.getCachedSetting('serverSettings.quandl');
        var _timeEveryDayInIsoToPull = _quandlSettings.canPullFromQuandlEveryDayAtThisTimeInEasternTime;
        var _lastQuandlDatePull = _quandlSettings.dateOfLastPullFromQuandl;
        var _dateRightNowString = new Date().toISOString();
        var _dateString = _dateRightNowString.substring(0,10);
        var _timeString = _dateRightNowString.substring(11, _dateRightNowString.length - 1);

        var _dataAutoPullIsOn = ServerUtils.getCachedSetting('dataImports.autoDataImportsTurnedOn');

        if (_dataAutoPullIsOn && _lastQuandlDatePull !== _dateString && _timeString >= _timeEveryDayInIsoToPull) {
            ServerUtils.setEarningsReleaseSyncDate(_dateString);

            importEarningsReleases();
        }


        _serverSideVarCount++;
    }, 10000);

    SyncedCron.add({
        name: 'earnings releases',
        schedule: function(parser) {
            return parser.text('at 14:00');
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
    "getVarFromServer": function() {
        return _serverSideVarCount;
    }
    , async "sendMissingEarningsReleaseSymbolsEmail"() {
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
    }
});