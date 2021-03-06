import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';

class PortfolioPerformanceGraph extends Component {

    initializeChart(obj) {
        if (obj.portfolio.length === 0) {
            $(this.refs.performanceChart).hide();
        } else {
            $(this.refs.performanceChart).show();
        }

        var seriesModel = [];

        let _perfSeries = _.map(obj.portfolio, function (tuple) {
            return [new Date(tuple[0]).valueOf(), tuple[1]];
        });

        seriesModel.push({
            name: "portfolio",
            data: _perfSeries,
            tooltip : {
                valueDecimals : 4
            },
            id : 'dataseries'
        });

        seriesModel.push({
            name: "S&P 500",
            data: _.map(obj.sp500, function (tuple) {
                return [new Date(tuple[0]).valueOf(), tuple[1]];
            }),
            tooltip : {
                valueDecimals : 4
            },
            id : 'dataseries'
        });

        $(this.refs.performanceChart).highcharts('StockChart', {

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
    }

    componentDidMount() {
        this.initializeChart(this.props.graphData);
    }

    shouldComponentUpdate(nextProps, nextState) {
        this.initializeChart(nextProps.graphData);

        return true;
    }

    render() {
        return (
            <div className="container">
                <div className="col-md-8" ref="performanceChart"></div>
            </div>
        );
    }
}

export default withTracker(() => {

    return {
        currentUser: Meteor.user(),
    }
})(PortfolioPerformanceGraph);