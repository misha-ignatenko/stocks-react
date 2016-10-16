Portfolio = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState: function() {
        return {
            startDate: "2014-11-28",
            endDate: "2015-01-05"
        };
    },

    propTypes: {
        portfolioId: React.PropTypes.string.isRequired
    },

    getMeteorData() {
        let _portfId = this.props.portfolioId;

        let _data = {};

        if (Meteor.subscribe("getPortfolioById", _portfId).ready()) {
            _data.portfolio = Portfolios.findOne({_id: _portfId});

            if (Meteor.subscribe("portfolioItems", [_data.portfolio._id], this.state.startDate, this.state.endDate).ready()) {
                let _portfItems = PortfolioItems.find({portfolioId: _data.portfolio._id}).fetch();
                _data.portfolioItems = _portfItems;
                let _uniqStockSymbols = _.uniq(_.pluck(_portfItems, "symbol"));
                let _uniqPortfItemDates = _.uniq(_.pluck(_portfItems, "dateString"));
                _data.uniqPortfItemDates = _uniqPortfItemDates;

                let _endDate = this.getEndDateForPrices();
                if (Meteor.subscribe("stockPricesFor", _uniqStockSymbols, this.state.startDate, _endDate).ready()) {
                    _data.stockPrices = NewStockPrices.find({symbol: {$in: _uniqStockSymbols}}).fetch();
                }
            }
        }

        return _data;
    },

    getEndDateForPrices() {
        let _settings = Settings.findOne();
        var _4PMEST_IN_ISO = _settings.clientSettings.ratingChanges.fourPmInEstTimeString;
        return StocksReact.utilities.getClosestPreviousWeekDayDateByCutoffTime(_4PMEST_IN_ISO, moment(this.state.endDate + " 17:00:00").tz("America/New_York"));
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
            let _purchaseAtType = "adjClose";
            let _sellAtType = "open";

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
                            if (_wgts.length === 1) {
                                let _weightedChange = _wgts[0].weight * _change;
                                _weightedTotalChange += _weightedChange;
                            } else {
                                console.log("ERRRRRRRRRRR");
                            }
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
        return this.props.portfolioId !== nextProps.portfolioId || this.state.startDate !== nextState.startDate || this.state.endDate !== nextState.endDate;
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
        let _endDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.getEndDateForPrices());

        return (
            <div className="container">
                {this.data.portfolio ?
                    (this.data.portfolioItems ?
                        ( this.data.stockPrices ?
                            <div>
                                {this.data.stockPrices.length}
                                <h1>{this.data.portfolio.name}</h1>
                                <div className="input-group input-daterange" ref={this.setDateRangeOptions}>
                                    <input type="text" className="form-control" id="startDate" value={_startDate} onChange={this.changingStart}/>
                                    <span className="input-group-addon">to</span>
                                    <input type="text" className="form-control" id="endDate" value={_endDate} onChange={this.changingEnd}/>
                                </div>
                                {this.renderPortfolioPerformance()}
                            </div> :
                            "GETTING STOCK PRICES"
                        ) :
                        "GETTING PORTFOLIO ITEMS") :
                    "GETTING PORTFOLIO INFO"}
            </div>
        );
    }
});