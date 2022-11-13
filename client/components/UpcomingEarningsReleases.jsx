import React, { useState, useEffect } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import moment from 'moment-timezone';
import 'react-dates/initialize';
import { DateRangePicker } from 'react-dates';
import 'react-dates/lib/css/_datepicker.css';

import AverageAndWeightedRatings from './Ratings/AverageAndWeightedRatings';
import _ from 'underscore';

export const UpcomingEarningsReleases = (props) => {
    const [earningsReleases, setEarningsReleases] = useState([]);
    const [groupedEarningsReleases, setGroupedEarningsReleases] =  useState([]);
    const [loadingEarningsReleases, setLoadingEarningsReleases] = useState(false);
    const [showAll, setShowAll] = useState(true);

    const user = useTracker(() => Meteor.user({fields: {registered: 1}}), []);
    const settings = useTracker(() => Settings.findOne(), []);

    const format = 'YYYYMMDD';
    const [startDate, setStartDate] = useState(moment());
    const [endDate, setEndDate] = useState(undefined);
    const [companyConfirmedOnly, setCompanyConfirmedOnly] = useState(true);
    const [focusedInput, setFocusedInput] = useState(null);

    const [selectedStock, setSelectedStock] = useState(undefined);
    const [relevantEarningsReleases, setRelevantEarningsReleases] = useState([]);

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
            setSelectedStock(undefined);
            setRelevantEarningsReleases([]);
            Meteor.call(
                'getUpcomingEarningsReleases',
                {
                    startDate: +startDate.format(format),
                    endDate: +endDate.format(format),
                    companyConfirmedOnly,
                    sortDirection: 'ascReportDate',
                },
                (err, res) => {
                    if (!err) {
                        setEarningsReleases(res);

                        const stocks = _.pluck(res, 'symbol');
                        const stock = stocks[0];
                        setSelected(stock, res);

                        const grouped = _.values(_.groupBy(res, e => e.index));
                        setGroupedEarningsReleases(grouped);

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

    const setSelected = (stock, releases=earningsReleases) => {
        const releasesPerStock = stock ? releases.filter(e => e.symbol === stock) : [];
        setSelectedStock(stock);
        setRelevantEarningsReleases(releasesPerStock);
    }

    const toggleCompanyConfirmedOnly = () => setCompanyConfirmedOnly(!companyConfirmedOnly);
    const toggleShowAll = () => setShowAll(!showAll);

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
        <button
            className={ 'btn btn-light' + (showAll ? ' active' : '') }
            onClick={toggleShowAll}>
                Show All Symbols
            </button>
        {showAll ?
            <div>
                {groupedEarningsReleases.map((group, index) => {
                    const uniqueRel = _.uniq(group, false, e=>e.symbol);
                    return <div key={index}>
                        <h5>{group[0].fullTimeOfDayDescription} ({uniqueRel.length})</h5>
                        <div style={{display: 'flex', overflowX: 'scroll'}}>
                        {uniqueRel.map((e) => {
                            const stock = e.symbol;
                            const isSelected = stock === selectedStock;
                            const className = 'btn btn-light' + (isSelected ? ' active' : '');
                            return <button key={stock} className={className} onClick={() => setSelected(stock)}>
                                {stock}
                            </button>;
                        })}
                        </div>
                    </div>;
                })}
            </div> : null
        }
        {earningsReleases.length ?
            null :
            <h3>there are no earnings releases.</h3>
        }
        {relevantEarningsReleases.length ? <AverageAndWeightedRatings
            earningsReleases={relevantEarningsReleases}
            symbol={selectedStock}
            showAvgRatings={true}
            showWeightedRating={true}
            /> : null
        }
    </div>);
};
