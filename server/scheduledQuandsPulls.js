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

            Meteor.call("importData", _.uniq(_allStockSymbols), "earnings_releases");
        }

        _serverSideVarCount++;
    }, 10000);
});

Meteor.methods({
    "getVarFromServer": function() {
        return _serverSideVarCount;
    }
});