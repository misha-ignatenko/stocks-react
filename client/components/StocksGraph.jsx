import React, { useEffect, useRef } from "react";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import { Utils } from "../../lib/utils";
import _ from "underscore";

function StocksGraph({ stocksToGraphObjects = [] }) {
    const chartComponentRef = useRef(null);

    const convertQuandlFormatNumberDateToDateStringWithSlashes = (
        dateStringWithNoSlashesAsNumber,
    ) => {
        const dateStr = dateStringWithNoSlashesAsNumber.toString();
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${month}/${day}/${year}`;
    };

    const buildChartOptions = (stocksObjectsArray) => {
        console.log(
            "inside initialize chart. stocks object to graph: ",
            stocksObjectsArray,
        );

        if (stocksObjectsArray.length === 0) {
            return null;
        }

        const seriesModel = [];

        stocksObjectsArray.forEach((obj) => {
            const histData = obj.historicalData;
            const minMaxPrice = Utils.getMinMaxFromArrOfObj(
                obj.historicalData,
                "adjClose",
            );
            const maxPrice = minMaxPrice[1];
            const minPrice = minMaxPrice[0];

            if (histData) {
                const seriesDataArray = histData.map((data) => [
                    new Date(data.date).valueOf(),
                    data.adjClose,
                ]);

                seriesModel.push({
                    name: obj.stockId || obj.symbol || "stock name unknown",
                    data: seriesDataArray,
                    tooltip: {
                        valueDecimals: 2,
                    },
                    id: "dataseries",
                });

                // Predictions based on avg ratings
                if (
                    obj.predictionsBasedOnAvgRatings &&
                    obj.predictionsBasedOnAvgRatings.length > 2
                ) {
                    seriesModel.push({
                        name: "predicted on avg",
                        data: obj.predictionsBasedOnAvgRatings.map((item) => [
                            new Date(item.date).valueOf(),
                            item.price,
                        ]),
                        tooltip: {
                            valueDecimals: 2,
                        },
                        id: "dataseries",
                    });
                }

                // Predictions based on weighted ratings
                if (
                    obj.predictionsBasedOnWeightedRatings &&
                    obj.predictionsBasedOnWeightedRatings.length > 2
                ) {
                    seriesModel.push({
                        name: "predicted on weighted",
                        data: obj.predictionsBasedOnWeightedRatings.map(
                            (item) => [
                                new Date(item.date).valueOf(),
                                item.price,
                            ],
                        ),
                        tooltip: {
                            valueDecimals: 2,
                        },
                        id: "dataseries",
                    });
                }
            }

            const rangeOfPrices = maxPrice - minPrice;

            // Avg analyst ratings
            const avgAnalystRatings = obj.avgAnalystRatings;
            if (avgAnalystRatings && avgAnalystRatings.length > 2) {
                const minMaxAvgRating = Utils.getMinMaxFromArrOfObj(
                    avgAnalystRatings,
                    "avg",
                );
                const maxRating = minMaxAvgRating[1];
                const minRating = minMaxAvgRating[0];
                const rangeOfAvgRatings = maxRating - minRating;
                const multiplyAllRatingsByCoef =
                    rangeOfPrices / rangeOfAvgRatings;

                const seriesDataArray2 = avgAnalystRatings.map((avgRating) => [
                    new Date(avgRating.date).valueOf(),
                    minPrice +
                        multiplyAllRatingsByCoef * (avgRating.avg - minRating),
                ]);

                seriesModel.push({
                    name: "avg rating",
                    data: seriesDataArray2,
                    type: "spline",
                    tooltip: {
                        valueDecimals: 2,
                    },
                    yAxis: 1,
                });
            }

            // Avg analyst ratings every day
            if (
                obj.avgAnalystRatingsEveryDay &&
                obj.avgAnalystRatingsEveryDay.length > 2
            ) {
                const rangeOfAvgRatingsByDay = Utils.getMinMaxFromArrOfObj(
                    obj.avgAnalystRatingsEveryDay,
                    "avg",
                );
                let coef = 1;
                if (rangeOfAvgRatingsByDay.length > 0) {
                    coef =
                        rangeOfPrices /
                        (rangeOfAvgRatingsByDay[1] - rangeOfAvgRatingsByDay[0]);
                }

                const seriesDataArrayAvgRatingEveryDay =
                    obj.avgAnalystRatingsEveryDay.map((avgRatingEveryDay) => [
                        new Date(avgRatingEveryDay.date).valueOf(),
                        avgRatingEveryDay.avg,
                    ]);

                seriesModel.push({
                    name: "avg rating every day",
                    data: seriesDataArrayAvgRatingEveryDay,
                    type: "spline",
                    tooltip: {
                        valueDecimals: 2,
                    },
                    yAxis: 1,
                });
            }

            // Weighted analyst ratings every day
            if (
                obj.weightedAnalystRatingsEveryDay &&
                obj.weightedAnalystRatingsEveryDay.length > 2
            ) {
                const weightedAnalystRatingsSeries =
                    obj.weightedAnalystRatingsEveryDay.map((weightedRating) => [
                        new Date(weightedRating.date).valueOf(),
                        weightedRating.weightedRating,
                    ]);

                seriesModel.push({
                    name: "weighted rating every day",
                    data: weightedAnalystRatingsSeries,
                    type: "spline",
                    tooltip: {
                        valueDecimals: 2,
                    },
                    yAxis: 1,
                });
            }

            // Earnings releases
            const earningsReleases = obj.earningsReleases;
            if (earningsReleases && earningsReleases.length > 0) {
                const seriesDataArray3 = earningsReleases.map(
                    (earningsRelease) => {
                        const date =
                            convertQuandlFormatNumberDateToDateStringWithSlashes(
                                earningsRelease.reportDateNextFiscalQuarter,
                            );
                        return {
                            x: new Date(date).valueOf(),
                            title: "E",
                            text:
                                earningsRelease.reportTimeOfDayCode === 1
                                    ? "After market close"
                                    : earningsRelease.reportTimeOfDayCode === 2
                                      ? "Before the open"
                                      : earningsRelease.reportTimeOfDayCode ===
                                          3
                                        ? "During market trading"
                                        : "Unknown",
                        };
                    },
                );

                seriesModel.push({
                    type: "flags",
                    data: seriesDataArray3,
                    onSeries: "dataseries",
                    shape: "squarepin",
                    width: 16,
                });
            }
        });

        return {
            xAxis: {
                type: "datetime",
                dateTimeLabelFormats: {
                    second: "%Y-%m-%d<br/>%H:%M:%S",
                    minute: "%Y-%m-%d<br/>%H:%M",
                    hour: "%Y-%m-%d<br/>%H:%M",
                    day: "%Y<br/>%m-%d",
                    week: "%Y<br/>%m-%d",
                    month: "%Y-%m",
                    year: "%Y",
                },
            },
            yAxis: [
                {
                    labels: {
                        format: "${value}",
                    },
                    opposite: false,
                },
                {
                    title: {
                        text: "avg rating",
                    },
                    min: 0,
                    max: 130,
                    plotLines: [
                        {
                            color: "#FF0000",
                            width: 1,
                            value: 60,
                        },
                    ],
                    labels: {
                        format: "{value} pt",
                    },
                    opposite: true,
                },
                {
                    labels: {
                        format: "{value} pt",
                    },
                    opposite: true,
                },
            ],
            rangeSelector: {
                inputEnabled: false,
            },
            series: seriesModel,
        };
    };

    const chartOptions = buildChartOptions(stocksToGraphObjects);

    if (!chartOptions) {
        return null;
    }

    return (
        <div>
            <HighchartsReact
                highcharts={Highcharts}
                constructorType={"stockChart"}
                options={chartOptions}
                ref={chartComponentRef}
            />
        </div>
    );
}

export default StocksGraph;
