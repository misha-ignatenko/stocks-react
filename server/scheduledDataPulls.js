import Future from 'fibers/future';
import moment from 'moment-timezone';
import _ from 'underscore';
import { Random } from 'meteor/random';

var _serverSideVarCount = 0;

Meteor.startup(function() {
    //var _timeEveryDayInIsoToPull = "06:30:00.000";

    Meteor.setInterval(function(){
        var _quandlSettings = Utils.getSetting('serverSettings.quandl');
        var _timeEveryDayInIsoToPull = _quandlSettings.canPullFromQuandlEveryDayAtThisTimeInEasternTime;
        var _lastQuandlDatePull = _quandlSettings.dateOfLastPullFromQuandl;
        var _dateRightNowString = new Date().toISOString();
        var _dateString = _dateRightNowString.substring(0,10);
        var _timeString = _dateRightNowString.substring(11, _dateRightNowString.length - 1);

        var _dataAutoPullIsOn = Utils.getSetting('dataImports.autoDataImportsTurnedOn');

        if (_dataAutoPullIsOn && _lastQuandlDatePull !== _dateString && _timeString >= _timeEveryDayInIsoToPull) {
            Settings.update(Utils.getSetting('_id'), {$set: {
                'serverSettings.quandl.dateOfLastPullFromQuandl': _dateString,
            }});

            Meteor.call('importData', [], 'earnings_releases_new', true);

            /*
            var _allStockSymbols = StocksReactUtils.symbols.getLiveSymbols();

            // the API allows up to 5000 calls per 10 min
            const n = 5000;
            const chunks = _.range(_allStockSymbols.length / n).map(i => _allStockSymbols.slice(i * n, (i + 1) * n));

            const futures = chunks.map((chunk, index) => {
                const future = new Future();
                Meteor.setTimeout(() => {
                    const symbols = _.uniq(chunk);
                    Email.send({
                        to: ServerUtils.getEmailTo(),
                        from: ServerUtils.getEmailTo(),
                        subject: 'getting earnings releases for chunk ' + index,
                        text: JSON.stringify({
                            hostname: Meteor.absoluteUrl(),
                            timeNow: new Date(),
                            symbols: symbols,
                        })
                    });

                    Meteor.call("importData", symbols, "earnings_releases", true, (err, res) => {
                        future.return(index);
                    });

                }, index * 11 * 60 * 1000); // space each chunk call by 11 minutes (1000 ms/sec * 60 sec/min * 11 min)
                return future;
            });

            const results = futures.map((future, index) => {
                return future.wait();
            });
            */

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