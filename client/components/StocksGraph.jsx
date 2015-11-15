StocksGraph = React.createClass({

    getInitialState: function() {
        return {
            //chartInstance: null
        }
    },

    propTypes: {
        stocksToGraphObjects: React.PropTypes.array.isRequired
    },

    componentWillReceiveProps: function(nextProps) {
        this.initializeChart(nextProps.stocksToGraphObjects);
    },

    initializeChart: function(stocksObjectsArray) {
        console.log("inside initialize chart. stocks object to graph: ", stocksObjectsArray);
        var chartModel = {
            chart: {
                renderTo: 'myChart',
                type: 'line'
            },
            credits: {
                enabled: false
            },
            title: {
                text: 'Historic World Population by Region'
            },
            tooltip: {
                formatter: function () {
                    return this.x + '\n' + this.series.name + ': ' + this.y + ' $';
                }
            },
            plotOptions: {
                series: {
                    enableMouseTracking: true,
                    stickyTracking: false,
                    tooltip: {}
                }
            },
            xAxis: {
                title: {
                    text: 'dates'
                },
                //TODO FIX THIS -- dates are glitchy
                type: 'datetime'
            },
            yAxis: {
                min: 0,
                title: {
                    text: 'Stock price, $'
                },
                labels: {
                    overflow: 'justify'
                }
            },
            legend: {
                layout: 'vertical',
                align: 'right',
                verticalAlign: 'top',
                x: -100,
                y: 100,
                floating: true,
                borderWidth: 1,
                backgroundColor: '#FFFFFF',
                shadow: true
            }
        };

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
        var width = this.props.width || null;
        var height = this.props.height || null;
        var selector = this.refs.myChart.getDOMNode();

        var chartOptions = React.addons.update(chartModel, {
            chart: {
                renderTo: {$set: selector},
                width: {$set: width},
                height: {$set: height}
            },
            series: {$set: seriesModel}
        });

        var chartInstance = new Highcharts.Chart(chartOptions);
        this.setState({
            chartInstance: chartInstance
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
                <div ref="myChart"></div>
                <div ref="myChartTwo"></div>
            </div>
        );
    }
});