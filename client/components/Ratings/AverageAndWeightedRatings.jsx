import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import moment from 'moment-timezone';
import { EJSON } from 'meteor/ejson';

import StocksGraph from '../StocksGraph.jsx';
import RegressionPerformance from './RegressionPerformance.jsx';

const avgRatingStartDate = new ReactiveVar(undefined);
const avgRatingEndDate = new ReactiveVar(undefined);
const allStockPrices = new ReactiveVar(undefined);
const priceReactionDelayDays = new ReactiveVar(0);
const pctDownPerDay = new ReactiveVar(0.5);
const pctUpPerDay = new ReactiveVar(0.5);
const stepSizePow = new ReactiveVar(-7);
const regrIterNum = new ReactiveVar(30);
const simpleRollingPx = new ReactiveVar(undefined);
const ratingChangesLoading = new ReactiveVar(false);
const ratingChanges = new ReactiveVar([]);

class AverageAndWeightedRatings extends Component {

    constructor(props) {
        super(props);

        let _settings = Settings.findOne();
        var _4PMEST_IN_ISO = _settings && _settings.clientSettings.ratingChanges.fourPmInEstTimeString || "16:00:00";
        let _avgRatingEndDate = StocksReactUtils.getClosestPreviousWeekDayDateByCutoffTime(_4PMEST_IN_ISO);

        this.state = {
            pxRollingDays: 50,
            pctDownPerDay: pctDownPerDay.get(),
            pctUpPerDay: pctUpPerDay.get(),
            stepSizePow: stepSizePow.get(),
            regrIterNum: regrIterNum.get(),
            avgRatingEndDate: _avgRatingEndDate,
            priceReactionDelayDays: priceReactionDelayDays.get(),
        };

        avgRatingEndDate.set(_avgRatingEndDate);

        this.toggleFirm = this.toggleFirm.bind(this);
        this.decreasePriceDelay = this.decreasePriceDelay.bind(this);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.symbol !== nextProps.symbol) {
            this.getPricesForSymbolAndEarliestRatingsChangeDate(nextProps.symbol);
        }
    }

    componentWillMount() {
        this.getPricesForSymbolAndEarliestRatingsChangeDate(this.props.symbol);

        Tracker.autorun(() => {
            const symbol = this.props.symbol;
            const startDate = avgRatingStartDate.get();
            const endDate = avgRatingEndDate.get();

            if (!Settings.findOne() || !startDate) {
                return;
            }

            ratingChangesLoading.set(true);
            ratingChanges.set([]);
            Meteor.call(
                'ratingChangesForSymbol',
                {symbol, startDate, endDate},
                (err, res) => {
                    if (!err) {
                        ratingChanges.set(res);
                    } else {
                        console.log('there was an error', err);
                    }
                    ratingChangesLoading.set(false);
                }
            );
        });
    }
    // this is needed to keep the reactive vars and the local state in sync. the synced state is needed for shouldComponentUpdate
    syncReactiveVarsAndState(reactiveVars, values, stateKeys) {
        let newState = {};
        reactiveVars.forEach((reactiveVar, index) => {
            reactiveVar.set(values[index]);
            newState[stateKeys[index]] = values[index];
        });
        this.setState(newState);
    }
    syncOneReactiveVarAndState(reactiveVar, value, stateKey) {
        this.syncReactiveVarsAndState([reactiveVar], [value], [stateKey]);
    }

    getPricesForSymbolAndEarliestRatingsChangeDate(symbol) {
        var _that = this;
        this.syncReactiveVarsAndState([allStockPrices, avgRatingStartDate], [undefined, undefined], ['allStockPrices', 'avgRatingStartDate']);
        Meteor.call("getPricesForSymbol", symbol, function (err1, res1) {
            Meteor.call("getEarliestRatingChange", symbol, function (err2, res2) {
                if (res1 && res1.length > 0 && res2 && !err1 && !err2) {
                    var _simpleRollingPx = StocksReactUtils.stockPrices.getSimpleRollingPx(res1, res2, _that.state.pxRollingDays);
                    _that.syncReactiveVarsAndState([
                        avgRatingStartDate,
                        allStockPrices,
                        simpleRollingPx,
                    ], [
                        res2,
                        res1,
                        _simpleRollingPx,
                    ], [
                        'avgRatingStartDate',
                        'allStockPrices',
                        'simpleRollingPx',
                    ]);
                } else {
                    console.log("error in prices or rating changes");
                }
            });
        });
    }

    shouldComponentUpdate(nextProps, nextState) {
        //update component only when there is new data available to be graphed, not necessarily when there is a new symbol prop
        //because it takes a few seconds after new symbol prop is set to get new data to graph
        if (EJSON.equals(this.props, nextProps) && EJSON.equals(this.state, nextState)) {
            return false;
        }
        if (this.props.symbol !== nextProps.symbol ||
                !EJSON.equals(nextState.allStockPrices, this.state.allStockPrices) ||
            this.state.regrIterNum !== nextState.regrIterNum ||
                !EJSON.equals(this.props.allGraphData, nextProps.allGraphData) ||
            this.state.stepSizePow !== nextState.stepSizePow ||
            this.state.pctDownPerDay !== nextState.pctDownPerDay || this.state.pctUpPerDay !== nextState.pctUpPerDay ||
            this.state.avgRatingStartDate !== nextState.avgRatingStartDate ||
            this.state.avgRatingEndDate !== nextState.avgRatingEndDate || this.state.priceReactionDelayDays !== nextState.priceReactionDelayDays
            || this.props.showAvgRatings !== nextProps.showAvgRatings || this.props.showWeightedRating !== nextProps.showWeightedRating
        ) {
            return true;
        }

        return false;
    }

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
    }

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
    }

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
    }

    toggleFirm(event) {
        console.log(event.target.value);
    }

    renderHistoricalRatingChangesByCompany() {
        let _ratingChanges = this.props.ratingChanges;
        let _uniqueFirmIds = _.uniq(_.pluck(_ratingChanges, "researchFirmId"));
        let _dateAndUniqFirmIds = ["date"].concat(_uniqueFirmIds);
        let _firmIdx = ["date"].concat(_.range(_uniqueFirmIds.length));
        let _prices = this.props.stockPrices;
        let _individualRatingsEveryDay = this.getIndividualRatingsEveryDay(_prices, _ratingChanges, this.props.ratingScales);
        let hsv2rgb = this.hsv2rgb;
        let _regrWeights = this.props.regrWeights;

        return <div>
            <table>
                <thead>
                    <tr>
                        {_dateAndUniqFirmIds.map((firm, index) => {
                            let _btnTxt = _regrWeights[firm] && _regrWeights[firm] >= 0.001 ? (index + " (" + _regrWeights[firm].toFixed(2) + ")") : index;
                            return <th key={firm}>{firm !== "date" ? <button className="btn btn-light" key={firm} value={firm} onClick={this.toggleFirm}>{_btnTxt}</button> : firm}</th>;
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
    }

    renderAllExistingUpDowngradesForStock() {
        var _that = this;
        return <div className="row allUpDowngrades">
            <br/>
            {this.props.ratingChanges.length > 0 ? <h3>historic analyst ratings (firm ids are column headers):</h3> : <p>no analyst upgrades/downgrades</p>}
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
    }

    changingStart(date) {
        this.syncOneReactiveVarAndState(avgRatingStartDate, StocksReact.ui.getStateForDateRangeChangeEvent(false, date), 'avgRatingStartDate');
    }
    changingEnd(date) {
        this.syncOneReactiveVarAndState(avgRatingEndDate, StocksReact.ui.getStateForDateRangeChangeEvent(false, date), 'avgRatingEndDate');
    }

    decreasePriceDelay() {
        this.syncOneReactiveVarAndState(priceReactionDelayDays, priceReactionDelayDays.get() - 1, 'priceReactionDelayDays');
    }
    increasePriceDelay() {
        this.syncOneReactiveVarAndState(priceReactionDelayDays, priceReactionDelayDays.get() + 1, 'priceReactionDelayDays');
    }
    refreshRegrIterNum(event) {
        this.syncOneReactiveVarAndState(regrIterNum, parseInt(event.target.value), 'regrIterNum');
    }
    increaseStepSize() {
        this.syncOneReactiveVarAndState(stepSizePow, stepSizePow.get() + 1, 'stepSizePow');
    }
    decreaseStepSize() {
        this.syncOneReactiveVarAndState(stepSizePow, stepSizePow.get() - 1, 'stepSizePow');
    }
    setPctDown(event) {
        this.syncOneReactiveVarAndState(pctDownPerDay, parseFloat(event.target.value), 'pctDownPerDay');
    }
    setPctUp(event) {
        this.syncOneReactiveVarAndState(pctUpPerDay, parseFloat(event.target.value), 'pctUpPerDay');
    }


    renderAvgAnalystRatingsGraph() {
        let _startDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(avgRatingStartDate.get());
        let _endDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(avgRatingEndDate.get());
        let _stepSize = Math.pow(10, stepSizePow.get());
        return (this.props.ratingChanges.length > 0 ? <div>
                <span>price reaction delay for rating changes (in days): {priceReactionDelayDays.get()} </span>
                <button type="button" className="btn btn-light" onClick={this.decreasePriceDelay.bind(this)}>-</button>
                <button type="button" className="btn btn-light" onClick={this.increasePriceDelay.bind(this)}>+</button>
                <input type="text" className="pctDownPerDay" id="pctDownPerDay" placeholder={pctDownPerDay.get()} onBlur={this.setPctDown.bind(this)} />
                <input type="text" className="pctUpPerDay" id="pctUpPerDay" placeholder={pctUpPerDay.get()} onBlur={this.setPctUp.bind(this)} />
                <br/>
                increase/decrease step size: {_stepSize} <button className="btn btn-light" onClick={this.decreaseStepSize.bind(this)}>-</button>
                <button className="btn btn-light" onClick={this.increaseStepSize.bind(this)}>+</button>
                # of regression iter: <input type="text" placeholder={regrIterNum.get()} onBlur={this.refreshRegrIterNum.bind(this)}/>

                <DatePicker selected={new Date(moment(avgRatingStartDate.get()))} onChange={date => this.changingStart(date)} />
                <DatePicker selected={new Date(moment(avgRatingEndDate.get()))} onChange={date => this.changingEnd(date)} />

            <div className="col-md-12 individualStockGraph">
                <StocksGraph
                    stocksToGraphObjects={this.props.stocksToGraphObjs}/>
            </div>
        </div> : null);
    }

    renderEpsMeanEstimates() {

        return this.props.earningsReleases.map((release, index) => {
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
    }

    render() {

        return (
            <div>
                <br/>
                <div>
                    {this.props.ratingChangesAndStockPricesSubscriptionsForSymbolReady ?
                        <div>
                            {this.renderAvgAnalystRatingsGraph()}
                            <br/><br/><br/><br/>
                            <RegressionPerformance symbol={this.props.symbol}/>
                            {this.renderAllExistingUpDowngradesForStock()}
                            <br/>
                            {this.renderEpsMeanEstimates()}
                            <br/>
                        </div> :
                    "getting ratings changes and prices for " + this.props.symbol
                    }
                </div>
            </div>
        );
    }
}

export default withTracker((props) => {

    let _avgRatingStartDate = avgRatingStartDate.get();
    let _avgRatingEndDate = avgRatingEndDate.get();
    let _allStockPrices = allStockPrices.get();



    let _symbol = props.symbol;
    const pricesReady = _allStockPrices?.[0].symbol === _symbol;
    if (!pricesReady) {
        return {};
    }
    let _data = {};
    let _currentUser = Meteor.user();
    let _settings = Settings.findOne();
    if (!_settings || !_avgRatingStartDate) {
        return {};
    }


    let _format = "YYYY-MM-DD";

    let _dayDiff = 1;
    var _d = new Date().toISOString();
    var _dateStr = _d.substring(11, _d.length);
    var _4PMEST_IN_ISO = _settings.clientSettings.ratingChanges.fourPmInEstTimeString;
    if (_dateStr > _4PMEST_IN_ISO) {
        _dayDiff = 0;
    }

    let _startDateForRatingChangesSubscription =
        _currentUser ?
            _avgRatingStartDate :
            moment(new Date().toISOString()).subtract(_settings.clientSettings.upcomingEarningsReleases.numberOfDaysBeforeTodayForRatingChangesPublicationIfNoUser, 'days').format("YYYY-MM-DD");
    let _endDateRatingChanges = _avgRatingEndDate;

    if (_allStockPrices && !ratingChangesLoading.get()) {
        const rC = ratingChanges.get();

        let _ratingScalesHandle = StocksReact.functions.getRatingScalesHandleFromAvailableRatingChanges(rC);

        if (_ratingScalesHandle.ready()) {
            var _allNewStockPricesArr = _allStockPrices;
            var _pricesWithNoAdjClose = _.filter(_allNewStockPricesArr, function (price) { return !price["adjClose"];})
            if (_pricesWithNoAdjClose.length > 0) {
                console.log("ERROR, these price dates do not have adjClose: ", _.pluck(_pricesWithNoAdjClose, "dateString"));
            }

            let _allAvailablePricesForSymbol = {
                symbol: _symbol,
                historicalData: _allNewStockPricesArr
            };

            if (rC.length > 0) {

                let result = _.extend(_allAvailablePricesForSymbol, {historicalData: StocksReactUtils.stockPrices.getPricesBetween(_allAvailablePricesForSymbol.historicalData, _startDateForRatingChangesSubscription, _endDateRatingChanges)});
                _data.stockPrices = result.historicalData;

                _data.stocksToGraphObjs = [];
                var _startDate = _startDateForRatingChangesSubscription;
                var _endDate = _endDateRatingChanges;
                var _averageAnalystRatingSeries = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeries(_symbol, _startDate, _endDate, rC);
                //TODO: start date and end date for regression are coming from a different date picker
                var _startDateForRegression = _startDate;
                var _endDateForRegression = _endDate;
                if (result && result.historicalData) {
                    var _avgRatingsSeriesEveryDay = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeriesEveryDay(_averageAnalystRatingSeries, result.historicalData);
                    var _priceReactionDelayInDays = priceReactionDelayDays.get();
                    var _weightedRatingsSeriesEveryDay = StocksReactUtils.ratingChanges.generateWeightedAnalystRatingsTimeSeriesEveryDay(_avgRatingsSeriesEveryDay, _startDateForRegression, _endDateForRegression, result.historicalData, _priceReactionDelayInDays, "adjClose", pctDownPerDay.get(), pctUpPerDay.get(), Math.pow(10, stepSizePow.get()), regrIterNum.get());
                    _data.regrWeights = _weightedRatingsSeriesEveryDay.weights;
                    _weightedRatingsSeriesEveryDay = _weightedRatingsSeriesEveryDay.ratings;
                    var _predictionsBasedOnAvgRatings = StocksReactUtils.ratingChanges.predictionsBasedOnRatings(_.map(_avgRatingsSeriesEveryDay, function (obj) {
                        return {date: obj.date, rating: obj.avg, dateString: obj.date.toISOString().substring(0,10)};
                    }), result.historicalData, "adjClose", simpleRollingPx.get(), 0, 120, 60, pctDownPerDay.get(), pctUpPerDay.get());
                    var _predictionsBasedOnWeightedRatings = StocksReactUtils.ratingChanges.predictionsBasedOnRatings(_.map(_weightedRatingsSeriesEveryDay, function (obj) {
                        return {date: obj.date, rating: obj.weightedRating, dateString: obj.date.toISOString().substring(0,10)};
                    }), result.historicalData, "adjClose", simpleRollingPx.get(), 0, 120, 60, pctDownPerDay.get(), pctUpPerDay.get());

                    var _objToGraph = result;
                    if (props.showAvgRatings && props.showWeightedRating) {
                        _objToGraph = _.extend(_objToGraph, {
                            avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
                            weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay,
                            predictionsBasedOnWeightedRatings: _predictionsBasedOnWeightedRatings,
                            predictionsBasedOnAvgRatings: _predictionsBasedOnAvgRatings
                        })
                    } else if (props.showAvgRatings) {
                        _objToGraph = _.extend(_objToGraph, {
                            avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
                            predictionsBasedOnAvgRatings: _predictionsBasedOnAvgRatings
                        })
                    } else if (props.showWeightedRating) {
                        _objToGraph = _.extend(_objToGraph, {
                            weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay,
                            predictionsBasedOnWeightedRatings: _predictionsBasedOnWeightedRatings
                        })
                    }

                    _data.stocksToGraphObjs = [JSON.parse(JSON.stringify(_objToGraph))];
                }

                //todo: make sure we are already subscribed to EarningsReleases
                let _allEarningsReleasesForSymbol = props.earningsReleases;

                _data.ratingChangesAndStockPricesSubscriptionsForSymbolReady = true;
                _data.ratingChanges = rC;
                _data.ratingScales = RatingScales.find().fetch()
                _data.earningsReleases = _allEarningsReleasesForSymbol;
                _data.allGraphData = _.extend(result, {
                    avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
                    weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay
                })

            } else {
                console.log("there are no rating changes");
            }
        }
    }

    return _data;
})(AverageAndWeightedRatings);