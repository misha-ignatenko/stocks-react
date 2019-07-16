import { Component } from 'react';

class Portfolio extends Component {

    getInitialState() {
        return {
            newItemShort: false,
            startDate: "",
            endDate: ""
        };
    }

    propTypes: {
        portfolioId: React.PropTypes.string.isRequired
    }

    getMeteorData() {
        let _portfId = this.props.portfolioId;

        let _data = {};

        if (this.state.startDate !== "" && this.state.endDate !== "" && Meteor.subscribe("getPortfolioById", _portfId).ready()) {
            _data.portfolio = Portfolios.findOne({_id: _portfId});

            // check if portfolio is an intersection based on rating changes
            let _hasCriteria = _data.portfolio.criteria ? true : false;

            let _isRolling = _data.portfolio.rolling;
            let _businessDayLookback = _data.portfolio.lookback;
            let _lookback = _businessDayLookback / 5 * 7;
            let _startDate = _isRolling ? this.shiftStartDateBack2X(this.state.startDate, _lookback) : this.state.startDate;

            // 2 cases:
            //      1) portfolio has criteria and subscribed to relevant RatingChanges, or
            //      2) portfolio has no criteria and subscribed to PortfolioItems (rolling portfolio or not)
            if (
                (_hasCriteria && Meteor.subscribe("ratingScales").ready() && this.data.ratingChanges) ||
                (!_hasCriteria && Meteor.subscribe("portfolioItems", [_data.portfolio._id], _startDate, this.state.endDate).ready())
            ) {
                _data.rawPortfolioItems = PortfolioItems.find({portfolioId: _data.portfolio._id}, {sort: {dateString: 1}}).fetch();
                _data.portfolioItems = _isRolling ? this.processRollingPortfolioItems(_data.rawPortfolioItems, this.state.startDate, _lookback) : _hasCriteria ? this.processRatingChangesFromCriteriaPortfolio(RatingScales.find().fetch(), this.data.ratingChanges, this.state.startDate, this.state.endDate) : _data.rawPortfolioItems;
                let _uniqStockSymbols = _.uniq(_.pluck(_data.portfolioItems, "symbol"));
                _uniqStockSymbols = _.uniq(_.union(_uniqStockSymbols, ["SPY"]));
                let _uniqPortfItemDates = _.uniq(_.pluck(_data.portfolioItems, "dateString"));
                _data.uniqPortfItemDates = _uniqPortfItemDates;

                let _endDate = this.getEndDateForPrices();
                let _datesForSub = _.union(_uniqPortfItemDates, [_endDate]);


                // generate a map for prices subscription
                let _pricesSubscrMap = {};
                let _datesForSubSorted = _.sortBy(_datesForSub);
                _.each(_datesForSubSorted, function (dateStr, idx) {
                    let _relevantPortfolioItems = _.filter(_data.portfolioItems, function (obj) {
                        if (idx > 0) {
                            // if it's not the first date, include symbols from the previous date
                            return obj.dateString === dateStr || obj.dateString === _datesForSubSorted[idx - 1]
                        } else {
                            return obj.dateString === dateStr;
                        }
                    });
                    let _relevantSymbols = _.uniq(_.pluck(_relevantPortfolioItems, "symbol"));
                    _pricesSubscrMap[dateStr] = _relevantSymbols.concat(["SPY"]);
                });
                var _that = this;
                if (!_that.state.pricesLoaded) {
                    Meteor.call("getPricesFromApi", _pricesSubscrMap, function (err, res) {
                        console.log("done with getPricesFromApi call: ", err, res);
                        _.each(res, function (px) {
                            if (!px.adjClose) {
                                console.log("missing adjClose for: ", px.symbol, px.dateString);
                            }
                        })
                        if (!err) {
                            _that.setState({
                                stockPrices: res,
                                pricesLoaded: true
                            });
                        }
                    });
                }
            }
        }

        return _data;
    }

    componentWillReceiveProps(nextProps) {
        if (!this.state.previouslyLoadedPortfolioId || this.state.previouslyLoadedPortfolioId !== nextProps.portfolioId) {
            this.setUpStartEndDates(nextProps.portfolioId);
        }
    }

    shiftStartDateBack2X(startDate, lookback) {
        return moment(startDate).tz("America/New_York").subtract(lookback, "days").format("YYYY-MM-DD");
    }

    processRatingChangesFromCriteriaPortfolio(ratingScales, rCh, startDate, endDate) {
        var ratingScalesOfInterest = _.map(this.data.criteriaRatingScales, function (arr) { return _.pluck(arr, "_id") });
        var ratingChanges = _.filter(rCh, function (obj) {
            return obj.dateString >= startDate && obj.dateString <= endDate;
        })


        var _portfolioItems = [];
        var _holdingsMapPerStrategy = _.map(ratingScalesOfInterest, function (arr) { return {} });
        var _initialDeletionsPerStrategyMap = _.map(ratingScalesOfInterest, function (arr) { return {} });;

        var _uniqDates = _.sortBy(_.uniq(_.pluck(ratingChanges, "dateString")));
        _.each(_uniqDates, function (dateStr, idx) {
            _.each(ratingScalesOfInterest, function (rScaleIdsArr, criteriaIdx) {
                var _additionsPerCriteria = _.filter(ratingChanges, function (rc) {return rc.dateString === dateStr && _.contains(rScaleIdsArr, rc.newRatingId) && !_.contains(rScaleIdsArr, rc.oldRatingId); })
                var _deletionsPerCriteria = _.filter(ratingChanges, function (rc) {return rc.dateString === dateStr && _.contains(rScaleIdsArr, rc.oldRatingId) && !_.contains(rScaleIdsArr, rc.newRatingId); })
                // console.log(dateStr, rScaleIdsArr);
                // console.log("strategy index: ", criteriaIdx);
                // console.log("additions: ", _.pluck(_additionsPerCriteria, "symbol"));
                // console.log("deletions: ", _.pluck(_deletionsPerCriteria, "symbol"));

                // get an array of symbols per date
                var _previousDatesSymbols = (idx === 0 ? [] : _holdingsMapPerStrategy[criteriaIdx][_uniqDates[idx - 1]]);
                var _additions = _.pluck(_additionsPerCriteria, "symbol");
                var _deletions = _.pluck(_deletionsPerCriteria, "symbol");
                var _previousPlusAdditions = _.union(_previousDatesSymbols, _additions);
                var _currentDateSymbols = _.difference(_previousPlusAdditions, _deletions);
                // console.log("_currentDateSymbols: ", _currentDateSymbols);

                // assign
                _holdingsMapPerStrategy[criteriaIdx][dateStr] = _currentDateSymbols;

                // check for potential backfills
                var _figureOutWhenAdded = _.difference(_deletions, _previousPlusAdditions);
                if (_figureOutWhenAdded.length > 0) {
                    console.log("figure out when these were added: ", _figureOutWhenAdded);
                    _.each(_figureOutWhenAdded, function (problemSymbol) {
                        if (!_initialDeletionsPerStrategyMap[criteriaIdx][problemSymbol]) {
                            _initialDeletionsPerStrategyMap[criteriaIdx][problemSymbol] = dateStr;
                        }
                    })
                }

                // console.log("-----------------------------------------------------------------");
            })

        })
        console.log("INITIAL DELETIONS MAP: ", _initialDeletionsPerStrategyMap);

        // backfill holdings based on _initialDeletionsPerStrategyMap.
        // These "initial deletions" may happen when a symbol's oldRatingId is among those of interest but no
        // prior newRatingId was detected on the date range.
        _.each(_initialDeletionsPerStrategyMap, function (obj, strategyIdx) {
            _.each(Object.keys(obj), function (symbol) {
                var _firstDeletionDate = obj[symbol];
                var _datesToAddSymbolHoldingTo = _.filter(_uniqDates, function (d) {return d < _firstDeletionDate; })
                _.each(_datesToAddSymbolHoldingTo, function (d) {
                    var _existingHoldings = _holdingsMapPerStrategy[strategyIdx][d];
                    if (_.contains(_existingHoldings, symbol)) {
                        console.log("_firstDeletionDate: ", symbol, _firstDeletionDate);
                        console.log("ERRRRRRRRRRRRRRRRRRR -- already contains", symbol, d, strategyIdx);
                    } else {
                        _holdingsMapPerStrategy[strategyIdx][d].push(symbol);
                    }
                })
            })
        })


        console.log("_holdingsMapPerStrategy: ", _holdingsMapPerStrategy);

        // generate combined holdings map
        var _RESULT = {};
        var _p = this.data.portfolio;
        _.each(_uniqDates, function (d) {
            // get an array of holdings from each strategy
            var _stratHoldingsArrForDay = [];
            _.each(_holdingsMapPerStrategy, function (obj) {
                _stratHoldingsArrForDay.push(obj[d]);
            })


            var _combinedForDay = [];
            _.each(_stratHoldingsArrForDay, function (arr, idx) {
                if (_p.criteriaType === "intersection") {
                    _combinedForDay = _.intersection(idx === 0 ? arr : _combinedForDay, arr);
                } else if (_p.criteriaType === "union") {
                    _combinedForDay = _.union(_combinedForDay, arr)
                } else if (_p.criteriaType === "weighted_union") {
                    console.log("need logic here");
                }
            })
            _RESULT[d] = _combinedForDay;
        })
        _.each(Object.keys(_RESULT), function (d) {
            var _symbols = _RESULT[d];
            var _wgt = 1 / _symbols.length;
            if (_symbols.length === 0) {
                console.log("look into this");
            }
            _.each(_symbols, function (symbol) {
                _portfolioItems.push({
                    dateString: d,
                    symbol: symbol,
                    weight: _wgt
                })
            })
        })
        console.log("RESULT: ", _RESULT);
        console.log("_portfolioItems: ", _portfolioItems);

        return _portfolioItems;
    }

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
    }

    getEndDateForPrices() {
        let _settings = Settings.findOne();
        var _4PMEST_IN_ISO = _settings.clientSettings.ratingChanges.fourPmInEstTimeString;
        return StocksReactUtils.getClosestPreviousWeekDayDateByCutoffTime(_4PMEST_IN_ISO, moment(this.state.endDate + " 17:00:00").tz("America/New_York"));
    }
    setUpStartEndDates(portfolioId) {
        let _newState = {
            previouslyLoadedPortfolioId: portfolioId,
            startDate: "",
            endDate: ""
        };
        this.setState(_newState);

        let _that = this;
        Meteor.call("getDefaultPerformanceDatesFor", portfolioId, function (err, res) {
            if (!err && res) {
                if (res.ratingChanges) {
                    _that.data.ratingChanges = res.ratingChanges;
                    _that.data.criteriaRatingScales = res.criteriaRatingScales;
                }
                _that.setState({
                    startDate: res.startDate,
                    endDate: res.endDate
                });
            } else {
                console.log(err.error);
            }
        });
    }

    componentWillMount() {
        this.setUpStartEndDates(this.props.portfolioId);
    }
    toggle(event) {
        this.setState({
            newItemShort: !this.state.newItemShort
        })
    }
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
                var _domNode = ReactDOM.findDOMNode(_that.refs.newItemSymbolStr);
                if (_domNode) {
                    ReactDOM.findDOMNode(_that.refs.newItemSymbolStr).value = "";
                }
                console.log("errror: ", error);
                console.log(result);
            });
        }
    }

    renderPortfolioUpdateEntry() {
        let _startDate = this.data.portfolio.rolling ? this.shiftStartDateBack2X(this.state.startDate, this.data.portfolio.lookback / 5 * 7) : this.state.startDate;
        // get the last date
        let _lastRebalanceDate = _.last(_.pluck(this.data.portfolioItems, "dateString"));
        let _latestPortfolioItems = this.data.portfolioItems.filter(function (obj) {
            return obj.dateString === _lastRebalanceDate;
        });
        // TODO: pass _latestPortfolioItems into a new compoment as properties so that user could edit them and
        // todo contd: submit an update to portfolio holdings via UI
        let _b = "btn btn-light";
        let _ab = "btn btn-light active";
        let _that = this;
        return <div>
            add a new item:
            <input type="text" ref="newItemDateStr" placeholder="Date" />
            <input type="text" ref="newItemSymbolStr" placeholder="Symbol" />
            <div className="btn-group" role="group" aria-label="...">
                <button type="button" className={!_that.state.newItemShort ? _ab : _b} onClick={_that.toggle}>Long</button>
                <button type="button" className={_that.state.newItemShort ? _ab : _b} onClick={_that.toggle}>Short</button>
            </div>
            <button className="btn btn-light btn-lg" onClick={_that.submitNewItem}>submit</button>
            <br/>
            <br/>
            {_startDate}
            <br/>
            {this.state.endDate}
            <br/>
            {this.data.rawPortfolioItems.reverse().map((obj, index) => {
                return <div key={index}>{obj.dateString}: {obj.symbol}{obj.short ? ", short" : ", long"}</div>
            })}
        </div>;
    }

    renderPortfolioPerformance() {
        // check if there is enough price data in the date range to generate performance
        let _uniqDates = this.data.uniqPortfItemDates;
        let _endDate = this.getEndDateForPrices();
        if (_uniqDates.indexOf(_endDate) === -1) {
            _uniqDates.push(_endDate);
        }
        let _minReqMap = {};
        let _items = this.data.portfolioItems;
        let _prices = this.state.stockPrices;

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
            let _purchaseAtType = "close";
            let _sellAtType = "close";
            let _symbolsToCheckSplitsFor = [];

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

                    let _weightedTotalChange = 0.0;
                    let _totalAbsWgt = 0.0;
                    _.each(_pItems, function (pItem) {
                        let symbol = pItem.symbol;
                        _totalAbsWgt += Math.abs(pItem.weight);
                        let _purchasePricesForSymbol = _prices.filter(function (obj) {
                            return obj.symbol === symbol && obj.dateString === _startDate;
                        });
                        let _sellPricesForSymbol = _prices.filter(function (obj) {
                            return obj.symbol === symbol && obj.dateString === _endDate;
                        });
                        if (_purchasePricesForSymbol.length === 1 && _sellPricesForSymbol.length === 1) {
                            let _purchasePrice = _purchasePricesForSymbol[0][_purchaseAtType];
                            let _sellPrice = _sellPricesForSymbol[0][_sellAtType];
                            if (!_purchasePrice || !_sellPrice) {
                                console.log("missing price data: ", _purchasePricesForSymbol[0].symbol, _purchasePricesForSymbol[0].dateString, _purchasePrice, _sellPricesForSymbol[0].dateString, _sellPrice);
                                _symbolsToCheckSplitsFor.push(symbol)
                            }
                            let _change = (_sellPrice - _purchasePrice) / _purchasePrice;

                            let _weightedChange = pItem.weight * _change;
                            _weightedTotalChange += _weightedChange;
                        } else {
                            console.log("ERRRRRRRRRRR", _purchasePricesForSymbol[0].symbol);
                        }
                    });
                    if (_totalAbsWgt < .9) {
                        console.log("this number should be 1: ", _totalAbsWgt);
                    }

                    _growthRates.push([date, _weightedTotalChange]);
                }
            });
            console.log("check these symbols: ", JSON.stringify(_.uniq(_symbolsToCheckSplitsFor)));
        }

        let _cumulativeGrowthRates = [];
        let _sp500GrowthRates = [];
        let _initialSP500Price;
        _.each(_growthRates, function (data, index) {
            if (index === 0) {
                _cumulativeGrowthRates.push([data[0], 1]);
                _initialSP500Price = _.findWhere(_prices, {dateString: data[0], symbol: "SPY"})["close"];
                _sp500GrowthRates.push([data[0], 1]);
            } else {
                _cumulativeGrowthRates.push([
                    data[0],
                    (_cumulativeGrowthRates[index-1][1]) * (data[1] + 1)
                ]);
                _sp500GrowthRates.push([
                    data[0],
                    _.findWhere(_prices, {dateString: data[0], symbol: "SPY"})["close"] / _initialSP500Price
                ]);
            }
        });
        let _graphData = {
            portfolio: _cumulativeGrowthRates,
            sp500: _sp500GrowthRates
        }

        return _missingData ?
            <div className="container">not enough price history</div> :
            _cumulativeGrowthRates.length > 1 ?
                <PortfolioPerformanceGraph graphData={_graphData} /> :
                "NOT ENOUGH PERFORMANCE DATA"
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextState.stockPrices || this.state.newItemShort !== nextState.newItemShort || this.props.portfolioId !== nextProps.portfolioId || this.state.startDate !== nextState.startDate || this.state.endDate !== nextState.endDate;
    }

    setDateRangeOptions() {
        StocksReact.ui.setDateRangeOptions("input-daterange");

        var _that = this;
        $('.form-control').on('change', function(event) {
            var _set = StocksReact.ui.getStateForDateRangeChangeEvent(event);
            _that.setState(_set);
        });
    }

    changingStart() {}
    changingEnd() {}

    render() {
        let _startDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.startDate);
        let _endDate = this.state.endDate !== "" && StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.getEndDateForPrices());

        return (
            <div className="container">
                {this.data.portfolio ?
                    (this.data.portfolioItems ?
                        ( this.state.stockPrices ?
                            <div>
                                {this.state.stockPrices.length}
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
}