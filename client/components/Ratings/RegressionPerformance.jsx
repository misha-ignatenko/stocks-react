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
        let _settings = Settings.findOne();
        let _stockInfo = Stocks.findOne({_id: _symbol});
        _data.stuffIsBeingPulledRn = _stockInfo.pricesBeingPulledRightNow;

        return _data;
    },

    componentWillMount() {
        console.log("mounting", this.props.symbol);
    },

    render() {

        return (
            <div className="row">
                Regression stats for: {this.props.symbol}
            </div>
        );
    }
});