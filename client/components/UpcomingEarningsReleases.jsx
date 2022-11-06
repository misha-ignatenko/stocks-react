import React, { Component, useState, useEffect } from 'react';
import {
    withTracker,
    useTracker,
} from 'meteor/react-meteor-data';
import moment from 'moment-timezone';
import 'react-dates/initialize';
import { DateRangePicker } from 'react-dates';
import 'react-dates/lib/css/_datepicker.css';

import UpcomingEarningsButtonsAndSelectedSymbol from "./UpcomingEarnings/UpcomingEarningsButtonsAndSelectedSymbol.jsx";

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

class UpcomingEarningsReleasesDeprecated extends Component {

    constructor(props) {
        super(props);

        this.state = {
            earningsReleasesSubscriptionReady: false,
            earningsReleases: [],
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

    toggleCompanyConfirmedOnly() {
        companyConfirmedEarnRelOnly.set(!companyConfirmedEarnRelOnly.get());
    }
    attachPromise(props, context) {
        if (props.earnRelPromise) {
            props.earnRelPromise.then(res => {
                context.setState({
                    earningsReleases: res,
                    earningsReleasesSubscriptionReady: true,
                });
            })
        }
    }
    componentWillReceiveProps(nextProps) {
        this.attachPromise(nextProps, this);
    }
    componentDidMount() {
        this.attachPromise(this.props, this);
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
})(UpcomingEarningsReleasesDeprecated);

export const UpcomingEarningsReleases = (props) => {
    const [earningsReleases, setEarningsReleases] = useState([]);
    const [loadingEarningsReleases, setLoadingEarningsReleases] = useState(false);

    const user = useTracker(() => Meteor.user({fields: {registered: 1}}), []);
    const settings = useTracker(() => Settings.findOne(), []);

    const format = 'YYYYMMDD';
    const [startDate, setStartDate] = useState(moment());
    const [endDate, setEndDate] = useState(undefined);
    const [companyConfirmedOnly, setCompanyConfirmedOnly] = useState(true);
    const [focusedInput, setFocusedInput] = useState(null);

    useTracker(() => {
        if (user || settings) {
            const daysToAdd = user ? 10 : settings.clientSettings.upcomingEarningsReleases.numberOfDaysFromTodayForEarningsReleasesPublicationIfNoUser;
            setEndDate(moment().add(daysToAdd, 'days'));
        }
    }, [
        user,
        settings,
    ]);

    useEffect(() => {
        if (settings && endDate && !loadingEarningsReleases && !focusedInput) {
            setLoadingEarningsReleases(true);
            Meteor.call(
                'getUpcomingEarningsReleases',
                {
                    startDate: +startDate.format(format),
                    endDate: +endDate.format(format),
                    companyConfirmedOnly,
                },
                (err, res) => {
                    if (!err) {
                        setEarningsReleases(res);
                        setLoadingEarningsReleases(false);
                    }
                }
            );
        }
    }, [
        user,
        settings,
        startDate,
        endDate,
        companyConfirmedOnly,
        focusedInput,
    ]);

    const toggleCompanyConfirmedOnly = () => setCompanyConfirmedOnly(!companyConfirmedOnly);

    if (loadingEarningsReleases) return 'getting upcoming earnings releases.';

    return (<div>
        <DateRangePicker
            startDate={startDate}
            startDateId='s_id'
            endDate={endDate}
            endDateId='e_id'
            onDatesChange={({ startDate, endDate }) => { setStartDate(startDate); setEndDate(endDate); }}
            focusedInput={focusedInput}
            onFocusChange={e => setFocusedInput(e)}
            displayFormat='MM/DD/YYYY'
            minimumNights={0}
        />
        {user?.registered && <button
            className={ 'btn btn-light' + (companyConfirmedOnly ? ' active' : '') }
            onClick={toggleCompanyConfirmedOnly}>
                Company Confirmed Only
            </button>
        }
        <UpcomingEarningsButtonsAndSelectedSymbol
            earningsReleases={earningsReleases}
        />
    </div>);
};
