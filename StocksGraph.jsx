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
                type: 'scatter'
            },
            credits: {
                enabled: false
            },
            title: {
                text: 'Historic World Population by Region'
            },
            tooltip: {
                snap: 5,
                formatter: function() {
                    return ''+
                        this.series.name +': '+ this.y +' millions';
                }
            },
            plotOptions: {
                scatter: {
                    dataLabels: {
                        enabled: true
                    },
                    lineWidth: 2
                },
                series: {
                    enableMouseTracking: true,
                    stickyTracking: false,
                    tooltip: {

                    }
                },
                line: {
                    marker: {
                        enabled: true
                    }
                }
            },
            xAxis: {
                min: 0,
                max: 10,
                title: {
                    text: 'dates'
                }
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
        stocksObjectsArray.forEach(function(obj) {
            seriesModel.push({
                name: obj.stockId,
                data: [
                    [1, 107],
                    [2, 31],
                    [3, 635],
                    [4, 203],
                    [5, 2]
                ]
            });
        });
        var width = this.props.width || null;
        var height = this.props.height || null;
        var selector = this.refs.myChart.getDOMNode();;

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
    },

    componentDidMount: function() {
        this.initializeChart([]);
    },

    render: function() {
        return (
            <div>
                <div ref="myChart"></div>
            </div>
        );
    }
});