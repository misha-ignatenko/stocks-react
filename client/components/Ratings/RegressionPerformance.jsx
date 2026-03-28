import React, { useState, useEffect } from "react";
import { useTracker } from "meteor/react-meteor-data";
import moment from "moment-timezone";
import _ from "underscore";
import { Meteor } from "meteor/meteor";
import { Settings } from "../../../lib/collections.js";
import { Utils } from "../../../lib/utils.js";

import StocksGraph from "../StocksGraph.jsx";

function RegressionPerformance({ symbol }) {
    const [regressionPerformance, setRegressionPerformance] =
        useState(undefined);
    const [rollingNum] = useState(50);

    // Get settings
    const { settings } = useTracker(() => {
        return {
            settings: Settings.findOne(),
        };
    }, []);

    // Load regression performance when symbol or settings change
    useEffect(() => {
        if (!settings || !symbol) return;

        const loadRegressionPerformance = async () => {
            console.log("mounting", symbol);

            const maxDateForRatingChanges =
                await Utils.getClosestPreviousWeekDayDateByCutoffTime(
                    moment().tz("America/New_York").subtract(70, "days"),
                );
            const lastPriceDate =
                await Utils.getClosestPreviousWeekDayDateByCutoffTime();

            Meteor.call(
                "getRegressionPerformance",
                symbol,
                maxDateForRatingChanges,
                lastPriceDate,
                (err, res) => {
                    if (err) {
                        console.log(err);
                    } else {
                        setRegressionPerformance(res);
                    }
                },
            );
        };

        loadRegressionPerformance();
    }, [symbol, settings]);

    const pctDiff = (oldVal, newVal) => {
        return (
            newVal && oldVal && (((newVal - oldVal) / oldVal) * 100).toFixed(2)
        );
    };

    if (!regressionPerformance) {
        return <div className="row">Regression performance loading...</div>;
    }

    const data = regressionPerformance;
    const altAvg = data.altAvg;
    const altWgt = data.altWgt;
    const regrStartDate = data.regrStartDate;
    const regrStartPxActual = _.find(
        data.px,
        (p) => p.dateString === regrStartDate,
    )?.adjClose;
    const actualStartPrice = data.actualStart.adjClose;
    const actualEndPrice = data.actualEnd.adjClose;
    const actualPct = (
        ((actualEndPrice - actualStartPrice) / actualStartPrice) *
        100
    ).toFixed(2);

    // Rolling
    const rollingRegrStart = data.rollingRegrStart.toFixed(2);
    const rollingRegrEnd = data.rollingRegrEnd.toFixed(2);
    const rollingPriceCheck = data.rollingPriceCheck.toFixed(2);

    console.log(data);

    // Avg
    const avgStart =
        altAvg &&
        _.find(
            altAvg,
            (avgPrediction) =>
                avgPrediction.dateString === data.actualStart.dateString,
        )?.price.toFixed(2);
    const avgEnd = altAvg && altAvg[altAvg.length - 1].price.toFixed(2);
    const avgPct = altAvg && pctDiff(avgStart, avgEnd);

    // Wgt
    const altRegrStart =
        altWgt &&
        _.find(
            altWgt,
            (regrPrediction) =>
                regrPrediction.dateString === data.actualStart.dateString,
        )?.price.toFixed(2);
    const altRegrEnd = altWgt && altWgt[altWgt.length - 1].price.toFixed(2);
    const altRegrPct = (
        ((altRegrEnd - actualStartPrice) / actualStartPrice) *
        100
    ).toFixed(2);
    const altRegrPct2 = pctDiff(altRegrStart, altRegrEnd);

    const graphData = [
        {
            symbol: symbol,
            historicalData: data.px,
            avgAnalystRatingsEveryDay: _.map(data.avgRatingsExtended, (r) => ({
                ...r,
                avg: r.rating,
            })),
            weightedAnalystRatingsEveryDay: _.map(
                data.wgtRatingsExtended,
                (r) => ({
                    ...r,
                    weightedRating: r.rating,
                }),
            ),
            predictionsBasedOnWeightedRatings: altWgt,
            predictionsBasedOnAvgRatings: altAvg,
        },
    ];

    return (
        <div className="row">
            Regression stats for: {symbol}
            <p>
                If you ran a regression on <b>{data.actualStart.dateString}</b>{" "}
                (avg rating{" "}
                <b>
                    {data.avgRatingsDaily[
                        data.avgRatingsDaily.length - 1
                    ].avg.toFixed(2)}
                </b>
                ), weighted rating (calculated via regression) would have been:{" "}
                <b>
                    {data.wgtRatingsDaily[
                        data.wgtRatingsDaily.length - 1
                    ].weightedRating.toFixed(2)}
                </b>
                <br />
                Based on rating changes from{" "}
                <b>{data.earliestRatingChangeDate}</b> to{" "}
                <b>{data.latestRatingChangeDate}</b>.
                <br />
                With <b>0.5</b> max downside, <b>0.5</b> max upside per day and{" "}
                <b>{rollingNum}</b> rolling num, the prices predicted would be
                as follows:
            </p>
            <table>
                <thead>
                    <tr>
                        <th>type</th>
                        <th>{regrStartDate}&nbsp;&nbsp;&nbsp;&nbsp;</th>
                        <th>
                            {data.actualStart.dateString}
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        </th>
                        <th>
                            {data.actualEnd.dateString}&nbsp;&nbsp;&nbsp;&nbsp;
                        </th>
                        <th>
                            % up/dn (from {data.actualStart.dateString}
                            )&nbsp;&nbsp;&nbsp;&nbsp;
                        </th>
                        <th>% up/dn (from actual)&nbsp;&nbsp;&nbsp;&nbsp;</th>
                        <th>% up/dn (from rolling)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>actual</td>
                        <td>{regrStartPxActual}</td>
                        <td>{actualStartPrice}</td>
                        <td>{actualEndPrice}</td>
                        <td>{actualPct}</td>
                        <td>{pctDiff(actualEndPrice, actualEndPrice)}</td>
                        <td>{pctDiff(rollingPriceCheck, actualEndPrice)}</td>
                    </tr>
                    <tr>
                        <td>rolling price ({rollingNum})</td>
                        <td>{rollingRegrStart}</td>
                        <td>{rollingRegrEnd}</td>
                        <td>{rollingPriceCheck}</td>
                        <td>{pctDiff(rollingRegrEnd, rollingPriceCheck)}</td>
                        <td>{pctDiff(actualEndPrice, rollingPriceCheck)}</td>
                        <td>{pctDiff(rollingPriceCheck, rollingPriceCheck)}</td>
                    </tr>
                    <tr>
                        <td>avg ratings&nbsp;&nbsp;&nbsp;&nbsp;</td>
                        <td>{rollingRegrStart}</td>
                        <td>{avgStart}</td>
                        <td>{avgEnd}</td>
                        <td>{avgPct}</td>
                        <td>
                            <b>{pctDiff(actualEndPrice, avgEnd)}</b>
                        </td>
                        <td>
                            <b>{pctDiff(rollingPriceCheck, avgEnd)}</b>
                        </td>
                    </tr>
                    <tr>
                        <td>wgt ratings</td>
                        <td>{rollingRegrStart}</td>
                        <td>{altRegrStart}</td>
                        <td>{altRegrEnd}</td>
                        <td>{altRegrPct2}</td>
                        <td>
                            <b>{pctDiff(actualEndPrice, altRegrEnd)}</b>
                        </td>
                        <td>
                            <b>{pctDiff(rollingPriceCheck, altRegrEnd)}</b>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div className="col-md-12 individualStockGraph">
                <StocksGraph stocksToGraphObjects={graphData} />
            </div>
        </div>
    );
}

export default RegressionPerformance;
