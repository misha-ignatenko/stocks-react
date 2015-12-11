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

            var _avgAnalystRatings = obj.avgAnalystRatings;
            if (_avgAnalystRatings && _avgAnalystRatings.length > 2) {
                let _seriesDataArray2 = [];
                _avgAnalystRatings.forEach(function (avgRating) {
                    _seriesDataArray2.push([new Date(avgRating.date).valueOf(), avgRating.avg]);
                });
                seriesModel.push({
                    name: "avg rating" ,
                    data: _seriesDataArray2,
                    type : 'spline'
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

            //rangeSelector: {
            //    selected: 1
            //},

            series: seriesModel
        });
        $('.highcharts-range-selector').on('change', function() {
            console.log("change in highcharts-range-selector!!");
            console.log("if user expanded the date range then trigger an update function and show a loading message while new stock prices data is being pulled");
            console.log("also need to take care of updating the according date range values based on where the request to render the graph came from.");
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