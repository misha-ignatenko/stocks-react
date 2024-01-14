import moment from 'moment-timezone';
import _ from 'underscore';
import { Random } from 'meteor/random';

var _serverSideVarCount = 0;

Meteor.startup(function() {
    //var _timeEveryDayInIsoToPull = "06:30:00.000";

    // skip data pull if dev env
    if (Meteor.isDevelopment) return;

    Meteor.setInterval(function(){
        var _quandlSettings = Utils.getSetting('serverSettings.quandl');
        var _timeEveryDayInIsoToPull = _quandlSettings.canPullFromQuandlEveryDayAtThisTimeInEasternTime;
        var _lastQuandlDatePull = _quandlSettings.dateOfLastPullFromQuandl;
        var _dateRightNowString = new Date().toISOString();
        var _dateString = _dateRightNowString.substring(0,10);
        var _timeString = _dateRightNowString.substring(11, _dateRightNowString.length - 1);

        var _dataAutoPullIsOn = Utils.getSetting('dataImports.autoDataImportsTurnedOn');

        if (_dataAutoPullIsOn && _lastQuandlDatePull !== _dateString && _timeString >= _timeEveryDayInIsoToPull) {
            ServerUtils.setEarningsReleaseSyncDate(_dateString);

            Meteor.call('importData', [], 'earnings_releases_new', true);

            Meteor.call("sendMissingEarningsReleaseSymbolsEmail");
        }


        _serverSideVarCount++;
    }, 10000);
});

Meteor.methods({
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
            to: ServerUtils.getEmailTo(),
            from: ServerUtils.getEmailTo(),
            subject: 'MISSING earnings release symbols',
            text: JSON.stringify({
                timeNow: new Date(),
                missingSymbols: _symbolsThatHaveBidsOrAsks
            })
        });
    }
});