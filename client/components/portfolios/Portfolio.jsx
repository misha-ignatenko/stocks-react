Portfolio = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState: function() {
        return {
            newItemShort: false,
            startDate: "",
            endDate: ""
        };
    },

    propTypes: {
        portfolioId: React.PropTypes.string.isRequired
    },

    getMeteorData() {
        let _portfId = this.props.portfolioId;

        let _data = {};

        if (this.state.startDate !== "" && this.state.endDate !== "" && Meteor.subscribe("getPortfolioById", _portfId).ready()) {
            _data.portfolio = Portfolios.findOne({_id: _portfId});
            let _isRolling = _data.portfolio.rolling;
            let _businessDayLookback = _data.portfolio.lookback;
            let _lookback = _businessDayLookback / 5 * 7;
            let _startDate = _isRolling ? this.shiftStartDateBack2X(this.state.startDate, _lookback) : this.state.startDate;

            if (Meteor.subscribe("portfolioItems", [_data.portfolio._id], _startDate, this.state.endDate).ready()) {
                let _portfItems = PortfolioItems.find({portfolioId: _data.portfolio._id}).fetch();
                _data.portfolioItems = _isRolling ? this.processRollingPortfolioItems(_portfItems, this.state.startDate, _lookback) : _portfItems;
                let _uniqStockSymbols = _.uniq(_.pluck(_data.portfolioItems, "symbol"));
                let _uniqPortfItemDates = _.uniq(_.pluck(_data.portfolioItems, "dateString"));
                _data.uniqPortfItemDates = _uniqPortfItemDates;

                let _endDate = this.getEndDateForPrices();
                let _datesForSub = _.union(_uniqPortfItemDates, [_endDate]);
                if (Meteor.subscribe("stockPricesSpecificDates", _uniqStockSymbols, _datesForSub).ready()) {
                    _data.stockPrices = NewStockPrices.find({symbol: {$in: _uniqStockSymbols}}).fetch();
                }
            }
        }

        return _data;
    },

    shiftStartDateBack2X(startDate, lookback) {
        return moment(startDate).tz("America/New_York").subtract(lookback, "days").format("YYYY-MM-DD");
    },

    processRollingPortfolioItems(portfolioItems, startDate, lookback) {
        // note: there will be portfolio items prior to start date because need to generate rolling weights with lookback
        let _result = [];
        // step 1. Get all unique dates of portfolio items starting from startDate.
        let _itemsSinceStartDate = _.filter(portfolioItems, function (item) {
            return item.dateString >= startDate;
        });
        let _uniqDates = _.uniq(_.pluck(_itemsSinceStartDate, "dateString"));

        // step 2. For each unique date, generate an array of symbols with appropriate lookback.
        let _map = {};
        let _that = this;
        _.each(_uniqDates, function (dateStr) {
            let _startDate = _that.shiftStartDateBack2X(dateStr, lookback);
            let _endDate = dateStr;
            let _itemsOfInterest = _.filter(portfolioItems, function (item) {
                return item.dateString >= _startDate && item.dateString <= _endDate;
            })
            _map[dateStr] = _itemsOfInterest;
        })

        _.each(Object.keys(_map), function (dateStr) {
            let _sym = _map[dateStr];
            let _wt = 1 / _sym.length;
            _.each(_sym, function (obj) {
                _result.push({
                    symbol: obj.symbol,
                    dateString: dateStr,
                    weight: obj.short ? -_wt : _wt
                })
            })
        })

        return _result;
    },

    getEndDateForPrices() {
        let _settings = Settings.findOne();
        var _4PMEST_IN_ISO = _settings.clientSettings.ratingChanges.fourPmInEstTimeString;
        return StocksReact.utilities.getClosestPreviousWeekDayDateByCutoffTime(_4PMEST_IN_ISO, moment(this.state.endDate + " 17:00:00").tz("America/New_York"));
    },

    componentWillMount() {
        let _that = this;
        Meteor.call("getDefaultPerformanceDates", function (err, res) {
            if (!err && res) {
                _that.setState({
                    startDate: res.performanceDefaultStartDate,
                    endDate: res.performanceDefaultEndDate
                });
            } else {
                console.log(err.error);
            }
        });
    },
    toggle(event) {
        this.setState({
            newItemShort: !this.state.newItemShort
        })
    },
    submitNewItem() {
        let _obj = {
            portfolioId: this.data.portfolio._id,
            symbol: ReactDOM.findDOMNode(this.refs.newItemSymbolStr).value.trim(),
            dateString: ReactDOM.findDOMNode(this.refs.newItemDateStr).value.trim(),
            short: this.state.newItemShort
        };
        if (_obj.symbol !== "" && _obj.dateString.length === 10) {
            let _that = this;
            Meteor.call("insertNewRollingPortfolioItem", _obj, function (error, result) {
                _that.setState({
                    newItemShort: false
                })
                ReactDOM.findDOMNode(_that.refs.newItemSymbolStr).value = "";
                console.log("errror: ", error);
                console.log(result);
            });
        }
    },

    renderPortfolioUpdateEntry() {
        let _startDate = this.data.portfolio.rolling ? this.shiftStartDateBack2X(this.state.startDate, this.data.portfolio.lookback / 5 * 7) : this.state.startDate;
        // get the last date
        let _lastRebalanceDate = _.last(_.pluck(this.data.portfolioItems, "dateString"));
        let _latestPortfolioItems = this.data.portfolioItems.filter(function (obj) {
            return obj.dateString === _lastRebalanceDate;
        });
        // TODO: pass _latestPortfolioItems into a new compoment as properties so that user could edit them and
        // todo contd: submit an update to portfolio holdings via UI
        let _b = "btn btn-default";
        let _ab = "btn btn-default active";
        let _that = this;
        return <div>
            add a new item:
            <input type="text" ref="newItemDateStr" placeholder="Date" />
            <input type="text" ref="newItemSymbolStr" placeholder="Symbol" />
            <div className="btn-group" role="group" aria-label="...">
                <button type="button" className={!_that.state.newItemShort ? _ab : _b} onClick={_that.toggle}>Long</button>
                <button type="button" className={_that.state.newItemShort ? _ab : _b} onClick={_that.toggle}>Short</button>
            </div>
            <button className="btn btn-default btn-lg" onClick={_that.submitNewItem}>submit</button>
            <br/>
            <br/>
            {_startDate}
            <br/>
            {this.state.endDate}
            <br/>
            {PortfolioItems.find({portfolioId: this.data.portfolio._id}).fetch().reverse().map((obj, index) => {
                return <div key={index}>{obj.dateString}: {obj.symbol}{obj.short ? ", short" : ", long"}</div>
            })}
        </div>;
    },

    renderPortfolioPerformance() {
        // check if there is enough price data in the date range to generate performance
        let _uniqDates = this.data.uniqPortfItemDates;
        let _endDate = this.getEndDateForPrices();
        if (_uniqDates.indexOf(_endDate) === -1) {
            _uniqDates.push(_endDate);
        }
        let _minReqMap = {};
        let _items = this.data.portfolioItems;
        let _prices = this.data.stockPrices;

        let _missingData = false;
        _.each(_uniqDates, function(portfItemsDate, index) {
            let _dates = [];
            if (index === 0) {
                // no need to look at the previous index's holdings
                _dates.push(portfItemsDate);
            } else {
                // look at portfolio items for the current portfItemsDate as well as previous index's portfItemsDate because positions would be closed
                _dates.push(_uniqDates[index - 1]);
                _dates.push(portfItemsDate);
            }

            let _symbols = _.uniq(_.pluck(_items.filter(function(item) {if (_dates.indexOf(item.dateString) > -1) {return true;}}), "symbol"));
            _minReqMap[portfItemsDate] = _symbols;
        });

        _.each(Object.keys(_minReqMap), function(dateStr) {
            let _symbols = _minReqMap[dateStr];
            // let _stockPricesAvailForDateAndSymbols = NewStockPrices.find({dateString: dateStr, symbol: {$in: _symbols}}).fetch();
            let _stockPricesAvailForDateAndSymbols = _prices.filter(function(obj) {
                return obj.dateString === dateStr && _symbols.indexOf(obj.symbol) > -1;
            });
            let _missingPricesForSymbols = _.difference(_symbols, _.pluck(_stockPricesAvailForDateAndSymbols, "symbol"));
            if (_missingPricesForSymbols.length > 0) {
                _missingData = true;
                console.log("date: ", dateStr);
                console.log("missing prices for symbols: ", JSON.stringify(_missingPricesForSymbols));
                console.log("-------------------------------------");
            }
        });

        let _growthRates = [];

        if (!_missingData) {
            // assume bought at adj close and sold at open
            // let _purchaseAtType = "close";
            // let _sellAtType = "open";
            // only look at adjClose because there is weirdness with open/close (example: SBUX around Nov 2014)
            let _purchaseAtType = "adjClose";
            let _sellAtType = "adjClose";

            _.each(_uniqDates, function(date, index) {
                //todo: step 1. calculate the total weight-adjusted growth based on the previous date (index >=1)
                if (index === 0) {
                    _growthRates.push([date, 0]);
                } else {
                    let _startDate = _uniqDates[index - 1];
                    let _endDate = date;

                    let _pItems = _items.filter(function (pItem) {
                        return pItem.dateString === _startDate;
                    });
                    let _symbols = _.pluck(_pItems, "symbol");

                    let _weightedTotalChange = 0.0;
                    _.each(_symbols, function (symbol) {
                        let _purchasePricesForSymbol = _prices.filter(function (obj) {
                            return obj.symbol === symbol && obj.dateString === _startDate;
                        });
                        let _sellPricesForSymbol = _prices.filter(function (obj) {
                            return obj.symbol === symbol && obj.dateString === _endDate;
                        });
                        if (_purchasePricesForSymbol.length === 1 && _sellPricesForSymbol.length === 1) {
                            let _purchasePrice = _purchasePricesForSymbol[0][_purchaseAtType];
                            let _sellPrice = _sellPricesForSymbol[0][_sellAtType];
                            let _change = (_sellPrice - _purchasePrice) / _purchasePrice;
                            let _wgts = _pItems.filter(function (pItem) {return pItem.symbol === symbol;});

                            // calculate this because in some cases you can add the same symbol to a portfolio for
                            // two consecutive days, which should aggregate the total weight in a rolling portfolio.
                            var _weightsForSymbolForDay = _.pluck(_wgts, "weight");
                            var _totalWeightForSymbolForDay = _.reduce(_weightsForSymbolForDay, function(memo, num){ return memo + num; }, 0);

                            // if (_wgts.length === 1) {
                                let _weightedChange = _totalWeightForSymbolForDay * _change;
                                _weightedTotalChange += _weightedChange;
                            // } else {
                            //     console.log("ERRRRRRRRRRR");
                            // }
                        } else {
                            console.log("ERRRRRRRRRRR");
                        }
                    });

                    _growthRates.push([date, _weightedTotalChange]);
                }
            });
        }

        let _cumulativeGrowthRates = [];
        _.each(_growthRates, function (data, index) {
            if (index === 0) {
                _cumulativeGrowthRates.push([data[0], 1]);
            } else {
                _cumulativeGrowthRates.push([
                    data[0],
                    (_cumulativeGrowthRates[index-1][1]) * (data[1] + 1)
                ]);
            }
        });

        return _missingData ?
            <div className="container">not enough price history</div> :
            _cumulativeGrowthRates.length > 1 ?
                <PortfolioPerformanceGraph graphData={_cumulativeGrowthRates} /> :
                "NOT ENOUGH PERFORMANCE DATA"
    },

    shouldComponentUpdate(nextProps, nextState) {
        return this.state.newItemShort !== nextState.newItemShort || this.props.portfolioId !== nextProps.portfolioId || this.state.startDate !== nextState.startDate || this.state.endDate !== nextState.endDate;
    },

    setDateRangeOptions: function() {
        StocksReact.ui.setDateRangeOptions("input-daterange");

        var _that = this;
        $('.form-control').on('change', function(event) {
            var _set = StocksReact.ui.getStateForDateRangeChangeEvent(event);
            _that.setState(_set);
        });
    },

    changingStart: function() {},
    changingEnd: function() {},

    render() {
        let _startDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.startDate);
        let _endDate = this.state.endDate !== "" && StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.getEndDateForPrices());

        return (
            <div className="container">
                {this.data.portfolio ?
                    (this.data.portfolioItems ?
                        ( this.data.stockPrices ?
                            <div>
                                {this.data.stockPrices.length}
                                <h1>{this.data.portfolio.name}</h1>
                                <div className="col-md-8">
                                    <div className="input-group input-daterange" ref={this.setDateRangeOptions}>
                                        <input type="text" className="form-control" id="startDate" value={_startDate} onChange={this.changingStart}/>
                                        <span className="input-group-addon">to</span>
                                        <input type="text" className="form-control" id="endDate" value={_endDate} onChange={this.changingEnd}/>
                                    </div>
                                </div>
                                {this.renderPortfolioPerformance()}
                                <br/><br/>
                                {this.renderPortfolioUpdateEntry()}
                            </div> :
                            "GETTING STOCK PRICES"
                        ) :
                        "GETTING PORTFOLIO ITEMS") :
                    "GETTING PORTFOLIO INFO"}
            </div>
        );
    }
});