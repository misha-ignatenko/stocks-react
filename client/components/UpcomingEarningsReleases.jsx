import React, { useState, useEffect } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import moment from 'moment-timezone';
import 'react-dates/initialize';
import { DateRangePicker } from 'react-dates';
import 'react-dates/lib/css/_datepicker.css';

import UpcomingEarningsButtonsAndSelectedSymbol from "./UpcomingEarnings/UpcomingEarningsButtonsAndSelectedSymbol.jsx";

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
