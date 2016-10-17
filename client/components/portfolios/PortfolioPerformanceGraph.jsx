PortfolioPerformanceGraph = React.createClass({

    propTypes: {
        graphData: React.PropTypes.array.isRequired
    },

    initializeChart: function(graphData) {
        if (graphData.length === 0) {
            $(this.refs.performanceChart).hide();
        } else {
            $(this.refs.performanceChart).show();
        }

        var seriesModel = [];

        let _perfSeries = _.map(graphData, function (tuple) {
            return [new Date(tuple[0]).valueOf(), tuple[1]];
        });

        seriesModel.push({
            name: "performance",
            data: _perfSeries,
            tooltip : {
                valueDecimals : 4
            },
            id : 'dataseries'
        });

        $(this.refs.performanceChart).highcharts('StockChart', {

            tooltip: {
                formatter: function() {
                    return '<b>' + moment(this.x).utc().format("YYYY-MM-DD") + '</b><br/>' +
                        "performance: " + this.y.toFixed(4);
                }
            },

            xAxis: {
                ordinal: false,
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
                        format: '{value}'
                    },
                    opposite: false
                }
            ],

            rangeSelector: {
                inputEnabled: false
            },

            series: seriesModel
        });
    },

    componentDidMount: function() {
        this.initializeChart(this.props.graphData);
    },

    render: function() {
        return (
            <div className="container">
                <div className="col-md-8" ref="performanceChart"></div>
            </div>
        );
    }
});