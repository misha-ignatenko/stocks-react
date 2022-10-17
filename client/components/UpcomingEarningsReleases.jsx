import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import moment from 'moment-timezone';

import UpcomingEarningsButtonsAndSelectedSymbol from "./UpcomingEarnings/UpcomingEarningsButtonsAndSelectedSymbol.jsx";

let _allowQuandlPullEveryNdaysFromPreviousForThatStock = 3;
const companyConfirmedEarnRelOnly = new ReactiveVar(true);
const startEarningsReleaseDateInteger = new ReactiveVar(parseInt(moment(new Date().toISOString()).format("YYYYMMDD")));
const endEarningsReleaseDateInteger = new ReactiveVar(parseInt(moment(new Date().toISOString()).add(10, 'days').format("YYYYMMDD")));

const getEndDate = (data) => {
    return data.currentUser ?
        endEarningsReleaseDateInteger.get() :
        parseInt(moment(new Date().toISOString())
            .add(data.settings.clientSettings.upcomingEarningsReleases.numberOfDaysFromTodayForEarningsReleasesPublicationIfNoUser, 'days')
            .format("YYYYMMDD")
        );
};

const getEarnRelParams = (data) => {
    return {
        startDate: startEarningsReleaseDateInteger.get(),
        endDate: getEndDate(data),
        companyConfirmedOnly: companyConfirmedEarnRelOnly.get(),
    };
};

class UpcomingEarningsReleases extends Component {

    constructor(props) {
        super(props);

        let _ratingChangesDateFormat = "YYYY-MM-DD";

        this.state = {
            earningsReleasesSubscriptionReady: false,
            earningsReleases: [],
            startDateRatingChanges: moment(new Date().toISOString()).subtract(90, 'days').format(_ratingChangesDateFormat),
            endDateRatingChanges: moment(new Date().toISOString()).format(_ratingChangesDateFormat),
            ratingChangesSubscriptionHandles: {}
        };

        this.convertQuandlFormatNumberDateToDateStringWithSlashes = this.convertQuandlFormatNumberDateToDateStringWithSlashes.bind(this);
        this.setDatepickerOptions = this.setDatepickerOptions.bind(this);
    }

    setDatepickerOptions() {
        let _datepickerOptions = {
            autoclose: true,
            todayHighlight: true,
            orientation: "top auto"
        };
        $('#startEarningsReleaseDateInteger').datepicker(_datepickerOptions);
        $('#endEarningsReleaseDateInteger').datepicker(_datepickerOptions);
        $('#startEarningsReleaseDateInteger').val(this.convertQuandlFormatNumberDateToDateStringWithSlashes(startEarningsReleaseDateInteger.get()));
        $('#endEarningsReleaseDateInteger').val(this.convertQuandlFormatNumberDateToDateStringWithSlashes(endEarningsReleaseDateInteger.get()));
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
        companyConfirmedEarnRelOnly.set(!companyConfirmedEarnRelOnly.get());
    }
    componentWillReceiveProps(nextProps) {
        const that = this;
        if (nextProps.earnRelPromise) {
            nextProps.earnRelPromise.then(res => {
                that.setState({
                    earningsReleases: res,
                    earningsReleasesSubscriptionReady: true,
                });
            })
        }
    }

    render() {
        let _compOnlyBtnClass = "btn btn-light" + (companyConfirmedEarnRelOnly.get() ? " active" : "");

        return (
            <div className="container">
                { this.props.currentUser ? (
                    this.props.currentUser.registered ? (
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
                {this.state.earningsReleasesSubscriptionReady ?
                    <UpcomingEarningsButtonsAndSelectedSymbol
                        earningsReleases={this.state.earningsReleases}
                    /> :
                    "getting upcoming earnings releases."
                }
                <br/>
            </div>
        );
    }
}

export default withTracker((props) => {
    const user = Meteor.user({fields: {registered: 1}});
    const settings = Settings.findOne();
    //check if EXP_RPT_DATE_QR1 or EXP_RPT_DATE_QR2 exist inside earningreleases collection
    //TODO: need code for EXP_RPT_DATE_QR3 and EXP_RPT_DATE_QR4

    var data = {
        currentUser: user,
        settings,
    };
    if (settings) {
        data.earnRelPromise = Meteor.callNoCb(
            'getUpcomingEarningsReleases',
            getEarnRelParams(data)
        );
    }

    return data;
})(UpcomingEarningsReleases);