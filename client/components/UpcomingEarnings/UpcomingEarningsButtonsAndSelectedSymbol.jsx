import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import moment from 'moment-timezone';

import AverageAndWeightedRatings from "../Ratings/AverageAndWeightedRatings.jsx";

let _ratingChangesDateFormat = "YYYY-MM-DD";
const selectedSymbolIndex = new ReactiveVar(1);
const startDateRatingChanges = new ReactiveVar(moment(new Date().toISOString()).subtract(90, 'days').format(_ratingChangesDateFormat));
const endDateRatingChanges = new ReactiveVar(moment(new Date().toISOString()).format(_ratingChangesDateFormat));

class UpcomingEarningsButtonsAndSelectedSymbol extends Component {

    constructor(props) {
        super(props);

        this.state = {
            showAllButtons: false
        };

        this.nextSymbolIndex = this.nextSymbolIndex.bind(this);
        this.changeShowAllBtnsSetting = this.changeShowAllBtnsSetting.bind(this);
        this.nextEarningsRelease = this.nextEarningsRelease.bind(this);
        this.previousEarningsRelease = this.previousEarningsRelease.bind(this);
    }

    setNewSelectedSymbol(symbol, index) {
        selectedSymbolIndex.set(index);
    }

    renderButtons() {
        let _earnRel = this.props.earningReleases;
        let _symbols = _.map(this.props.uniqueSymbols, function (symbolStr) {
            let _earnRelPerSymbol = _earnRel.filter(function (obj) {
                return obj.symbol === symbolStr;
            })

            var _oneEarnRel;
            if (_earnRelPerSymbol.length > 1) {
                // if more than 1, then grab the latest (asOf attribute)
                _earnRelPerSymbol = _.sortBy(_earnRelPerSymbol, "asOf");
                _oneEarnRel = _earnRelPerSymbol[_earnRelPerSymbol.length - 1];
            } else {
                _oneEarnRel = _earnRelPerSymbol[0];
            }
            return {
                symbol: symbolStr,
                reportDateNextFiscalQuarter: _oneEarnRel.reportDateNextFiscalQuarter,
                reportTimeOfDayCode: _oneEarnRel.reportTimeOfDayCode
            };
        });

        // now sort by reportTimeOfDayCode
        // multiply date by 10 and then add 1, 2, 3, or 4 depending on reportTimeOfDayCode
        _symbols = _.sortBy(_symbols, function (obj) {
            return obj.reportDateNextFiscalQuarter * 10 + (obj.reportTimeOfDayCode === 2 ? 1 : obj.reportTimeOfDayCode === 3 ? 2 : obj.reportTimeOfDayCode === 1 ? 3 : 4 )
        })

        let _ratingChangesSymbols = _.pluck(this.props.ratingChanges, "symbol");


        return _symbols.map((symbolObj, index) => {
            let symbol = symbolObj.symbol;
            let _btnClass = "btn btn-light" + (index === selectedSymbolIndex.get() ? " active" : "");
            let _key = symbol + "_" + index;
            let _count = _.countBy(_ratingChangesSymbols, function(symb) {
                return symb === symbol ? "yes" : "no";
            });





            let _ratingChangesForSymbol = _.filter(this.props.ratingChanges, function(obj) {
                return obj.symbol === symbol;
            })
            //console.log("rating changes for symbol: ", _ratingChangesForSymbol);
            let _uniqueResearchFirmIdsArr = _.uniq(_.pluck(_ratingChangesForSymbol, "researchFirmId"));
            //console.log("symbol: ", symbol);
            //console.log("unique research firm ids: ", _uniqueResearchFirmIdsArr);


            //todo now for each unique firm id look thru all _ratingChangesForSymbol and find the one with the latest date and
            //todo continued reject it if it's coverage dropped
            let _latestRatingScaleIdsForUniqueFirms = [];
            _uniqueResearchFirmIdsArr.forEach(function(researchFirmId) {
                //need to find the latest
                let _ratingChangesForSymbolAndResearchFirm = _.filter(_ratingChangesForSymbol, function(ratingChange) {
                    return ratingChange.researchFirmId === researchFirmId;
                })
                let _sorted = _.sortBy(_ratingChangesForSymbolAndResearchFirm, function(obj) {
                    return obj.dateString;
                });
                //pick the first item in _sorted
                //find the corresponding ratingScale for newRatingId
                //check if the universal value of that rating scale is a number
                //if yes, then push to number of total latest analyst ratings
                let _latestRatingForStockByFirm = _sorted.length > 0 ? _sorted[_sorted.length - 1] : null;
                if (_latestRatingForStockByFirm) {
                    let _ratingScale = RatingScales.findOne(_latestRatingForStockByFirm.newRatingId);
                    if (_ratingScale && _ratingScale.universalScaleValue && !isNaN(_ratingScale.universalScaleValue)) {
                        _latestRatingScaleIdsForUniqueFirms.push(_ratingScale._id);
                    }
                }
            });

            //console.log("symbol: ", symbol );
            //console.log("_count: ", _count);
            let _numOfRatingChangesForSymbol = _count["yes"] ? _count["yes"] : 0;
            //TODO need number of current ratings with unique firms (excluding firms that dropped coverage), not number of rating changes
            let _numberOfLatestReports = _latestRatingScaleIdsForUniqueFirms.length;

            let nextAmt = this.props.uniqueSymbols.length - (1 + this.nextSymbolIndex(selectedSymbolIndex.get()));
            let _firstDay = index === 0;
            let _newDay = index !== 0 && symbolObj.reportDateNextFiscalQuarter !== _symbols[index - 1].reportDateNextFiscalQuarter;
            let _newTimeOfDay = index !== 0 && symbolObj.reportTimeOfDayCode !== _symbols[index - 1].reportTimeOfDayCode;
            let _dateStmt = symbolObj.reportDateNextFiscalQuarter.toString() + ", " + (symbolObj.reportTimeOfDayCode === 2 ? "before market open" : symbolObj.reportTimeOfDayCode === 3 ? "during market open" : symbolObj.reportTimeOfDayCode === 1 ? "after market close" : "unknown time of day" );

            return index === selectedSymbolIndex.get() ?
                <button key={_key} className={_btnClass}>{symbol} ({_numberOfLatestReports})</button> :
                index === this.previousSymbolIndex(selectedSymbolIndex.get()) ?
                    <button key={_key} className="btn btn-light" onClick={this.previousEarningsRelease}>
                        <span className="glyphicon glyphicon-chevron-left" aria-hidden="true"></span>Previous
                        <br/>{symbol} ({_numberOfLatestReports})
                    </button> :
                    index === this.nextSymbolIndex(selectedSymbolIndex.get()) ?
                        <button key={_key} className="btn btn-light" onClick={this.nextEarningsRelease}>
                            Next({nextAmt} more)<span className="glyphicon glyphicon-chevron-right" aria-hidden="true"></span>
                            <br/>{symbol} ({_numberOfLatestReports})
                        </button> :
                        this.state.showAllButtons ?
                            _firstDay ?
                                <span key={_key}>{_dateStmt}<br/><button key={_key} className={_btnClass} onClick={this.setNewSelectedSymbol.bind(this, symbol, index)}>{symbol} ({_numberOfLatestReports})</button></span> :
                                _newDay ?
                                    <span key={_key}><br/><br/><br/>{_dateStmt}<br/><button key={_key} className={_btnClass} onClick={this.setNewSelectedSymbol.bind(this, symbol, index)}>{symbol} ({_numberOfLatestReports})</button></span> :
                                    _newTimeOfDay ?
                                        <span key={_key}><br/>{_dateStmt}<br/><button key={_key} className={_btnClass} onClick={this.setNewSelectedSymbol.bind(this, symbol, index)}>{symbol} ({_numberOfLatestReports})</button></span> :
                                        <button key={_key} className={_btnClass} onClick={this.setNewSelectedSymbol.bind(this, symbol, index)}>{symbol} ({_numberOfLatestReports})</button> :
                            null;
        })
    }

    shouldComponentUpdate(nextProps, nextState) {
        return true;
    }

    componentDidMount() {
        window.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown(e) {
        let _symbolIndex = selectedSymbolIndex.get();
        let _new = e.which === 37 ? _symbolIndex - 1 : e.which === 39 ? _symbolIndex + 1 : _symbolIndex;
        if (_symbolIndex !== _new && this.props.uniqueSymbols && this.props.uniqueSymbols.length > 0) {
            if (e.which === 37) {
                this.previousEarningsRelease();
            } else if (e.which === 39) {
                this.nextEarningsRelease();
            }
        }
    }

    previousSymbolIndex(_previousState) {
        let _newState = _previousState - 1 >= 0 ? _previousState - 1 : this.props.uniqueSymbols.length - 1;
        return _newState;
    }
    nextSymbolIndex(_previousState) {
        let _newState = _previousState + 1 <= this.props.uniqueSymbols.length - 1 ? _previousState + 1 : 0;
        return _newState;
    }

    previousEarningsRelease() {
        let _newState = this.previousSymbolIndex(selectedSymbolIndex.get());
        selectedSymbolIndex.set(_newState);
    }
    nextEarningsRelease() {
        let _newState = this.nextSymbolIndex(selectedSymbolIndex);
        selectedSymbolIndex.set(_newState);
    }
    changeShowAllBtnsSetting() {
        this.setState({
            showAllButtons: !this.state.showAllButtons
        });
    }

    render() {
        let _symbol = this.props.uniqueSymbols ? this.props.uniqueSymbols[selectedSymbolIndex.get()] : "";

        return (
            <div className="container">
                {this.props.startDate}
                {this.props.endDate}
                <br/>
                {!this.props.ratingsChangesSubsStatuses[_symbol] ? "ratings changes loading for " + _symbol : <div className="row">
                    {this.props.currentUser ?
                        <button className="btn btn-light" onClick={this.changeShowAllBtnsSetting}>
                            {this.state.showAllButtons ? "hide individual buttons" : "show all individual buttons"}
                        </button> :
                        null
                    }
                    <br/>
                    {this.renderButtons()}
                    <br/>
                    <AverageAndWeightedRatings
                        symbol={_symbol}
                        showAvgRatings={true}
                        showWeightedRating={true}/>
                </div>}
            </div>
        );
    }
}

export default withTracker((props) => {

    let _earningReleases = EarningsReleases.find().fetch();
    let _earningsReleasesSorted = _.sortBy(_earningReleases, function (obj) {
        var _composite = obj.reportDateNextFiscalQuarter * 10 + (obj.reportTimeOfDayCode === 2 ? 1 : obj.reportTimeOfDayCode === 3 ? 2 : obj.reportTimeOfDayCode === 1 ? 3 : 4 );
        return _composite;
    });
    let _uniqueSymbols = _.uniq(_.pluck(_earningsReleasesSorted, "symbol"));
    //todo this should come from settings
    let _limit = 3;
    let _selectedIndex = selectedSymbolIndex.get();
    let _getRatingsChangesForTheseSymbols = _uniqueSymbols.slice(_selectedIndex - 1 < 0 ? 0 : _selectedIndex - 1, _selectedIndex - 1 + _limit);
    let _ratingsChangesSubsStatuses = {};

    let _currentUser = Meteor.user();
    let _settings = Settings.findOne();

    let _startDateForRatingChangesSubscription =
        _currentUser ?
            startDateRatingChanges.get() :
            moment(new Date().toISOString()).subtract(_settings.clientSettings.upcomingEarningsReleases.numberOfDaysBeforeTodayForRatingChangesPublicationIfNoUser, 'days').format("YYYY-MM-DD");
    let _endDateRatingChanges = endDateRatingChanges.get();

    _getRatingsChangesForTheseSymbols.forEach(function(symbol) {
        // var _handle = Meteor.subscribe("ratingChangesForSymbols", [symbol], _startDateForRatingChangesSubscription, _endDateRatingChanges);
        _ratingsChangesSubsStatuses[symbol] = true;
    });

    return {
        earningReleases: _earningsReleasesSorted
        , ratingChanges: RatingChanges.find().fetch()
        , currentUser: _currentUser
        , uniqueSymbols: _uniqueSymbols
        , ratingsChangesSubsStatuses: _ratingsChangesSubsStatuses
    };
})(UpcomingEarningsButtonsAndSelectedSymbol);