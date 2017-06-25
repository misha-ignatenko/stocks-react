var _serverSideVarCount = 0;

Meteor.startup(function() {
    //var _timeEveryDayInIsoToPull = "06:30:00.000";

    Meteor.setInterval(function(){
        var _quandlSettings = Settings.findOne().serverSettings.quandl;
        var _timeEveryDayInIsoToPull = _quandlSettings.canPullFromQuandlEveryDayAtThisTimeInEasternTime;
        var _lastQuandlDatePull = _quandlSettings.dateOfLastPullFromQuandl;
        var _dateRightNowString = new Date().toISOString();
        var _dateString = _dateRightNowString.substring(0,10);
        var _timeString = _dateRightNowString.substring(11, _dateRightNowString.length - 1);

        var _setting = Settings.findOne();
        var _dataAutoPullIsOn = _setting && _setting.dataImports && _setting.dataImports.autoDataImportsTurnedOn;



        // pull prices for the day from Quandl Finance
        var _nycDateTime = moment().tz("America/New_York");
        var _nycDateTimeString = _nycDateTime.format();
        var _nycTimeString = _nycDateTimeString.substring(11, _nycDateTimeString.length - 1 - 5) + ".000";
        var _dateStringNyc = _nycDateTime.format("YYYY-MM-DD");
        var _weekdayNyc = _nycDateTime.isoWeekday();
        // 6 is Saturday
        // 7 is Sunday
        if (_weekdayNyc === 6 || _weekdayNyc === 7) {
            // do nothing
        } else {
            var _lastPullDate = _setting && _setting.dataImports && _setting.dataImports.quandlPrices.lastPullDate &&
                _setting.dataImports.quandlPrices.lastPullDate;
            var _dailyYFpullTime = _setting.dataImports.quandlPrices.dailyPullTimeNyc;

            if (_dataAutoPullIsOn && _lastPullDate !== _dateStringNyc && _nycTimeString >= _dailyYFpullTime) {
                Settings.update({_id: _setting._id}, {$set: {"dataImports.quandlPrices.lastPullDate": _dateStringNyc}});

                Email.send({
                    to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                    from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                    subject: "pulling prices for the day from Yahoo Finance",
                    text: JSON.stringify({
                        timeNow: new Date(),
                        nycDate: _dateStringNyc,
                        weekDayNum: _weekdayNyc,
                        lastPullDate: _lastPullDate,
                        nycTimeString: _nycTimeString,
                        dailyPullTimeNyc: _dailyYFpullTime
                    })
                });

                // first, get stock prices from the free Quandl (Wiki)
                Meteor.call("getQuandlPricesForDate", _dateStringNyc, false, false);

                // second, pull prices from the paid Quandl (NASDAQ)
                Meteor.call("getLatestPricesForAllSymbols", "2014-01-01", _dateStringNyc);

                Email.send({
                    to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                    from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                    subject: "DONE pulling prices for the day from Yahoo Finance",
                    text: JSON.stringify({
                        timeNow: new Date(),
                        nycDate: _dateStringNyc,
                        weekDayNum: _weekdayNyc,
                        lastPullDate: _lastPullDate,
                        nycTimeString: _nycTimeString,
                        dailyPullTimeNyc: _dailyYFpullTime
                    })
                });
            }
        }


        if (_dataAutoPullIsOn && _lastQuandlDatePull !== _dateString && _timeString >= _timeEveryDayInIsoToPull) {
            var _previousSettings = Settings.findOne();
            var _previousServerSettings = _previousSettings.serverSettings;
            _previousServerSettings.quandl.dateOfLastPullFromQuandl = _dateString;
            Settings.update({_id: _previousSettings._id}, {$set: {serverSettings: _previousServerSettings}});

            var _allStockObjects = Stocks.find({}, {fields: {_id: 1}}).fetch();
            var _allStockSymbols = _.pluck(_allStockObjects, "_id");

            Email.send({
                to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                subject: 'getting earnings releases',
                text: JSON.stringify({
                    timeNow: new Date(),
                    symbols: _.uniq(_allStockSymbols)
                })
            });

            Meteor.call("importData", _.uniq(_allStockSymbols), "earnings_releases", true);

            Meteor.call("sendMissingEarningsReleaseSymbolsEmail");
        }


        _serverSideVarCount++;
    }, 10000);
});

Meteor.methods({
    "getVarFromServer": function() {
        return _serverSideVarCount;
    }
    , "sendMissingEarningsReleaseSymbolsEmail": function () {
        // get all available stocks (symbols are _id attributes in universal format)
        var _allStockObjects = Stocks.find({}, {fields: {_id: 1}}).fetch();
        var _allStockSymbols = _.pluck(_allStockObjects, "_id");
        var _allUniqueStockSymbols = _.uniq(_allStockSymbols);

        // get all available unique earnings release records (symbols are symbol attributes in universal format)
        var _uniqueEarningsReleaseSymbols = _.uniq(_.pluck(EarningsReleases.find({}, {fields: {symbol: 1}}).fetch(), "symbol"));


        // figure out which stocks have no earnings releases
        // _.difference(_allUniqueStockSymbols, _uniqueEarningsReleaseSymbols)


        // check which of these do not have a quote from Yahoo
        var _symbolsThatHaveBidsOrAsks = [];


        _.difference(_allUniqueStockSymbols, _uniqueEarningsReleaseSymbols).forEach(function(missingSym) {
            Meteor.call("getFullQuote", [missingSym], function (error, result) {
                if (!error) {
                    var _result = result && result[0];
                    if (_result && (_result.bid || _result.ask) ) {
                        // console.log("result: ", _result);
                        _symbolsThatHaveBidsOrAsks.push(_result.symbol);
                    } else {
                        // console.log("symbol has no bid and no ask: ", missingSym);
                    }
                } else {
                    // console.log("error: ", error);
                }
            });
        });




        Email.send({
            to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
            from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
            subject: 'MISSING earnings release symbols',
            text: JSON.stringify({
                timeNow: new Date(),
                missingSymbols: _symbolsThatHaveBidsOrAsks
            })
        });
    }
});