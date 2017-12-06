RegressionPerformance = React.createClass({

    mixins: [ReactMeteorData],

    propTypes: {
        symbol: React.PropTypes.string.isRequired,
    },

    getInitialState() {

        return {
            regressionPerformance: undefined,
        }
    },

    getMeteorData() {
        let _symbol = this.props.symbol;
        let _data = {};
        let _currentUser = Meteor.user();
        let _stockInfo = Stocks.findOne({_id: _symbol});
        _data.stuffIsBeingPulledRn = _stockInfo.pricesBeingPulledRightNow;
        _data.settings = Settings.findOne();

        return _data;
    },

    componentWillMount() {
        console.log("mounting", this.props.symbol);
        let _maxDateForRatingChanges = StocksReactUtils.getClosestPreviousWeekDayDateByCutoffTime(false, moment().tz("America/New_York").subtract(70, "days"));
        let _lastPriceDate = StocksReactUtils.getClosestPreviousWeekDayDateByCutoffTime(false);

        var _that = this;
        Meteor.call("getRegressionPerformance", this.props.symbol, _maxDateForRatingChanges, _lastPriceDate, function (err, res) {
            if (err) {
                console.log(err);
            } else {
                _that.setState({regressionPerformance: res});
            }
        });
    },

    render() {
        var _data = this.state.regressionPerformance;
        var _wgt = _data && _data.wgt;
        var _avg = _data && _data.avg;
        var _altWgt = _data && _data.altWgt;
        var _actualStartPrice = _data && _data.actualStart.adjClose;
        var _actualEndPrice = _data && _data.actualEnd.adjClose;
        var _noRegressionEnd = _data && _avg[_avg.length -  1].price.toFixed(2);
        var _regressionEnd = _data && _wgt[_wgt.length - 1].price.toFixed(2);
        var _noRegrPct = _data && ((_noRegressionEnd - _actualStartPrice) / _actualStartPrice * 100).toFixed(2);
        var _regrPct = _data && ((_regressionEnd - _actualStartPrice) / _actualStartPrice * 100).toFixed(2);
        var _actualPct = _data && ((_actualEndPrice - _actualStartPrice) / _actualStartPrice * 100).toFixed(2);
        var _altRegrEnd = _data && _altWgt[_altWgt.length - 1].price.toFixed(2);
        var _altRegrPct = _data && ((_altRegrEnd - _actualStartPrice) / _actualStartPrice * 100).toFixed(2);

        return (
            <div className="row">
                {_data && "Regression stats for: " + this.props.symbol || "Regression performance loading..."}
                {_data && <table>
                    <thead>
                        <tr>
                            <th></th>
                            <th>{_data.actualStart.dateString}&nbsp;&nbsp;&nbsp;&nbsp;</th>
                            <th>{_data.actualEnd.dateString}&nbsp;&nbsp;&nbsp;&nbsp;</th>
                            <th>%</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>actual</td>
                            <td>{_actualStartPrice}</td>
                            <td>{_actualEndPrice}</td>
                            <td>{_actualPct}</td>
                        </tr>
                        <tr>
                            <td>no regression&nbsp;&nbsp;&nbsp;&nbsp;</td>
                            <td>{_actualStartPrice}</td>
                            <td>{_noRegressionEnd}</td>
                            <td>{_noRegrPct}</td>
                        </tr>
                        <tr>
                            <td>regression</td>
                            <td>{_actualStartPrice}</td>
                            <td>{_regressionEnd}</td>
                            <td>{_regrPct}</td>
                        </tr>
                        <tr>
                            <td>regression*</td>
                            <td>{_actualStartPrice}</td>
                            <td>{_altRegrEnd}</td>
                            <td>{_altRegrPct}</td>
                        </tr>
                    </tbody>
                </table>}
            </div>
        );
    }
});