AverageAndWeightedRatings = React.createClass({

    mixins: [ReactMeteorData],

    propTypes: {
        symbol: React.PropTypes.string.isRequired
        , showAvgRatings: React.PropTypes.bool.isRequired
        , showWeightedRating: React.PropTypes.bool.isRequired
    },

    getInitialState() {
        let _settings = Settings.findOne();
        var _4PMEST_IN_ISO = _settings.clientSettings.ratingChanges.fourPmInEstTimeString;
        let _avgRatingStartDate = StocksReact.utilities.getClosestNextWeekDayDate(moment().tz("America/New_York").subtract(90, "days"));
        let _avgRatingEndDate = StocksReact.utilities.getClosestPreviousWeekDayDateByCutoffTime(_4PMEST_IN_ISO);

        return {
            pctDownPerDay: 0.5,
            pctUpPerDay: 1.0,
            avgRatingStartDate: _avgRatingStartDate,
            avgRatingEndDate: _avgRatingEndDate,
            priceReactionDelayDays: 0
        }
    },

    getMeteorData() {
        let _symbol = this.props.symbol;
        let _data = {};
        let _currentUser = Meteor.user();
        let _settings = Settings.findOne();
        let _stockInfo = Stocks.findOne({_id: _symbol});
        _data.stuffIsBeingPulledRn = _stockInfo.pricesBeingPulledRightNow;


        let _format = "YYYY-MM-DD";

        let _dayDiff = 1;
        var _d = new Date().toISOString();
        var _dateStr = _d.substring(11, _d.length);
        var _4PMEST_IN_ISO = _settings.clientSettings.ratingChanges.fourPmInEstTimeString;
        if (_dateStr > _4PMEST_IN_ISO) {
            _dayDiff = 0;
        }

        let _avgRatingStartDate = this.state.avgRatingStartDate;
        let _avgRatingEndDate = this.state.avgRatingEndDate;

        let _startDateForRatingChangesSubscription =
            _currentUser ?
                _avgRatingStartDate :
                moment(new Date().toISOString()).subtract(_settings.clientSettings.upcomingEarningsReleases.numberOfDaysBeforeTodayForRatingChangesPublicationIfNoUser, 'days').format("YYYY-MM-DD");
        let _endDateRatingChanges = _avgRatingEndDate;
        let _ratingChangesHandle = Meteor.subscribe("ratingChangesForSymbols", [_symbol], _startDateForRatingChangesSubscription, _endDateRatingChanges);

        if (_stockInfo.pricesBeingPulledRightNow) {


            //IMPORTANT: nothing above can change before pricesBeingPulledRightNow flag is set to false on the server
            //otherwise getMeteorData will go here once again and endlessly call getStockPricesNew


            Meteor.call('getStockPricesNew', _symbol, _startDateForRatingChangesSubscription, _endDateRatingChanges);
        } else if (_ratingChangesHandle.ready() && !_stockInfo.pricesBeingPulledRightNow) {

            let _ratingScalesHandle = StocksReact.functions.getRatingScalesHandleFromAvailableRatingChanges();
            let _pricesHandle = Meteor.subscribe("stockPricesFor", [_symbol], _startDateForRatingChangesSubscription, _endDateRatingChanges);

            if (_pricesHandle.ready() && _ratingScalesHandle.ready()) {
                var _allNewStockPricesArr = NewStockPrices.find().fetch();
                _data.stockPrices = _allNewStockPricesArr;

                let _allAvailablePricesForSymbol = {
                    symbol: _symbol,
                    existingStartDate: _allNewStockPricesArr.length > 0 && _allNewStockPricesArr[0].dateString,
                    existingEndDate: _allNewStockPricesArr.length > 0 && _allNewStockPricesArr[_allNewStockPricesArr.length - 1].dateString,
                    historicalData: _allNewStockPricesArr
                };

                var _alreadyPulledInfoForThisDateRangeBefore = _stockInfo &&
                    _stockInfo.minRequestedStartDate &&
                    _stockInfo.maxRequestedEndDate &&
                    _stockInfo.minRequestedStartDate <= _startDateForRatingChangesSubscription && _stockInfo.maxRequestedEndDate >= _endDateRatingChanges;

                if (_alreadyPulledInfoForThisDateRangeBefore || (
                    _allAvailablePricesForSymbol &&
                    _allAvailablePricesForSymbol.existingStartDate &&
                    _allAvailablePricesForSymbol.existingEndDate &&
                    (moment(_startDateForRatingChangesSubscription).isSame(_allAvailablePricesForSymbol.existingStartDate) || moment(_startDateForRatingChangesSubscription).isAfter(_allAvailablePricesForSymbol.existingStartDate)) &&
                    (moment(_endDateRatingChanges).isSame(_allAvailablePricesForSymbol.existingEndDate) || moment(_endDateRatingChanges).isBefore(_allAvailablePricesForSymbol.existingEndDate))
                )) {

                    let result = this.getPricesBetweenTwoDates(_allAvailablePricesForSymbol, _startDateForRatingChangesSubscription, _endDateRatingChanges);

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
                        var _weightedRatingsSeriesEveryDay = StocksReact.functions.generateWeightedAnalystRatingsTimeSeriesEveryDay(_avgRatingsSeriesEveryDay, _startDateForRegression, _endDateForRegression, result.historicalData, _priceReactionDelayInDays, "adjClose", this.state.pctDownPerDay, this.state.pctUpPerDay);

                        var _objToGraph = result;
                        if (this.props.showAvgRatings && this.props.showWeightedRating) {
                            _objToGraph = _.extend(_objToGraph, {
                                avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
                                weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay
                            })
                        } else if (this.props.showAvgRatings) {
                            _objToGraph = _.extend(_objToGraph, {
                                avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay
                            })
                        } else if (this.props.showWeightedRating) {
                            _objToGraph = _.extend(_objToGraph, {
                                weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay
                            })
                        }

                        _data.stocksToGraphObjs = [JSON.parse(JSON.stringify(_objToGraph))];
                    }

                    //todo: make sure we are already subscribed to EarningsReleases
                    let _allEarningsReleasesForSymbol = EarningsReleases.find({symbol: _symbol, reportDateNextFiscalQuarter: {$exists: true}}).fetch();

                    _data.ratingChangesAndStockPricesSubscriptionsForSymbolReady = true;
                    _data.ratingChanges = RatingChanges.find({symbol: _symbol}).fetch();
                    _data.ratingScales = RatingScales.find().fetch()
                    _data.earningsReleases = _allEarningsReleasesForSymbol;
                    _data.allGraphData = _.extend(result, {
                        avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
                        weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay
                    })

                } else {
                    //only set download flag to true
                    Meteor.call('setPricesLoadingTag', _symbol, true);
                }
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
                var _extractedDateStringNoTimezone = moment(priceObjForDay.date).tz("America/New_York").format("YYYY-MM-DD");
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
            this.state.pctDownPerDay !== nextState.pctDownPerDay || this.state.pctUpPerDay !== nextState.pctUpPerDay ||
            this.state.avgRatingStartDate !== nextState.avgRatingStartDate ||
            this.state.avgRatingEndDate !== nextState.avgRatingEndDate || this.state.priceReactionDelayDays !== nextState.priceReactionDelayDays
            || this.props.showAvgRatings !== nextProps.showAvgRatings || this.props.showWeightedRating !== nextProps.showWeightedRating
        ) {
            return true;
        }

        return false;
    },

    getIndividualRatingsEveryDay(prices, ratingChanges, ratingScales) {
        let _res = [];
        let _uniqFirmIds = _.uniq(_.pluck(ratingChanges, "researchFirmId"));
        let _that = this;

        _.each(prices, function (priceObj) {
            let _ratingsMap = {};
            _.each(_uniqFirmIds, function (firmId) {
                let _ratingScaleId = _that.getScaleIdForFirmAndDate(firmId, priceObj.dateString, ratingChanges);
                let _univVal = ratingScales.filter(function (obj) {
                    return obj._id === _ratingScaleId
                })[0].universalScaleValue;
                _ratingsMap[firmId] = _univVal;
            });

            _res.push(_.extend(priceObj, {companyRatingsByResearchFirm: _ratingsMap}));
        });

        return _res;
    },

    getScaleIdForFirmAndDate(firmId, dateString, allRatingChanges) {
        let _scaleId;
        let ratingChanges = allRatingChanges.filter(function (obj) {
            return obj.researchFirmId === firmId;
        });

        _.each(ratingChanges, function (ratingChange) {
            if (_scaleId) {
                // if value is already set, check if it should be reset to something newer
                if (ratingChange.dateString <= dateString) {
                    _scaleId = ratingChange.newRatingId;
                }
            } else {
                // initialize the value. if date of rating change is less or equal to the date string, then grab the new value. otherwise grab
                if (ratingChange.dateString <= dateString) {
                    _scaleId = ratingChange.newRatingId;
                } else {
                    _scaleId = ratingChange.oldRatingId;
                }
            }
        });

        return _scaleId;
    },

    // source 1: http://stackoverflow.com/questions/11849308/generate-colors-between-red-and-green-for-an-input-range
    // source 2: http://jsfiddle.net/xgJ2e/2/
    hsv2rgb(h, s, v) {
        // adapted from http://schinckel.net/2012/01/10/hsv-to-rgb-in-javascript/
        var rgb, i, data = [];
        if (s === 0) {
            rgb = [v,v,v];
        } else {
            h = h / 60;
            i = Math.floor(h);
            data = [v*(1-s), v*(1-s*(h-i)), v*(1-s*(1-(h-i)))];
            switch(i) {
                case 0:
                    rgb = [v, data[2], data[0]];
                    break;
                case 1:
                    rgb = [data[1], v, data[0]];
                    break;
                case 2:
                    rgb = [data[0], v, data[2]];
                    break;
                case 3:
                    rgb = [data[0], data[1], v];
                    break;
                case 4:
                    rgb = [data[2], data[0], v];
                    break;
                default:
                    rgb = [v, data[0], data[1]];
                    break;
            }
        }
        return '#' + rgb.map(function(x){
                return ("0" + Math.round(x*255).toString(16)).slice(-2);
            }).join('');
    },

    renderHistoricalRatingChangesByCompany() {
        let _ratingChanges = this.data.ratingChanges;
        let _uniqueFirmIds = _.uniq(_.pluck(_ratingChanges, "researchFirmId"));
        let _dateAndUniqFirmIds = ["date"].concat(_uniqueFirmIds);
        let _firmIdx = ["date"].concat(_.range(_uniqueFirmIds.length));
        let _prices = this.data.stockPrices;
        let _individualRatingsEveryDay = this.getIndividualRatingsEveryDay(_prices, _ratingChanges, this.data.ratingScales);
        let hsv2rgb = this.hsv2rgb;

        return <div>
            <table>
                <thead>
                    <tr>
                        {_dateAndUniqFirmIds.map((firm, index) => {
                            return <th key={firm}>{firm !== "date" ? <button className="btn btn-default" key={firm}>{index}</button> : firm}</th>;
                        })}
                    </tr>
                </thead>

                <tbody>
                    {_individualRatingsEveryDay.reverse().map((row) => {
                        let _rowKey = row["dateString"];

                        return <tr key={_rowKey}>{_dateAndUniqFirmIds.map((firm) => {
                            let _val = row["companyRatingsByResearchFirm"][firm];
                            let _style = {
                                textAlign: "center"
                            };
                            if (parseInt(_val)) {
                                {/*let r = 255;*/}
                                {/*let g = Math.floor((100 - _val) / 50 * 255);*/}
                                {/*let b = Math.floor((100 - _val) / 50 * 255);*/}

                                let n = _val / 120 * 100;

                                {/*let r = Math.floor((255 * n) / 100);*/}
                                {/*let g = Math.floor((255 * (100 - n)) / 100);*/}
                                {/*let b = 0;*/}

                                {/*_style = _.extend(_style, {*/}
                                    {/*backgroundColor: "rgb(" + r + "," + g + "," + b + ")"*/}
                                {/*});*/}

                                {/*var h= Math.floor((100 - n) * 120 / 100);*/}
                                var h= Math.floor((n) * 120 / 100);
                                var s = Math.abs(n - 50)/50;
                                var v = 1;
                                _style = _.extend(_style, {
                                    backgroundColor: hsv2rgb(h, s, 1)
                                });
                            }
                            let _cellKey = _rowKey + firm;
                            let _strVal = firm === "date" ? (<span style={{margin: "30px"}}>{row["dateString"]}</span>) : (parseInt(_val) || "");

                            return <td style={_style} key={_cellKey}>
                                {_strVal}
                                </td>;
                        })}</tr>;
                    })}
                </tbody>
            </table>
        </div>;
    },

    renderAllExistingUpDowngradesForStock: function() {
        var _that = this;
        return <div className="row allUpDowngrades">
            <br/>
            {this.data.ratingChanges.length > 0 ? <h3>historic analyst ratings (firm ids are column headers):</h3> : <p>no analyst upgrades/downgrades</p>}
            {this.renderHistoricalRatingChangesByCompany()}
            <ul>
                {/*{this.data.ratingChanges.map((ratingChange, index) => {*/}
                    {/*let _oldRatingValue = _.findWhere(_that.data.ratingScales, {_id: ratingChange.oldRatingId}).universalScaleValue;*/}
                    {/*let _newRatingValue = _.findWhere(_that.data.ratingScales, {_id: ratingChange.newRatingId}).universalScaleValue;*/}
                    {/*return(<li key={index}>*/}
                        {/*<div>*/}
                            {/*Old rating: {_oldRatingValue ? _oldRatingValue : "unknown"}<br/>*/}
                            {/*New rating: {_newRatingValue ? _newRatingValue : "unknown"}<br/>*/}
                            {/*As of: {ratingChange.date.substring(0,16)}<br/>*/}
                            {/*Firm name: {ratingChange.researchFirmId ? ratingChange.researchFirmId : "no premium access"}*/}
                        {/*</div>*/}
                    {/*</li>);*/}
                {/*})}*/}
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

    refreshRegr: function (event) {
        var _newState = {};
        _newState[event.target.id] = parseFloat(event.target.value);
        this.setState(_newState);
    },
    changePct: function (event) {
        $("#" + event.target.id).val(event.target.value);
    },

    renderAvgAnalystRatingsGraph: function() {
        let _startDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.avgRatingStartDate);
        let _endDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.avgRatingEndDate);
        return (this.data.ratingChanges.length > 0 ? <div>
                <span>price reaction delay for rating changes (in days): {this.state.priceReactionDelayDays} </span>
                <button type="button" className="btn btn-default" onClick={this.decreasePriceDelay}><span className="glyphicon glyphicon-minus" aria-hidden="true"></span></button>
                <button type="button" className="btn btn-default" onClick={this.increasePriceDelay}><span className="glyphicon glyphicon-plus" aria-hidden="true"></span></button>
                <input type="text" className="pctDownPerDay" ref="pctDownPerDay" id="pctDownPerDay" placeholder="0.5" onBlur={this.refreshRegr} onChange={this.changePct}/>
                <input type="text" className="pctUpPerDay" ref="pctUpPerDay" id="pctUpPerDay" placeholder="1.0" onBlur={this.refreshRegr} onChange={this.changePct}/>

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

    renderEpsMeanEstimates() {

        return this.data.earningsReleases.map((release, index) => {
            let _sourceFlag = release.reportSourceFlag;
            let _timeOfDayCodeForEarningsRelease = release.reportTimeOfDayCode;
            let _key = release.symbol + "_" + index;
            return (
                <div key={_key}>
                    <h1>This quarter</h1>
                    <h1>Next earning release date: {release.reportDateNextFiscalQuarter} ({_sourceFlag === 1 ? "Company confirmed" : _sourceFlag === 2 ? "Estimated based on algorithm" : _sourceFlag === 3 ? "Unknown" : null},&nbsp;
                        {_timeOfDayCodeForEarningsRelease === 1 ? "After market close" : _timeOfDayCodeForEarningsRelease === 2 ? "Before the open" : _timeOfDayCodeForEarningsRelease === 3 ? "During market trading" : _timeOfDayCodeForEarningsRelease === 4 ? "Unknown" : null})</h1>
                    <h1>Expected EPS: {release.epsMeanEstimateNextFiscalQuarter}</h1>
                    <br/>
                    <h3>Previous quarter EPS: {release.epsActualPreviousFiscalQuarter}</h3>
                    <h3>EPS a year ago: {release.epsActualOneYearAgoFiscalQuarter}</h3>
                    <br/>
                    <h5>Next quarter</h5>
                    <h5>Report date: {release.reportDateNextNextFiscalQuarter}</h5>
                </div>
            )

        })
    },

    render() {

        return (
            <div>
                <br/>
                {this.data.stuffIsBeingPulledRn ? 'prices are being loaded from Yahoo Finance right now' : <div>
                    {this.data.ratingChangesAndStockPricesSubscriptionsForSymbolReady ?
                        <div>
                            <br/>
                            {this.renderAvgAnalystRatingsGraph()}
                            <br/><br/><br/><br/>
                            {this.renderAllExistingUpDowngradesForStock()}
                            <br/>
                            {this.renderEpsMeanEstimates()}
                            <br/>
                        </div> :
                    "getting ratings changes and prices for " + this.props.symbol
                    }
                </div>}
            </div>
        );
    }
});