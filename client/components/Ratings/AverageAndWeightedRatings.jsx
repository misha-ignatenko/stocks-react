AverageAndWeightedRatings = React.createClass({

    mixins: [ReactMeteorData],

    propTypes: {
        symbol: React.PropTypes.string.isRequired
    },

    getInitialState() {
        let _format = "YYYY-MM-DD";

        return {
            avgRatingStartDate: moment((new Date()).toISOString()).subtract(90, "days").format(_format),
            avgRatingEndDate: moment((new Date()).toISOString()).format(_format),
            priceReactionDelayDays: 0
        }
    },

    getMeteorData() {
        let _symbol = this.props.symbol;
        let _data = {};
        let _currentUser = Meteor.user();
        let _settings = Settings.findOne();

        let _startDateForRatingChangesSubscription =
            _currentUser ?
                this.state.avgRatingStartDate :
                moment(new Date().toISOString()).subtract(_settings.clientSettings.upcomingEarningsReleases.numberOfDaysBeforeTodayForRatingChangesPublicationIfNoUser, 'days').format("YYYY-MM-DD");
        let _endDateRatingChanges = this.state.avgRatingEndDate;
        let _ratingChangesHandle = Meteor.subscribe("ratingChangesForSymbols", [_symbol], _startDateForRatingChangesSubscription, _endDateRatingChanges);
        if (_ratingChangesHandle.ready()) {
            let _pricesHandle = Meteor.subscribe("stockPricesFor", [_symbol]);
            if (_pricesHandle.ready()) {
                //todo make sure to pull data if necessary
                let result = this.getPricesBetweenTwoDates(StockPrices.findOne({symbol: _symbol}), _startDateForRatingChangesSubscription, _endDateRatingChanges);

                _data.stocksToGraphObjs = [];
                var _startDate = _startDateForRatingChangesSubscription;
                var _endDate = _endDateRatingChanges;
                var _averageAnalystRatingSeries = StocksReact.functions.generateAverageAnalystRatingTimeSeries(_symbol, _startDate, _endDate);
                //TODO: start date and end date for regression are coming from a different date picker
                var _startDateForRegression = _startDate;
                var _endDateForRegression = _endDate;
                if (result && result.historicalData) {
                    var _avgRatingsSeriesEveryDay = StocksReact.functions.generateAverageAnalystRatingTimeSeriesEveryDay(_averageAnalystRatingSeries, result.historicalData);
                    var _priceReactionDelayInDays = this.state.priceReactionDelayDays;
                    var _weightedRatingsSeriesEveryDay = StocksReact.functions.generateWeightedAnalystRatingsTimeSeriesEveryDay(_avgRatingsSeriesEveryDay, _startDateForRegression, _endDateForRegression, result.historicalData, _priceReactionDelayInDays, "adjClose");

                    _data.stocksToGraphObjs = [_.extend(result, {
                        avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
                        weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay
                    })]
                }

                _data.ratingChangesAndStockPricesSubscriptionsForSymbolReady = true;
                _data.ratingChanges = RatingChanges.find({}, {sort: {date: 1}}).fetch();
                _data.ratingScales = RatingScales.find().fetch()
            }
        }

        return _data;
    },

    getPricesBetweenTwoDates(allAvailableStockPricesObj, startDate, endDate) {
        var _historicalDataBetweenTwoRequestedDates = [];
        var _stockPricesRecord = allAvailableStockPricesObj;
        if (_stockPricesRecord && _stockPricesRecord.historicalData) {
            var _allHistoricalData = _stockPricesRecord.historicalData;
            //push items from _allHistoricalData to _historicalDataBetweenTwoRequestedDates
            //only where dates are within the requested date range
            _allHistoricalData.forEach(function(priceObjForDay) {
                var _extractedDateStringNoTimezone = moment(new Date(priceObjForDay.date)).format("YYYY-MM-DD");
                if ((moment(_extractedDateStringNoTimezone).isSame(startDate) || moment(_extractedDateStringNoTimezone).isAfter(startDate)) &&
                    (moment(_extractedDateStringNoTimezone).isSame(endDate) || moment(_extractedDateStringNoTimezone).isBefore(endDate))
                ) {
                    _historicalDataBetweenTwoRequestedDates.push(priceObjForDay);
                }
            });
            //this will limit the historicalData attribute that we are making available to the user
            _stockPricesRecord.historicalData = _historicalDataBetweenTwoRequestedDates;
        }
        return _stockPricesRecord;
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        //update component only when there is new data available to be graphed, not necessarily when there is a new symbol prop
        //because it takes a few seconds after new symbol prop is set to get new data to graph
        if (this.props.symbol !== nextProps.symbol ||
            this.state.avgRatingStartDate !== nextState.avgRatingStartDate ||
            this.state.avgRatingEndDate !== nextState.avgRatingEndDate || this.state.priceReactionDelayDays !== nextState.priceReactionDelayDays
        ) {
            return true;
        }

        return false;
    },

    renderAllExistingUpDowngradesForStock: function() {
        var _that = this;
        return <div className="row allUpDowngrades">
            <br/>
            {this.data.ratingChanges.length > 0 ? <h1>all existing up/downgrades:</h1> : <p>no analyst upgrades/downgrades</p>}
            <ul>
                {this.data.ratingChanges.map((ratingChange, index) => {
                    let _oldRatingValue = _.findWhere(_that.data.ratingScales, {_id: ratingChange.oldRatingId}).universalScaleValue;
                    let _newRatingValue = _.findWhere(_that.data.ratingScales, {_id: ratingChange.newRatingId}).universalScaleValue;
                    return(<li key={index}>
                        <div>
                            Old rating: {_oldRatingValue ? _oldRatingValue : "unknown"}<br/>
                            New rating: {_newRatingValue ? _newRatingValue : "unknown"}<br/>
                            As of: {ratingChange.date.substring(0,16)}<br/>
                            Firm name: {ratingChange.researchFirmId ? ratingChange.researchFirmId : "no premium access"}
                        </div>
                    </li>);
                })}
            </ul>
        </div>
    },

    changingStart: function() {},
    changingEnd: function() {},

    decreasePriceDelay() {
        this.setState({
            priceReactionDelayDays: this.state.priceReactionDelayDays - 1
        });
    },
    increasePriceDelay() {
        this.setState({
            priceReactionDelayDays: this.state.priceReactionDelayDays + 1
        });
    },

    renderAvgAnalystRatingsGraph: function() {
        let _startDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.avgRatingStartDate);
        let _endDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.avgRatingEndDate);
        return (this.data.ratingChanges.length > 0 ? <div>
            <span>price reaction delay for rating changes (in days): {this.state.priceReactionDelayDays}</span><br/>
            <button type="button" className="btn btn-default" onClick={this.decreasePriceDelay}><span className="glyphicon glyphicon-minus" aria-hidden="true"></span></button>
            <button type="button" className="btn btn-default" onClick={this.increasePriceDelay}><span className="glyphicon glyphicon-plus" aria-hidden="true"></span></button>


            <div className="input-group input-daterange" ref={this.setDateRangeOptions}>
                <input type="text" className="form-control" id="avgRatingStartDate" value={_startDate} onChange={this.changingStart}/>
                <span className="input-group-addon">to</span>
                <input type="text" className="form-control" id="avgRatingEndDate" value={_endDate} onChange={this.changingEnd}/>
            </div>

            <div className="col-md-12 individualStockGraph">
                <StocksGraph
                    stocksToGraphObjects={this.data.stocksToGraphObjs}/>
            </div>
        </div> : null);
    },

    setDateRangeOptions: function() {
        StocksReact.ui.setDateRangeOptions("input-daterange");

        var _that = this;
        $('.form-control').on('change', function(event) {
            var _set = StocksReact.ui.getStateForDateRangeChangeEvent(event);
            _that.setState(_set);
        });
    },

    render() {

        return (
            <div>
                <br/>
                {this.data.ratingChangesAndStockPricesSubscriptionsForSymbolReady ?
                    <div>
                        <br/>
                        {this.renderAvgAnalystRatingsGraph()}
                        <br/><br/><br/><br/>
                        {this.renderAllExistingUpDowngradesForStock()}
                        <br/>
                    </div> :
                    "getting ratings changes and prices for " + this.props.symbol
                }
            </div>
        );
    }
});