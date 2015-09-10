StocksGraph = React.createClass({

    propTypes: {
        stuffToGraph: React.PropTypes.array.isRequired
    },

    initializeChart() {
        //initialize chart by showing cumulative performance of all stocks (no individual stock details) of pick list to today
    },

    componentDidMount: function() {
        this.initializeChart();
    },

    render() {
        return (
            <div ref="myChart"></div>
        );
    }
});