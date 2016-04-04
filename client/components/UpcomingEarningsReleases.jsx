let _allowQuandlPullEveryNdaysFromPreviousForThatStock = 3;

UpcomingEarningsReleases = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState() {
        let _ratingChangesDateFormat = "YYYY-MM-DD";

        return {
            startDateRatingChanges: moment(new Date().toISOString()).subtract(90, 'days').format(_ratingChangesDateFormat),
            endDateRatingChanges: moment(new Date().toISOString()).format(_ratingChangesDateFormat),
            startEarningsReleaseDateInteger: parseInt(moment(new Date().toISOString()).format("YYYYMMDD")),
            endEarningsReleaseDateInteger: parseInt(moment(new Date().toISOString()).add(10, 'days').format("YYYYMMDD")),
            ratingChangesSubscriptionHandles: {}
        }
    },

    getMeteorData() {


        //check if EXP_RPT_DATE_QR1 or EXP_RPT_DATE_QR2 exist inside earningreleases collection
        //TODO: need code for EXP_RPT_DATE_QR3 and EXP_RPT_DATE_QR4

        var data = {};
        data.currentUser = Meteor.user();
        data.settings = Settings.findOne();
        if (data.settings) {
            var _endDateForEarningsReleasesSubscription =
                data.currentUser ?
                    this.state.endEarningsReleaseDateInteger :
                    parseInt(moment(new Date().toISOString()).add(data.settings.clientSettings.upcomingEarningsReleases.numberOfDaysFromTodayForEarningsReleasesPublicationIfNoUser, 'days').format("YYYYMMDD"));
            var _handle1 = Meteor.subscribe("earningsReleases", this.state.startEarningsReleaseDateInteger, _endDateForEarningsReleasesSubscription);
            if (_handle1.ready()) {
                var _uniqSymbols = _.uniq(_.pluck(EarningsReleases.find().fetch(), "symbol"));
                var _startDateForRatingChangesSubscription =
                    data.currentUser ?
                        this.state.startDateRatingChanges :
                        moment(new Date().toISOString()).subtract(data.settings.clientSettings.upcomingEarningsReleases.numberOfDaysBeforeTodayForRatingChangesPublicationIfNoUser, 'days').format("YYYY-MM-DD");
                var _ratingsChangesHandle = Meteor.subscribe("ratingChangesForSymbols", _uniqSymbols, _startDateForRatingChangesSubscription, this.state.endDateRatingChanges);
                if (_ratingsChangesHandle.ready()) {
                    data.earningsReleasesAndRatingChangesSubscriptionsReady = true;
                    this.pullDataFromQuandl(_uniqSymbols);
                }
            }
        }

        return data;
    },

    pullDataFromQuandl: function(uniqueSymbols) {
        let _symbols = [];
        let _todaysDate = parseInt(moment(new Date().toISOString()).format("YYYYMMDD"));
        uniqueSymbols.forEach(function(symbol) {
            let _earningsReleasesForSymbol = _.filter(EarningsReleases.find().fetch(), function(obj) {
                return obj.symbol === symbol;
            });
            let _sorted = _.sortBy(_earningsReleasesForSymbol, function (obj) {
                let _date = new Date(obj["lastModified"]).toISOString();
                return _date;
            });
            if (_sorted && _sorted.length > 0) {
                let _latestDate = _sorted[_sorted.length - 1]["asOf"];
                let _nextUpdateAllowedOn_NUM = parseInt(moment(new Date(_latestDate)).add(_allowQuandlPullEveryNdaysFromPreviousForThatStock + 1, 'days').format("YYYYMMDD"));

                if (_nextUpdateAllowedOn_NUM <= _todaysDate) {
                    _symbols.push(symbol);
                }
            }
        });
        if (_symbols.length > 0) {
            //console.log("GONNA PULL EARNING RELEASES FROM QUANDL FOR: ", _symbols);
            Meteor.call("importData", _symbols, "earnings_releases");
        }
    },
    setDatepickerOptions: function() {
        let _datepickerOptions = {
            autoclose: true,
            todayHighlight: true,
            orientation: "top auto"
        };
        $('#startEarningsReleaseDateInteger').datepicker(_datepickerOptions);
        $('#endEarningsReleaseDateInteger').datepicker(_datepickerOptions);
        $('#startEarningsReleaseDateInteger').val(this.convertQuandlFormatNumberDateToDateStringWithSlashes(this.state.startEarningsReleaseDateInteger));
        $('#endEarningsReleaseDateInteger').val(this.convertQuandlFormatNumberDateToDateStringWithSlashes(this.state.endEarningsReleaseDateInteger));
        var _that = this;

        $('.datepickerInput2').on('change', function() {
            let _newVal = $(this).val();
            let _momentDate = parseInt(moment(new Date(_newVal).toISOString()).format("YYYYMMDD"));
            let _id = $(this).attr('id');
            let _set = {};
            _set[_id] = _momentDate;
            _that.setState(_set);
        });
    },
    convertQuandlFormatNumberDateToDateStringWithSlashes: function(_dateStringWithNoSlashesAsNumber) {
        _dateStringWithNoSlashesAsNumber = _dateStringWithNoSlashesAsNumber.toString();
        var _year = _dateStringWithNoSlashesAsNumber.substring(0,4);
        var _month = _dateStringWithNoSlashesAsNumber.substring(4,6);
        var _day = _dateStringWithNoSlashesAsNumber.substring(6,8);
        return _month + "/" + _day + "/" + _year;
    },

    focusStocks(stocksArr) {
        var _alreadyAvailableRatingChangesForSymbols = _.pluck(RatingChanges.find().fetch(), "symbol");
        var _additionalSymbolsToSubscribeForRatingChangesFor = _.difference(stocksArr, _alreadyAvailableRatingChangesForSymbols);

        var _existingHandles = this.state.ratingChangesSubscriptionHandles;
        _additionalSymbolsToSubscribeForRatingChangesFor.forEach(function(symbol) {
            var _handle = Meteor.subscribe("ratingChangesForSymbol", symbol);
            _existingHandles[symbol] = _handle;
        });


        //STOP ALL UNNECESSARY ONES if no user
        if (!Meteor.user()) {
            var _stopTheseSubs = _.uniq(_.difference(_alreadyAvailableRatingChangesForSymbols, stocksArr));
            if (_stopTheseSubs.length > 0) {
                _stopTheseSubs.forEach(function(symbol) {
                    if (_existingHandles[symbol]) {
                        _existingHandles[symbol].stop();
                    }
                });
            }
        }

        this.setState({
            ratingChangesSubscriptionHandles: _existingHandles
        });

    },

    render() {

        return (
            <div className="container">
                { this.data.currentUser ? (
                    this.data.currentUser.registered ? (
                        <div>
                            <br/>
                            <div className="datepickers" ref={this.setDatepickerOptions}>
                                start date:
                                <input className="datepickerInput2" id="startEarningsReleaseDateInteger"/>
                                <br/>
                                end date:
                                <input className="datepickerInput2" id="endEarningsReleaseDateInteger" />
                            </div>
                            <br/>
                            <br/>
                            <br/>
                        </div>
                    ) : null
                ) : null}
                {this.data.earningsReleasesAndRatingChangesSubscriptionsReady ? <UpcomingEarningsButtonsAndSelectedSymbol /> : "getting upcoming earnings releases and their ratings changes."}
                <br/>
            </div>
        );
    }
});