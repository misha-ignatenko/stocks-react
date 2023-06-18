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

    const getEarningsReleases = () => {
        if (settings && endDate && !loading && !focusedInput) {
            setLoading(true);
            Meteor.call(
                'getEarningsAnalysis',
                {
                    // symbol: 'AAPL',
                    startDate: startDate.format(format),
                    endDate: endDate.format(format),
                    // advancePurchaseDays: 1,

                    saleDelayInDays: 2,
                    // saleDelayInDays: 5,
                    saleDelayInDaysFinal: 10,

                    // ratingChangesLookbackInDays: 750,
                    ratingChangesLookbackInDays: 500,

                    // isForecast: true,

                    // includeHistory: true,
                    // bizDaysLookbackForHistory: 1000,
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
    };

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
        <button type='button' className='btn btn-light' onClick={getEarningsReleases}>
            Get Earnings Releases
        </button>
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
                        <th>Is After Mkt Close</th>
                        <th>Qt</th>
                        <th>Symbol</th>
                        <th>Co Name</th>
                        <th>Average Rating (0-120)</th>
                        <th># of Ratings</th>
                        <th>Avg R. Ch. Date</th>
                        <th>Alt R (adj r)</th>
                        <th># Recent Downgr</th>
                        <th># Recent Upgr</th>
                        <th>1st Eps Exp</th>
                        <th>% Exp / 1st Exp</th>
                        <th>1st Eps Exp Date</th>
                        <th>Prior Sale Date</th>
                        <th>Prior Sale Price</th>
                        <th>Prior SMA 50</th>
                        <th>Prior SMA 200</th>
                        <th>Exp EPS</th>
                        <th>Act EPS</th>
                        <th>Exp EPS Next Qt</th>
                        <th>Act EPS (prev qt)</th>
                        <th>Exp / prev qt</th>
                        <th>% Exp / prev qt</th>
                        <th>Act EPS (1 yr ago)</th>
                        <th>Exp / 1 yr</th>
                        <th>% Exp / 1 yr</th>
                        <th>Price Before</th>
                        <th>Before SMA 50</th>
                        <th>Before SMA 200</th>
                        <th>Date Before</th>
                        <th>Price After</th>
                        <th>After / Before</th>
                        <th>Date After</th>
                        <th>Price Later</th>
                        <th>Later / Before</th>
                        <th>Date Later</th>
                        <th>Price Latest</th>
                        <th>Latest / Before</th>
                        <th>Date Latest</th>
                        <th>vooOpenPriceOnPurchaseDate</th>
                        <th>vooSMA</th>
                        <th>vooSMA50DaysAgo</th>
                        <th>vooSMA200DaysAgo</th>
                    </tr>
                </thead>

                <tbody>
                    {earningsReleases.map((row) => {
                        const {
                            reportDate,
                            isAfterMarketClose,
                            endDateNextFiscalQuarter,
                            symbol,
                            companyName,
                            originalEpsExpectation,
                            pctExpEpsOverOriginalEpsExpectation,
                            originalAsOfExpectation,
                            expectedEps,
                            actualEps,
                            expectedEpsNextQt,
                            purchaseDate: dateBeforeRelease,
                            purchasePrice: priceBeforeRelease,
                            purchasePriceSMA50,
                            purchasePriceSMA200,
                            saleDate1: dateAfterRelease,
                            salePrice1: priceAfterRelease,
                            saleDate2: dateLater,
                            salePrice2: priceLater,
                            saleDate3: dateLatest,
                            salePrice3: priceLatest,
                            priorSaleDate,
                            priorSalePrice,
                            priorSalePriceSMA50,
                            priorSalePriceSMA200,
                            avgRating,
                            numRatings,
                            numRecentDowngrades,
                            numRecentUpgrades,
                            averageRatingChangeDate,
                            altAvgRatingWithAdjRatings,

                            epsActualPreviousFiscalQuarter,
                            pctExpEpsOverPrevQt,
                            epsActualOneYearAgoFiscalQuarter,
                            pctExpEpsOverOneYearAgo,

                            vooOpenPriceOnPurchaseDate,
                            vooSMA,
                            vooSMA50DaysAgo,
                            vooSMA200DaysAgo,
                        } = row;
                        const rowKey = symbol + reportDate;

                        return <tr key={rowKey}>
                            <td>{Utils.convertToStringDate(reportDate)}</td>
                            <td>{isAfterMarketClose ? 'Yes' : 'No'}</td>
                            <td>{Utils.convertToStringDate(endDateNextFiscalQuarter)}</td>
                            <td>{symbol}</td>
                            <td>{companyName}</td>
                            <td>{_.isNaN(avgRating) ? null : avgRating.toFixed(2)}</td>
                            <td>{numRatings}</td>
                            <td>{averageRatingChangeDate}</td>
                            <td>{_.isNaN(altAvgRatingWithAdjRatings) ? null : altAvgRatingWithAdjRatings.toFixed(2)}</td>
                            <td>{numRecentDowngrades}</td>
                            <td>{numRecentUpgrades}</td>
                            <td>{originalEpsExpectation?.toFixed(4)}</td>
                            <td>{pctExpEpsOverOriginalEpsExpectation?.toFixed(4)}</td>
                            <td>{originalAsOfExpectation}</td>
                            <td>{priorSaleDate}</td>
                            <td>{priorSalePrice}</td>
                            <td>{priorSalePriceSMA50?.toFixed(2)}</td>
                            <td>{priorSalePriceSMA200?.toFixed(2)}</td>
                            <td>{expectedEps?.toFixed(4)}</td>
                            <td>{actualEps?.toFixed(4)}</td>
                            <td>{expectedEpsNextQt?.toFixed(4)}</td>
                            <td>{epsActualPreviousFiscalQuarter?.toFixed(4)}</td>
                            <td></td>
                            <td>{_.isNumber(pctExpEpsOverPrevQt) ? pctExpEpsOverPrevQt.toFixed(4) : null}</td>
                            <td>{epsActualOneYearAgoFiscalQuarter?.toFixed(4)}</td>
                            <td></td>
                            <td>{_.isNumber(pctExpEpsOverOneYearAgo) ? pctExpEpsOverOneYearAgo.toFixed(4) : null}</td>
                            <td>{priceBeforeRelease?.toFixed(2)}</td>
                            <td>{purchasePriceSMA50?.toFixed(2)}</td>
                            <td>{purchasePriceSMA200?.toFixed(2)}</td>
                            <td>{dateBeforeRelease}</td>
                            <td>{priceAfterRelease?.toFixed(2)}</td>
                            <td>{(priceAfterRelease / priceBeforeRelease).toFixed(4)}</td>
                            <td>{dateAfterRelease}</td>
                            <td>{priceLater?.toFixed(2)}</td>
                            <td>{(priceLater / priceBeforeRelease).toFixed(4)}</td>
                            <td>{dateLater}</td>
                            <td>{priceLatest?.toFixed(2)}</td>
                            <td>{(priceLatest / priceBeforeRelease).toFixed(4)}</td>
                            <td>{dateLatest}</td>



                            <td>{vooOpenPriceOnPurchaseDate?.toFixed(4)}</td>
                            <td>{vooSMA?.toFixed(4)}</td>
                            <td>{vooSMA50DaysAgo?.toFixed(4)}</td>
                            <td>{vooSMA200DaysAgo?.toFixed(4)}</td>
                        </tr>;
                    })}
                </tbody>
            </Table>
        : 'There are no releases in the date range.'}
    </div>);
};
