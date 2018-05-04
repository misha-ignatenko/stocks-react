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
        var _altAvg = _data && _data.altAvg;
        var _altWgt = _data && _data.altWgt;
        var _actualStartPrice = _data && _data.actualStart.adjClose;
        var _actualEndPrice = _data && _data.actualEnd.adjClose;
        var _noRegressionEnd = _data && _avg[_avg.length -  1].price.toFixed(2);
        var _regressionEnd = _data && _wgt[_wgt.length - 1].price.toFixed(2);
        var _noRegrPct = _data && ((_noRegressionEnd - _actualStartPrice) / _actualStartPrice * 100).toFixed(2);
        var _regrPct = _data && ((_regressionEnd - _actualStartPrice) / _actualStartPrice * 100).toFixed(2);
        var _actualPct = _data && ((_actualEndPrice - _actualStartPrice) / _actualStartPrice * 100).toFixed(2);
        var _actualPct2 = _data && ((_actualEndPrice - _actualStartPrice) / _actualStartPrice * 100).toFixed(2);


        // avg
        var _avgStart = _altAvg && _.find(_altAvg, function (avgPrediction) {return avgPrediction.dateString === _data.actualStart.dateString}).price.toFixed(2);
        var _avgEnd = _altAvg && _altAvg[_altAvg.length - 1].price.toFixed(2);
        var _avgPct = _altAvg && pctDiff(_avgStart, _avgEnd);


        // wgt
        var _altRegrStart = _altWgt && _.find(_altWgt, function (regrPrediction) {return regrPrediction.dateString === _data.actualStart.dateString}).price.toFixed(2);
        var _altRegrEnd = _data && _altWgt[_altWgt.length - 1].price.toFixed(2);
        var _altRegrPct = _data && ((_altRegrEnd - _actualStartPrice) / _actualStartPrice * 100).toFixed(2);
        var _altRegrPct2 = _data && pctDiff(_altRegrStart, _altRegrEnd);

        function pctDiff(oldVal, newVal) {
            return ((newVal - oldVal) / oldVal * 100).toFixed(2);
        }

        var _graphData = [];
        if (_data) {
            _graphData = [{
                symbol: this.props.symbol,
                historicalData: _data.px,
                avgAnalystRatingsEveryDay: _.map(_data.avgRatingsExtended, function (r) {return _.extend(r, {avg: r.rating})}),
                weightedAnalystRatingsEveryDay: _.map(_data.wgtRatingsExtended, function (r) {return _.extend(r, {weightedRating: r.rating})}),
                predictionsBasedOnWeightedRatings: _altWgt,
                predictionsBasedOnAvgRatings: _altAvg,
            }];
        }

        return (
            <div className="row">
                {_data && "Regression stats for: " + this.props.symbol || "Regression performance loading..."}
                {_data && <p>If you ran a regression on <b>{_data.actualStart.dateString}</b> (avg rating <b>{_data && _data.avgRatingsDaily[_data.avgRatingsDaily.length - 1].avg.toFixed(2)}</b>),
                    weighted rating (calculated via regression) would have been: <b>{_data && _data.wgtRatingsDaily[_data.wgtRatingsDaily.length - 1].weightedRating.toFixed(2)}</b>
                    <br/>Based on rating changes from <b>{_data && _data.rCh[0].dateString}</b> to {<b>{_data && _data.rCh[_data.rCh.length - 1].dateString}</b>}.
                    <br/>With <b>0.5</b> max downside and <b>0.5</b> max upside per day, the prices predicted would be as follows:
                    </p>}
                {_data && <table>
                    <thead>
                    <tr>
                        <th></th>
                        <th>{_data.actualStart.dateString}&nbsp;&nbsp;&nbsp;&nbsp;</th>
                        <th>{_data.actualEnd.dateString}&nbsp;&nbsp;&nbsp;&nbsp;</th>
                        <th>% up/dn (from own)&nbsp;&nbsp;&nbsp;&nbsp;</th>
                        <th>% up/dn (from actual)</th>
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
                        <td>avg ratings&nbsp;&nbsp;&nbsp;&nbsp;</td>
                        <td>{_avgStart}</td>
                        <td>{_avgEnd}</td>
                        <td>{_avgPct}</td>
                    </tr>
                    <tr>
                        <td>wgt ratings</td>
                        <td>{_altRegrStart}</td>
                        <td>{_altRegrEnd}</td>
                        <td>{_altRegrPct2}</td>
                    </tr>
                    </tbody>
                </table>}
                {_data && <div className="col-md-12 individualStockGraph">
                    <StocksGraph
                        stocksToGraphObjects={_graphData}/>
                </div>}
            </div>
        );
    }
});