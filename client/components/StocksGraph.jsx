StocksGraph = React.createClass({

    propTypes: {
        stocksToGraphObjects: React.PropTypes.array.isRequired
    },

    componentWillReceiveProps: function(nextProps) {
        this.initializeChart(nextProps.stocksToGraphObjects);
    },

    initializeChart: function(stocksObjectsArray) {
        console.log("inside initialize chart. stocks object to graph: ", stocksObjectsArray);

        var seriesModel = [];
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
                    data: _seriesDataArray
                });
            }
        });

        $(this.refs.myChartTwo.getDOMNode()).highcharts('StockChart', {

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
                selected: 1
            },

            series: seriesModel
        });
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