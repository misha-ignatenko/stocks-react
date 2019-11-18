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

        if (_dataAutoPullIsOn && _lastQuandlDatePull !== _dateString && _timeString >= _timeEveryDayInIsoToPull) {
            var _previousSettings = Settings.findOne();
            var _previousServerSettings = _previousSettings.serverSettings;
            _previousServerSettings.quandl.dateOfLastPullFromQuandl = _dateString;
            Settings.update({_id: _previousSettings._id}, {$set: {serverSettings: _previousServerSettings}});

            var _allStockSymbols = StocksReactUtils.symbols.getLiveSymbols();

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
        var _allUniqueStockSymbols = _.uniq(StocksReactUtils.symbols.getLiveSymbols());

        // get all available unique earnings release records (symbols are symbol attributes in universal format)
        var _uniqueEarningsReleaseSymbols = _.uniq(_.pluck(EarningsReleases.find({}, {fields: {symbol: 1}}).fetch(), "symbol"));


        // figure out which stocks have no earnings releases
        // _.difference(_allUniqueStockSymbols, _uniqueEarningsReleaseSymbols)


        // check which of these do not have a quote from Yahoo
        var _symbolsThatHaveBidsOrAsks = _.difference(_allUniqueStockSymbols, _uniqueEarningsReleaseSymbols);


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