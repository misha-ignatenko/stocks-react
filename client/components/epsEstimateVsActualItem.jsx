EpsEstimateVsActualItem = React.createClass({

    mixins: [ReactMeteorData],

    propTypes: {
        estimateVsActual: React.PropTypes.object.isRequired,
        symbol: React.PropTypes.string.isRequired
    },

    getInitialState() {

        return {
            stocksToGraphObjects: []
        }
    },

    getLatestGraph: function(symbol, estimateVsActual) {
        var _dateQuandlFormat = estimateVsActual.reportDate;
        var _startDate = moment(new Date(this.convertQuandlFormatNumberDateToDateStringWithSlashes(_dateQuandlFormat)).toISOString()).subtract(7, 'days').format("YYYY-MM-DD");
        var _endDate = moment(new Date(this.convertQuandlFormatNumberDateToDateStringWithSlashes(_dateQuandlFormat)).toISOString()).add(7, 'days').format("YYYY-MM-DD");

        if (symbol && _startDate && _endDate) {
            var _that = this;
            Meteor.call('checkHistoricalData', symbol, _startDate, _endDate, function(err, result) {
                if (result && result.historicalData) {
                    _that.setState({
                        stocksToGraphObjects: [result]
                    });
                }
            });
        }
    },
    convertQuandlFormatNumberDateToDateStringWithSlashes: function(_dateStringWithNoSlashesAsNumber) {
        _dateStringWithNoSlashesAsNumber = _dateStringWithNoSlashesAsNumber.toString();
        var _year = _dateStringWithNoSlashesAsNumber.substring(0,4);
        var _month = _dateStringWithNoSlashesAsNumber.substring(4,6);
        var _day = _dateStringWithNoSlashesAsNumber.substring(6,8);
        return _month + "/" + _day + "/" + _year;
    },
    componentWillReceiveProps: function(nextProps) {
        this.getLatestGraph(nextProps.symbol, nextProps.estimateVsActual);
    },
    componentDidMount: function() {
        if (this.props.symbol && this.props.estimateVsActual) {
            this.getLatestGraph(this.props.symbol, this.props.estimateVsActual);
        }
    },

    getMeteorData() {


        return {

        }
    },

    render() {
        return (<div className="container epsEstimateVsActualItem">
            Date: {this.props.estimateVsActual.reportDate}<br/>
            Expected EPS: {this.props.estimateVsActual.epsEstimate}<br/>
            Actual EPS: {this.props.estimateVsActual.epsActual}<br/>
            <div className="col-md-12 individualStockGraph">
                <StocksGraph
                    stocksToGraphObjects={this.state.stocksToGraphObjects}/>
            </div>
        </div>);
    }
});