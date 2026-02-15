import React, { useState, useEffect, useCallback } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import moment from 'moment-timezone';
import _ from 'underscore';
import { Meteor } from 'meteor/meteor';
import { Settings, RatingScales } from '../../../lib/collections.js';
import { Utils } from '../../../lib/utils.js';

import StocksGraph from '../StocksGraph.jsx';
import RegressionPerformance from './RegressionPerformance.jsx';

function AverageAndWeightedRatings({
    symbol,
    showAvgRatings,
    showWeightedRating,
    earningsReleases
}) {
    // Local state
    const [pxRollingDays] = useState(50);
    const [pctDownPerDay, setPctDownPerDay] = useState(0.5);
    const [pctUpPerDay, setPctUpPerDay] = useState(0.5);
    const [stepSizePow, setStepSizePow] = useState(-7);
    const [regrIterNum, setRegrIterNum] = useState(30);
    const [priceReactionDelayDays, setPriceReactionDelayDays] = useState(0);

    const [avgRatingStartDate, setAvgRatingStartDate] = useState(undefined);
    const [avgRatingEndDate, setAvgRatingEndDate] = useState(undefined);
    const [allStockPrices, setAllStockPrices] = useState(undefined);
    const [simpleRollingPx, setSimpleRollingPx] = useState(undefined);
    const [ratingChangesLoading, setRatingChangesLoading] = useState(false);
    const [ratingChanges, setRatingChanges] = useState([]);
    const [regrWeights, setRegrWeights] = useState(undefined);

    // Get settings
    const { settings } = useTracker(() => {
        return {
            settings: Settings.findOne()
        };
    }, []);

    // Initialize avgRatingEndDate on mount
    useEffect(() => {
        const initEndDate = async () => {
            if (settings) {
                const fourPmInEstTimeString = settings?.clientSettings?.ratingChanges?.fourPmInEstTimeString || "16:00:00";
                const endDate = await Utils.getClosestPreviousWeekDayDateByCutoffTime(fourPmInEstTimeString);
                setAvgRatingEndDate(endDate);
            }
        };
        initEndDate();
    }, [settings]);

    // Load prices when symbol changes
    useEffect(() => {
        if (!symbol) return;

        setAllStockPrices(undefined);
        setAvgRatingStartDate(undefined);

        Meteor.call("getPricesForSymbol", symbol, (err1, pricesResult) => {
            Meteor.call("getEarliestRatingChange", symbol, (err2, earliestChange) => {
                if (pricesResult && pricesResult.length > 0 && earliestChange && !err1 && !err2) {
                    const rollingPx = Utils.stockPrices.getSimpleRollingPx(pricesResult, earliestChange, pxRollingDays);
                    setAvgRatingStartDate(earliestChange);
                    setAllStockPrices(pricesResult);
                    setSimpleRollingPx(rollingPx);
                } else {
                    console.log("error in prices or rating changes");
                }
            });
        });
    }, [symbol, pxRollingDays]);

    // Load rating changes when dates change
    useEffect(() => {
        if (!settings || !avgRatingStartDate || !avgRatingEndDate) return;

        setRatingChangesLoading(true);
        setRatingChanges([]);

        Meteor.call(
            'ratingChangesForSymbol',
            { symbol, startDate: avgRatingStartDate, endDate: avgRatingEndDate },
            (err, res) => {
                if (!err) {
                    setRatingChanges(res);
                } else {
                    console.log('there was an error', err);
                }
                setRatingChangesLoading(false);
            }
        );
    }, [symbol, avgRatingStartDate, avgRatingEndDate, settings]);

    // Helper functions
    const hsv2rgb = useCallback((h, s, v) => {
        let rgb, i, data = [];
        if (s === 0) {
            rgb = [v, v, v];
        } else {
            h = h / 60;
            i = Math.floor(h);
            data = [v * (1 - s), v * (1 - s * (h - i)), v * (1 - s * (1 - (h - i)))];
            switch (i) {
                case 0: rgb = [v, data[2], data[0]]; break;
                case 1: rgb = [data[1], v, data[0]]; break;
                case 2: rgb = [data[0], v, data[2]]; break;
                case 3: rgb = [data[0], data[1], v]; break;
                case 4: rgb = [data[2], data[0], v]; break;
                default: rgb = [v, data[0], data[1]]; break;
            }
        }
        return '#' + rgb.map(x => ("0" + Math.round(x * 255).toString(16)).slice(-2)).join('');
    }, []);

    const changingStart = (date) => {
        const newDate = StocksReact.ui.getStateForDateRangeChangeEvent(false, date);
        setAvgRatingStartDate(newDate);
    };

    const changingEnd = (date) => {
        const newDate = StocksReact.ui.getStateForDateRangeChangeEvent(false, date);
        setAvgRatingEndDate(newDate);
    };

    const graphData = useTracker(() => {
        if (!allStockPrices || !settings || !avgRatingStartDate || !avgRatingEndDate || ratingChangesLoading) {
            return null;
        }

        const pricesReady = allStockPrices?.[0]?.symbol === symbol;
        if (!pricesReady || ratingChanges.length === 0) {
            return null;
        }

        const ratingScalesHandle = StocksReact.functions.getRatingScalesHandleFromAvailableRatingChanges(ratingChanges);
        if (!ratingScalesHandle.ready()) {
            return null;
        }

        // Check for missing adjClose
        const pricesWithNoAdjClose = _.filter(allStockPrices, price => !price["adjClose"]);
        if (pricesWithNoAdjClose.length > 0) {
            console.log("ERROR, these price dates do not have adjClose: ", _.pluck(pricesWithNoAdjClose, "dateString"));
        }

        const currentUser = Meteor.user();

        const startDateForSubscription = currentUser
            ? avgRatingStartDate
            : moment(new Date().toISOString())
                .subtract(settings.clientSettings.upcomingEarningsReleases.numberOfDaysBeforeTodayForRatingChangesPublicationIfNoUser, 'days')
                .format("YYYY-MM-DD");

        const allAvailablePricesForSymbol = {
            symbol,
            historicalData: allStockPrices
        };

        const filteredPrices = Utils.stockPrices.getPricesBetween(
            allAvailablePricesForSymbol.historicalData,
            startDateForSubscription,
            avgRatingEndDate
        );

        const result = {
            ...allAvailablePricesForSymbol,
            historicalData: filteredPrices
        };

        // Generate ratings series
        const averageAnalystRatingSeries = Utils.ratingChanges.generateAverageAnalystRatingTimeSeries(
            symbol,
            startDateForSubscription,
            avgRatingEndDate,
            ratingChanges
        );

        const avgRatingsSeriesEveryDay = Utils.ratingChanges.generateAverageAnalystRatingTimeSeriesEveryDay(
            averageAnalystRatingSeries,
            result.historicalData
        );

        // Add debugging
        console.log('avgRatingsSeriesEveryDay:', avgRatingsSeriesEveryDay);

        const weightedRatingsResult = Utils.ratingChanges.generateWeightedAnalystRatingsTimeSeriesEveryDay(
            avgRatingsSeriesEveryDay,
            startDateForSubscription,
            avgRatingEndDate,
            result.historicalData,
            priceReactionDelayDays,
            "adjClose",
            pctDownPerDay,
            pctUpPerDay,
            Math.pow(10, stepSizePow),
            regrIterNum
        );

        // Update regression weights in state (outside of useTracker)
        if (weightedRatingsResult?.weights !== regrWeights) {
            setRegrWeights(weightedRatingsResult.weights);
        }

        const weightedRatingsSeriesEveryDay = weightedRatingsResult.ratings;

        const predictionsBasedOnAvgRatings = Utils.ratingChanges.predictionsBasedOnRatings(
            _.map(avgRatingsSeriesEveryDay, obj => ({
                date: obj.date,
                rating: obj.avg,
                dateString: obj.date.toISOString().substring(0, 10)
            })),
            result.historicalData,
            "adjClose",
            simpleRollingPx,
            0, 120, 60,
            pctDownPerDay,
            pctUpPerDay
        );

        const predictionsBasedOnWeightedRatings = Utils.ratingChanges.predictionsBasedOnRatings(
            _.map(weightedRatingsSeriesEveryDay, obj => ({
                date: obj.date,
                rating: obj.weightedRating,
                dateString: obj.date.toISOString().substring(0, 10)
            })),
            result.historicalData,
            "adjClose",
            simpleRollingPx,
            0, 120, 60,
            pctDownPerDay,
            pctUpPerDay
        );

        let objToGraph = { ...result };

        if (showAvgRatings && showWeightedRating) {
            objToGraph = {
                ...objToGraph,
                avgAnalystRatingsEveryDay: avgRatingsSeriesEveryDay,
                weightedAnalystRatingsEveryDay: weightedRatingsSeriesEveryDay,
                predictionsBasedOnWeightedRatings,
                predictionsBasedOnAvgRatings
            };
        } else if (showAvgRatings) {
            objToGraph = {
                ...objToGraph,
                avgAnalystRatingsEveryDay: avgRatingsSeriesEveryDay,
                predictionsBasedOnAvgRatings
            };
        } else if (showWeightedRating) {
            objToGraph = {
                ...objToGraph,
                weightedAnalystRatingsEveryDay: weightedRatingsSeriesEveryDay,
                predictionsBasedOnWeightedRatings
            };
        }

        // Add more debugging
        console.log('objToGraph:', objToGraph);
        console.log('objToGraph.avgAnalystRatingsEveryDay:', objToGraph.avgAnalystRatingsEveryDay);

        return {
            stocksToGraphObjs: [JSON.parse(JSON.stringify(objToGraph))],
            stockPrices: filteredPrices,
            ratingScales: RatingScales.find().fetch(),
            allGraphData: {
                ...result,
                avgAnalystRatingsEveryDay: avgRatingsSeriesEveryDay,
                weightedAnalystRatingsEveryDay: weightedRatingsSeriesEveryDay
            }
        };
    }, [
        allStockPrices,
        settings,
        avgRatingStartDate,
        avgRatingEndDate,
        ratingChanges,
        ratingChangesLoading,
        symbol,
        priceReactionDelayDays,
        pctDownPerDay,
        pctUpPerDay,
        stepSizePow,
        regrIterNum,
        simpleRollingPx,
        showAvgRatings,
        showWeightedRating
    ]);

    const renderAvgAnalystRatingsGraph = () => {
        if (!graphData || ratingChanges.length === 0) return null;

        const stepSize = Math.pow(10, stepSizePow);

        return (
            <div>
                <span>price reaction delay for rating changes (in days): {priceReactionDelayDays} </span>
                <button type="button" className="btn btn-light" onClick={() => setPriceReactionDelayDays(prev => prev - 1)}>-</button>
                <button type="button" className="btn btn-light" onClick={() => setPriceReactionDelayDays(prev => prev + 1)}>+</button>
                <input
                    type="text"
                    className="pctDownPerDay"
                    placeholder={pctDownPerDay}
                    onBlur={(e) => setPctDownPerDay(parseFloat(e.target.value))}
                />
                <input
                    type="text"
                    className="pctUpPerDay"
                    placeholder={pctUpPerDay}
                    onBlur={(e) => setPctUpPerDay(parseFloat(e.target.value))}
                />
                <br/>
                increase/decrease step size: {stepSize}{' '}
                <button className="btn btn-light" onClick={() => setStepSizePow(prev => prev - 1)}>-</button>
                <button className="btn btn-light" onClick={() => setStepSizePow(prev => prev + 1)}>+</button>
                # of regression iter:{' '}
                <input
                    type="text"
                    placeholder={regrIterNum}
                    onBlur={(e) => setRegrIterNum(parseInt(e.target.value))}
                />

                {avgRatingStartDate && (
                    <DatePicker
                        selected={new Date(moment(avgRatingStartDate))}
                        onChange={changingStart}
                    />
                )}
                {avgRatingEndDate && (
                    <DatePicker
                        selected={new Date(moment(avgRatingEndDate))}
                        onChange={changingEnd}
                    />
                )}

                <div className="col-md-12 individualStockGraph">
                    <StocksGraph stocksToGraphObjects={graphData.stocksToGraphObjs} />
                </div>
            </div>
        );
    };

    const renderEpsMeanEstimates = () => {
        return earningsReleases.map((release, index) => {
            const sourceFlag = release.reportSourceFlag;
            const timeOfDayCode = release.reportTimeOfDayCode;
            const key = `${release.symbol}_${index}`;

            return (
                <div key={key}>
                    <h1>This quarter</h1>
                    <h1>
                        Next earning release date: {release.reportDateNextFiscalQuarter} (
                        {sourceFlag === 1 ? "Company confirmed" :
                         sourceFlag === 2 ? "Estimated based on algorithm" :
                         sourceFlag === 3 ? "Unknown" : null},&nbsp;
                        {timeOfDayCode === 1 ? "After market close" :
                         timeOfDayCode === 2 ? "Before the open" :
                         timeOfDayCode === 3 ? "During market trading" :
                         timeOfDayCode === 4 ? "Unknown" : null})
                    </h1>
                    <h1>Expected EPS: {release.epsMeanEstimateNextFiscalQuarter}</h1>
                    <br/>
                    <h3>Previous quarter EPS: {release.epsActualPreviousFiscalQuarter}</h3>
                    <h3>EPS a year ago: {release.epsActualOneYearAgoFiscalQuarter}</h3>
                    <br/>
                    <h5>Next quarter</h5>
                    <h5>Report date: {release.reportDateNextNextFiscalQuarter}</h5>
                </div>
            );
        });
    };

    const isReady = allStockPrices?.[0]?.symbol === symbol && !ratingChangesLoading;

    return (
        <div>
            <br/>
            <div>
                {isReady ? (
                    <div>
                        {renderAvgAnalystRatingsGraph()}
                        <br/><br/><br/><br/>
                        <RegressionPerformance symbol={symbol} />
                        <br/>
                        {renderEpsMeanEstimates()}
                        <br/>
                    </div>
                ) : (
                    `getting ratings changes and prices for ${symbol}`
                )}
            </div>
        </div>
    );
}

export default AverageAndWeightedRatings;
