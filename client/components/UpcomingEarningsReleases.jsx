import { Component } from 'react';

let _allowQuandlPullEveryNdaysFromPreviousForThatStock = 3;

class UpcomingEarningsReleases extends Component {

    getInitialState() {
        let _ratingChangesDateFormat = "YYYY-MM-DD";

        return {
            companyConfirmedEarnRelOnly: true,
            startDateRatingChanges: moment(new Date().toISOString()).subtract(90, 'days').format(_ratingChangesDateFormat),
            endDateRatingChanges: moment(new Date().toISOString()).format(_ratingChangesDateFormat),
            startEarningsReleaseDateInteger: parseInt(moment(new Date().toISOString()).format("YYYYMMDD")),
            endEarningsReleaseDateInteger: parseInt(moment(new Date().toISOString()).add(10, 'days').format("YYYYMMDD")),
            ratingChangesSubscriptionHandles: {}
        }
    }

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
            var _handle1 = Meteor.subscribe("earningsReleases", this.state.startEarningsReleaseDateInteger, _endDateForEarningsReleasesSubscription, this.state.companyConfirmedEarnRelOnly);
            if (_handle1.ready() && Meteor.subscribe("ratingScales").ready() && Meteor.subscribe("allStockNames").ready()) {
                data.earningsReleasesSubscriptionReady = true;
            }
        }

        return data;
    }

    setDatepickerOptions() {
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
    }
    convertQuandlFormatNumberDateToDateStringWithSlashes(_dateStringWithNoSlashesAsNumber) {
        _dateStringWithNoSlashesAsNumber = _dateStringWithNoSlashesAsNumber.toString();
        var _year = _dateStringWithNoSlashesAsNumber.substring(0,4);
        var _month = _dateStringWithNoSlashesAsNumber.substring(4,6);
        var _day = _dateStringWithNoSlashesAsNumber.substring(6,8);
        return _month + "/" + _day + "/" + _year;
    }

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

    }

    toggleCompanyConfirmedOnly() {
        this.setState({
            companyConfirmedEarnRelOnly: !this.state.companyConfirmedEarnRelOnly
        });
    }

    render() {
        let _compOnlyBtnClass = "btn btn-default" + (this.state.companyConfirmedEarnRelOnly ? " active" : "");

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
                            <button className={ _compOnlyBtnClass } onClick={this.toggleCompanyConfirmedOnly}>Company Confirmed Only</button>
                            <br/>
                            <br/>
                        </div>
                    ) : null
                ) : null}
                {this.data.earningsReleasesSubscriptionReady ? <UpcomingEarningsButtonsAndSelectedSymbol /> : "getting upcoming earnings releases."}
                <br/>
            </div>
        );
    }
}