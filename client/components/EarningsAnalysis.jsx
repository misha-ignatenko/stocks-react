import React, { useState, useEffect } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import moment from 'moment-timezone';
import 'react-dates/initialize';
import { DateRangePicker } from 'react-dates';
import 'react-dates/lib/css/_datepicker.css';
import { Table } from 'reactstrap';

import _ from 'underscore';

export const EarningsAnalysis = (props) => {
    const exportCSV = () => Utils.download_table_as_csv('earningsReleases');

    const [earningsReleases, setEarningsReleases] = useState([]);
    const [loading, setLoading] = useState(false);

    const user = useTracker(() => Meteor.user({fields: {registered: 1}}), []);
    const settings = useTracker(() => Settings.findOne(), []);

    const format = 'YYYY-MM-DD';
    const [startDate, setStartDate] = useState(moment().subtract(14, 'days'));
    const [endDate, setEndDate] = useState(moment().subtract(14, 'days'));
    const [focusedInput, setFocusedInput] = useState(null);

    useEffect(() => {
        if (settings && endDate && !loading && !focusedInput) {
            setLoading(true);
            Meteor.call(
                'getEarningsAnalysis',
                {
                    startDate: startDate.format(format),
                    endDate: endDate.format(format),
                },
                (err, res) => {
                    if (err) {
                        console.log('error: ', err);
                    } else {
                        setEarningsReleases(res);
                        setLoading(false);
                    }
                }
            );
        }
    }, [
        user,
        settings,
        startDate,
        endDate,
        focusedInput,
    ]);

    if (loading) return 'calculating.';

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
            isOutsideRange={(d) => false}
        />
        {earningsReleases.length ?
            <button type='button' className='btn btn-light' onClick={exportCSV}>
                Export as a CSV
            </button> : null
        }
        {earningsReleases.length ?
            <Table id='earningsReleases' bordered>
                <thead>
                    <tr>
                        <th>Release Date</th>
                        <th>Symbol</th>
                        <th>Average Rating (0-120)</th>
                        <th># of Ratings</th>
                        <th>Exp EPS</th>
                        <th>Act EPS</th>
                        <th>Price Before</th>
                        <th>Price After</th>
                        <th>Price Later</th>
                        <th>Date Later</th>
                    </tr>
                </thead>

                <tbody>
                    {earningsReleases.map((row) => {
                        const {
                            reportDate,
                            symbol,
                            expectedEps,
                            actualEps,
                            purchaseDate: dateBeforeRelease,
                            purchasePrice: priceBeforeRelease,
                            saleDate1: dateAfterRelease,
                            salePrice1: priceAfterRelease,
                            saleDate2: dateLater,
                            salePrice2: priceLater,
                            avgRating,
                            numRatings,
                        } = row;
                        const rowKey = symbol;

                        return <tr key={rowKey}>
                            <td>{Utils.convertToStringDate(reportDate)}</td>
                            <td>{symbol}</td>
                            <td>{_.isNaN(avgRating) ? null : avgRating.toFixed(2)}</td>
                            <td>{numRatings}</td>
                            <td>{expectedEps}</td>
                            <td>{actualEps}</td>
                            <td>{priceBeforeRelease.toFixed(2)}</td>
                            <td>{priceAfterRelease.toFixed(2)}</td>
                            <td>{priceLater.toFixed(2)}</td>
                            <td>{dateLater}</td>
                        </tr>;
                    })}
                </tbody>
            </Table>
        : 'There are no releases in the date range.'}
    </div>);
};
