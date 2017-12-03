RegressionPerformance = React.createClass({

    mixins: [ReactMeteorData],

    propTypes: {
        symbol: React.PropTypes.string.isRequired,
    },

    getInitialState() {

        return {

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
        let _settings = this.data.settings;
        var _4PMEST_IN_ISO = _settings.clientSettings.ratingChanges.fourPmInEstTimeString;
        let _maxDateForRatingChanges = StocksReactUtils.getClosestPreviousWeekDayDateByCutoffTime(_4PMEST_IN_ISO, moment().tz("America/New_York").subtract(70, "days"));
        let _lastPriceDate = StocksReactUtils.getClosestPreviousWeekDayDateByCutoffTime(_4PMEST_IN_ISO);
        console.log(_maxDateForRatingChanges);
        console.log(_lastPriceDate);
    },

    render() {

        return (
            <div className="row">
                Regression stats for: {this.props.symbol}
            </div>
        );
    }
});