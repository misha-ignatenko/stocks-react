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
            var _maxPrice = 0.00;
            var _minPrice = 10000000.00;
            if (_histData) {
                let _seriesDataArray = [];
                _histData.forEach(function (histData) {
                    if (histData.adjClose > _maxPrice) {
                        _maxPrice = histData.adjClose;
                    }
                    if (histData.adjClose < _minPrice) {
                        _minPrice = histData.adjClose;
                    }
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
                var _maxRating = 0;
                var _minRating = 120000;
                _avgAnalystRatings.forEach(function(avgRating) {
                    if (avgRating.avg > _maxRating) {
                        _maxRating = avgRating.avg;
                    }
                    if (avgRating.avg < _minRating) {
                        _minRating = avgRating.avg;
                    }
                });
                var _rangeOfAvgRatings = _maxRating - _minRating;
                var _multiplyAllRatingsByCoef = _rangeOfPrices / _rangeOfAvgRatings;

                _avgAnalystRatings.forEach(function (avgRating) {
                    _seriesDataArray2.push([new Date(avgRating.date).valueOf(), _minPrice + _multiplyAllRatingsByCoef * (avgRating.avg  - _minRating)]);
                });
                seriesModel.push({
                    name: "avg rating" ,
                    data: _seriesDataArray2,
                    type : 'spline',
                    tooltip : {
                        valueDecimals : 2
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
                        text: "Earning Release"
                    });
                });
                seriesModel.push({
                    type: "flags",
                    data: _seriesDataArray3,
                    onSeries : 'dataseries',
                    shape : 'circlepin',
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