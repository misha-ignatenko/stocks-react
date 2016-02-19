StocksGraph = React.createClass({

    propTypes: {
        stocksToGraphObjects: React.PropTypes.array.isRequired
    },

    componentWillReceiveProps: function(nextProps) {
        this.initializeChart(nextProps.stocksToGraphObjects);
    },

    initializeChart: function(stocksObjectsArray) {
        console.log("inside initialize chart. stocks object to graph: ", stocksObjectsArray);
        if (stocksObjectsArray.length === 0) {
            $(this.refs.myChartTwo).hide();
        } else {
            $(this.refs.myChartTwo).show();
        }

        var seriesModel = [];
        var _that = this;
        stocksObjectsArray.forEach(function (obj) {
            //console.log("OBJECT FROM STOCKSOBJECTSARRAY: ", obj);
            var _histData = obj.historicalData;
            var _minMaxPrice = StocksReact.utilities.getMinMaxFromArrOfObj(obj.historicalData, "adjClose");
            var _maxPrice = _minMaxPrice[1];
            var _minPrice = _minMaxPrice[0];
            if (_histData) {
                let _seriesDataArray = [];
                _histData.forEach(function (histData) {
                    _seriesDataArray.push([new Date(histData.date).valueOf(), histData.adjClose]);
                });

                seriesModel.push({
                    name: obj.stockId ? obj.stockId : obj.symbol ? obj.symbol : "stock name unknown" ,
                    data: _seriesDataArray,
                    tooltip : {
                        valueDecimals : 2
                    },
                    id : 'dataseries'
                });
            }
            var _rangeOfPrices = _maxPrice - _minPrice;

            var _avgAnalystRatings = obj.avgAnalystRatings;
            if (_avgAnalystRatings && _avgAnalystRatings.length > 2) {
                let _seriesDataArray2 = [];
                //determing the range of all analyst ratings
                var _minMaxAvgRating = StocksReact.utilities.getMinMaxFromArrOfObj(_avgAnalystRatings, "avg");
                var _maxRating = _minMaxAvgRating[1];
                var _minRating = _minMaxAvgRating[0];

                var _rangeOfAvgRatings = _maxRating - _minRating;
                var _multiplyAllRatingsByCoef = _rangeOfPrices / _rangeOfAvgRatings;

                _avgAnalystRatings.forEach(function (avgRating) {
                    _seriesDataArray2.push([new Date(avgRating.date).valueOf(), _minPrice + _multiplyAllRatingsByCoef * (avgRating.avg - _minRating)]);
                });
                seriesModel.push({
                    name: "avg rating",
                    data: _seriesDataArray2,
                    type: 'spline',
                    tooltip: {
                        valueDecimals: 2
                    },
                    yAxis: 1
                });
            }

            if (obj.avgAnalystRatingsEveryDay && obj.avgAnalystRatingsEveryDay.length > 2) {
                var _seriesDataArrayAvgRatingEveryDay = [];
                var _rangeOfAvgRatingsByDay = StocksReact.utilities.getMinMaxFromArrOfObj(obj.avgAnalystRatingsEveryDay, "avg");
                var _coef = 1;
                if (_rangeOfAvgRatingsByDay.length > 0) {
                    _coef = _rangeOfPrices / (_rangeOfAvgRatingsByDay[1] - _rangeOfAvgRatingsByDay[0]);
                }

                obj.avgAnalystRatingsEveryDay.forEach(function (avgRatingEveryDay) {
                    _seriesDataArrayAvgRatingEveryDay.push(
                        [
                            new Date(avgRatingEveryDay.date).valueOf(),
                            //_minPrice + _coef * (avgRatingEveryDay.avg - _rangeOfAvgRatingsByDay[0])
                            avgRatingEveryDay.avg
                        ]
                    );
                });
                seriesModel.push({
                    name: "avg rating every day",
                    data: _seriesDataArrayAvgRatingEveryDay,
                    type: 'spline',
                    tooltip: {
                        valueDecimals: 2
                    },
                    yAxis: 1
                });
            }

            if (obj.weightedAnalystRatingsEveryDay && obj.weightedAnalystRatingsEveryDay.length > 2) {
                var _weightedAnalystRatingsSeries = [];
                obj.weightedAnalystRatingsEveryDay.forEach(function (weightedRating) {
                    _weightedAnalystRatingsSeries.push(
                        [
                            new Date(weightedRating.date).valueOf(),
                            weightedRating.weightedRating
                        ]
                    );
                });

                seriesModel.push({
                    name: "weighted rating every day",
                    data: _weightedAnalystRatingsSeries,
                    type: 'spline',
                    tooltip: {
                        valueDecimals: 2
                    }
                });
            }

            var _earningsReleases = obj.earningsReleases;
            if (_earningsReleases && _earningsReleases.length > 0) {
                let _seriesDataArray3 = [];
                _earningsReleases.forEach(function(earningsRelease) {
                    var _date = _that.convertQuandlFormatNumberDateToDateStringWithSlashes(earningsRelease.reportDateNextFiscalQuarter);
                    _seriesDataArray3.push({
                        x: new Date(_date).valueOf(),
                        title: "E",
                        text: (earningsRelease.reportTimeOfDayCode === 1) ?
                            "After market close" :
                            (earningsRelease.reportTimeOfDayCode === 2) ?
                                "Before the open" :
                                (earningsRelease.reportTimeOfDayCode === 3) ?
                                    "During market trading" :
                                    "Unknown" //1 (After market close), 2 (Before the open), 3 (During market trading) or 4 (Unknown).
                    });
                });
                seriesModel.push({
                    type: "flags",
                    data: _seriesDataArray3,
                    onSeries : 'dataseries',
                    shape : 'squarepin',
                    width : 16
                });
            }
        });

        $(this.refs.myChartTwo).highcharts('StockChart', {

            xAxis: {
                type: 'datetime',
                dateTimeLabelFormats: {
                    second: '%Y-%m-%d<br/>%H:%M:%S',
                    minute: '%Y-%m-%d<br/>%H:%M',
                    hour: '%Y-%m-%d<br/>%H:%M',
                    day: '%Y<br/>%m-%d',
                    week: '%Y<br/>%m-%d',
                    month: '%Y-%m',
                    year: '%Y'
                }
            },

            yAxis: [
                {
                    labels: {
                        format: '${value}'
                    },
                    opposite: false
                }, {
                    title: {
                        text: "avg rating"
                    },
                    labels: {
                        format: '{value} pt'
                    },
                    opposite: true
                }
                , {
                    //title: {
                    //    text: "avg weighted rating"
                    //},
                    labels: {
                        format: '{value} pt'
                    },
                    opposite: true
                }
            ],

            rangeSelector: {
                inputEnabled: false
            },

            series: seriesModel
        });
        $('.highcharts-range-selector').on('change', function() {
            console.log("change in highcharts-range-selector!!");
            console.log("if user expanded the date range then trigger an update function and show a loading message while new stock prices data is being pulled");
            console.log("also need to take care of updating the according date range values based on where the request to render the graph came from.");
            var _minOrMaxString = this.getAttribute("name");
            if (_minOrMaxString === "min") {
                //readjust start date for each stock
                var _newStartDate = this.value;
                //get existing max date so can call the function with
                var _endDate = $('[name="max"]').val();
            } else if (_minOrMaxString === "max") {
                //readjust end date for all stocks in stocksToGraphsObjects
                var _newEndDate = this.value;
                var _startDate = $('[name="min"]').val();
            }
        });
    },

    convertQuandlFormatNumberDateToDateStringWithSlashes: function(_dateStringWithNoSlashesAsNumber) {
        _dateStringWithNoSlashesAsNumber = _dateStringWithNoSlashesAsNumber.toString();
        var _year = _dateStringWithNoSlashesAsNumber.substring(0,4);
        var _month = _dateStringWithNoSlashesAsNumber.substring(4,6);
        var _day = _dateStringWithNoSlashesAsNumber.substring(6,8);
        return _month + "/" + _day + "/" + _year;
    },

    componentDidMount: function() {
        this.initializeChart([]);
    },

    render: function() {
        return (
            <div>
                <div ref="myChartTwo"></div>
            </div>
        );
    }
});