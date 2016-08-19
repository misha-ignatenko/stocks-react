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

        if (_lastQuandlDatePull !== _dateString && _timeString >= _timeEveryDayInIsoToPull) {
            var _previousSettings = Settings.findOne();
            var _previousServerSettings = _previousSettings.serverSettings;
            _previousServerSettings.quandl.dateOfLastPullFromQuandl = _dateString;
            Settings.update({_id: _previousSettings._id}, {$set: {serverSettings: _previousServerSettings}});

            var _allStockObjects = Stocks.find().fetch();
            var _allStockSymbols = _.pluck(_allStockObjects, "_id");

            Email.send({
                to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                subject: 'getting earnings releases',
                text: JSON.stringify({
                    symbols: _.uniq(_allStockSymbols)
                })
            });

            Meteor.call("importData", _.uniq(_allStockSymbols), "earnings_releases", true);
        }


        Meteor.call("pullPricesForUpcomingEarningsReleases");


        _serverSideVarCount++;
    }, 10000);
});

Meteor.methods({
    "getVarFromServer": function() {
        return _serverSideVarCount;
    },

    "pullPricesForUpcomingEarningsReleases": function() {
        var _yahooFinanceSettings = Settings.findOne().serverSettings.yahooFinance;
        var _timeEveryDayInIsoToPull = _yahooFinanceSettings.canPullFromYahooFinanceEveryDayAtThisTimeInIso;
        var _lastYahooFinancePullDate = _yahooFinanceSettings.dateOfLastPullFromYahooFinance;
        var _dateRightNowString = new Date().toISOString();
        var _dateString = _dateRightNowString.substring(0,10);
        var _timeString = _dateRightNowString.substring(11, _dateRightNowString.length - 1);


        if (_lastYahooFinancePullDate !== _dateString && _timeString >= _timeEveryDayInIsoToPull) {
            var _previousSettings = Settings.findOne();
            var _previousServerSettings = _previousSettings.serverSettings;
            _previousServerSettings.yahooFinance.dateOfLastPullFromYahooFinance = _dateString;
            Settings.update({_id: _previousSettings._id}, {$set: {serverSettings: _previousServerSettings}});

            //need to subtract 1 days because date in iso is after midnight
            var _startDateForEarnRel = parseInt(moment(new Date().toISOString().substring(0,10)).subtract(1, "days").format("YYYYMMDD"));
            var _endDateForEarnRel = parseInt(moment(new Date().toISOString().substring(0,10)).add(_previousServerSettings.yahooFinance.numOfDaysToConsiderEarnRel - 1 , "days").format("YYYYMMDD"));


            var _allEarningsReleases = EarningsReleases.find({
                $and: [
                    {
                        reportDateNextFiscalQuarter: {
                            $exists: true
                        }
                    },
                    {
                        reportDateNextFiscalQuarter: {
                            $gte: _startDateForEarnRel
                        }
                    },
                    {
                        reportDateNextFiscalQuarter: {
                            $lte: _endDateForEarnRel
                        }
                    }
                ]
            }, {field: {symbol: 1}}).fetch();

            var _uniqSymbolsFromUpcomingEarnRel = _.uniq(_.pluck(_allEarningsReleases, "symbol"));
            var _startDate = moment(new Date().toISOString().substring(0,10)).subtract(1, "years").format("YYYY-MM-DD");
            var _endDate = moment(new Date().toISOString().substring(0,10)).subtract(1, "days").format("YYYY-MM-DD");

            Email.send({
                to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                subject: 'getting stock prices for upcoming earnings releases',
                text: JSON.stringify({
                    startDate: _startDate,
                    endDate: _endDate,
                    symbols: _uniqSymbolsFromUpcomingEarnRel,
                    timeNow: new Date()
                })
            });

            _uniqSymbolsFromUpcomingEarnRel.forEach(function(symbol) {
                Meteor.call("getStockPricesNew", symbol, _startDate, _endDate);
            });

            var _allPricesForEndDate = NewStockPrices.find({dateString: _endDate}, {fields: {symbol: 1}}).fetch();
            var _allUniqPrices = _.uniq(_.pluck(_allPricesForEndDate, 'symbol'));
            var _symbolsMissingPricesForEndDate = _.difference(_uniqSymbolsFromUpcomingEarnRel, _allUniqPrices);

            Email.send({
                to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
                subject: 'DONE getting stock prices for upcoming earnings releases',
                text: JSON.stringify({
                    startDate: _startDate,
                    endDate: _endDate,
                    symbols: _uniqSymbolsFromUpcomingEarnRel,
                    timeNow: new Date(),
                    symbolsMissingPricesForEndDate: _symbolsMissingPricesForEndDate
                })
            });
        }
    }
});