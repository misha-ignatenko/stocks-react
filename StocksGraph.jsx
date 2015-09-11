StocksGraph = React.createClass({

    getInitialState: function() {
        return {
            //chartInstance: null
            stocksToGrph: []
        }
    },

    propTypes: {
        stocksToGraph: React.PropTypes.array.isRequired
    },

    componentWillReceiveProps: function(nextProps) {
        this.setState({
            stocksToGrph: nextProps.stocksToGraph
        });
        this.initializeChart(nextProps.stocksToGraph);
    },

    initializeChart: function(stocksArg) {
        var chartModel = {
            chart: {
                renderTo: 'container',
                type: 'bar'
            },
            title: {
                text: 'Historic World Population by Region'
            },
            subtitle: {
                text: 'Source: Wikipedia.org'
            },
            xAxis: {
                categories: ['Africa', 'America', 'Asia', 'Europe', 'Oceania'],
                title: {
                    text: null
                }
            },
            yAxis: {
                min: 0,
                title: {
                    text: 'Population (millions)',
                    align: 'high'
                },
                labels: {
                    overflow: 'justify'
                }
            },
            tooltip: {
                formatter: function() {
                    return ''+
                        this.series.name +': '+ this.y +' millions';
                }
            },
            plotOptions: {
                bar: {
                    dataLabels: {
                        enabled: true
                    }
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
            },
            credits: {
                enabled: false
            }
        };

        var seriesModel = [];
        stocksArg.forEach(function(symbol) {
            seriesModel.push({
                name: symbol,
                data: [107, 31, 635, 203, 2]
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
                { this.props.stocksToGraph }
                <div ref="myChart"></div>
            </div>
        );
    }
});