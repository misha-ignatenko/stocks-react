import { Component } from 'react';

let _allowQuandlPullEveryNdaysFromPreviousForThatStock = 3;

class PreviousEarningsRelease extends Component {

    getInitialState() {
        let _format = "YYYY-MM-DD";

        return {
            individualStockStartDate: null,
            individualStockEndDate: null,
            stocksToGraphObjects: [],
            allRatingChangesForStock: [],
            stocksToGraphObjs: [],
            avgRatingStartDate: moment((new Date()).toISOString()).subtract(90, "days").format(_format),
            avgRatingEndDate: moment((new Date()).toISOString()).format(_format)

        }
    }

    getMeteorData() {
        let _symbol = this.props.symbol;
        let _allEarningsReleasesForSymbol = EarningsReleases.find({symbol: _symbol, reportDateNextFiscalQuarter: {$exists: true}}).fetch();
        let _todaysDate = parseInt(moment(new Date().toISOString()).format("YYYYMMDD"));
        let _maxLastModifiedDateNum = parseInt(moment(new Date().toISOString()).subtract(1000, 'days').format("YYYYMMDD"));
        let _maxLastModifiedDateString = moment(new Date().toISOString()).subtract(1000, 'days');
        _allEarningsReleasesForSymbol.forEach(function(release) {
            var _dateOnly = (new Date(release.lastModified)).toISOString().substring(0,10);
            var _dateNum = parseInt(moment(_dateOnly).format("YYYYMMDD"));

            if (_dateNum > _maxLastModifiedDateNum) {
                _maxLastModifiedDateNum = _dateNum;
                _maxLastModifiedDateString = new Date(_dateOnly).toISOString();
            }
        });
        let _nextUpdateAllowedOn_NUM = parseInt(moment(new Date(_maxLastModifiedDateString)).add(_allowQuandlPullEveryNdaysFromPreviousForThatStock + 1, 'days').format("YYYYMMDD"));
        if (_symbol !== "undefinedd") {
            //console.log("next update for " + _symbol + " is on: ", _nextUpdateAllowedOn_NUM);
        }
        //this logic locks in the next update date until whatever the latest version of Quandl says.
        //if there is a glitch and the next release date is too far ahead in the future, then won't be able to pull until that date.
        if (_nextUpdateAllowedOn_NUM <= _todaysDate && _symbol !== "undefinedd") {
            this.checkForNewestDataFromQuandl(_symbol);
        }
        var _allPairs = this.getExpectedVsActualEarningsReportsPairsArray(_allEarningsReleasesForSymbol);

        return {
            individualEarningReleases: _allEarningsReleasesForSymbol,
            expectedVsActualEpsPairs: _allPairs,
            ratingChanges: RatingChanges.find({symbol: _symbol}, {sort: {date: 1}}).fetch(),
            ratingScales: RatingScales.find().fetch()
        }
    }
    getExpectedVsActualEarningsReportsPairsArray(arrayOfEaringsReportsForSymbol) {
        var _indexPairs = [];
        for (var i = 0; i < arrayOfEaringsReportsForSymbol.length; i++) {
            for (var j = 0; j < arrayOfEaringsReportsForSymbol.length; j++) {
                if (i !== j &&
                    (arrayOfEaringsReportsForSymbol[i].endDateNextFiscalQuarter === arrayOfEaringsReportsForSymbol[j].endDatePreviousFiscalQuarter ||
                    arrayOfEaringsReportsForSymbol[j].endDateNextFiscalQuarter === arrayOfEaringsReportsForSymbol[i].endDatePreviousFiscalQuarter)
                ) {
                    var _first = i > j ? j : i;
                    var _second = _first === i ? j : i;
                    var _pair = {
                        first: _first,
                        second: _second
                    };
                    //do not push if already exists
                    if (!_.findWhere(_indexPairs, _pair)) {
                        _indexPairs.push(_pair);
                    }
                }
            }
        }
        var _objectPairs = [];
        _indexPairs.forEach(function(pair) {
            var _obj1 = arrayOfEaringsReportsForSymbol[pair.first];
            var _obj2 = arrayOfEaringsReportsForSymbol[pair.second];
            var _estimate;
            var _actual;
            if (_obj1.endDateNextFiscalQuarter === _obj2.endDatePreviousFiscalQuarter) {
                _estimate = _obj1;
                _actual = _obj2;
            } else if (_obj2.endDateNextFiscalQuarter === _obj1.endDatePreviousFiscalQuarter) {
                _estimate = _obj2;
                _actual = _obj1;
            }
            _objectPairs.push({
                fiscalQuarterEndDate: _estimate.endDateNextFiscalQuarter,
                epsEstimate: _estimate.epsMeanEstimateNextFiscalQuarter,
                epsActual: _actual.epsActualPreviousFiscalQuarter,
                reportDate: _estimate.reportDateNextFiscalQuarter,
                reportSourceFlag: _estimate.reportSourceFlag,
                reportTimeOfDayCode: _estimate.reportTimeOfDayCode
            });
        });
        var _uniq = _.uniq(_objectPairs, function(pair) {return pair.fiscalQuarterEndDate;});

        _uniq.forEach(function(uniqPair, index) {
            //swap those from _objectPairs if there is a report source flag of 1 rather than 2 or 3
            _objectPairs.forEach(function(nonUniqPair, index2) {
                if (uniqPair.fiscalQuarterEndDate === nonUniqPair.fiscalQuarterEndDate && uniqPair.reportSourceFlag > nonUniqPair.reportSourceFlag ) {
                    //if reportSourceFlag is higher for uniq pair that for non uniq, then get reportSourceFlag, reportTimeOfDayCode, reportDate, epsEstimate
                    //and save them into the uniq one
                    //because nonuniq is the one where report source flag is less which means more certainty
                    _uniq[index].epsEstimate = nonUniqPair.epsEstimate;
                    _uniq[index].reportDate = nonUniqPair.reportDate;
                    _uniq[index].reportSourceFlag = nonUniqPair.reportSourceFlag;
                    _uniq[index].reportTimeOfDayCode = nonUniqPair.reportTimeOfDayCode;
                }
            });
        });

        _uniq.forEach(function(uniquePair, index) {
            var _allEpsEstimatesForUpcomingQuarter = [];
            //find all revisions for next quarter estimates
            arrayOfEaringsReportsForSymbol.forEach(function(earning) {
                if (earning.endDatePreviousFiscalQuarter === uniquePair.fiscalQuarterEndDate) {
                    _allEpsEstimatesForUpcomingQuarter.push({
                        epsRevisionDate: earning.asOf,
                        epsExpected: earning.epsMeanEstimateNextFiscalQuarter
                    });
                }
            });
            _uniq[index].epsRevisions = _allEpsEstimatesForUpcomingQuarter;
        });
        return _uniq;
    }
    shouldComponentUpdate(nextProps, nextState) {
        //update component only when there is new data available to be graphed, not necessarily when there is a new symbol prop
        //because it takes a few seconds after new symbol prop is set to get new data to graph
        if (JSON.stringify(this.state.stocksToGraphObjs) !== JSON.stringify(nextState.stocksToGraphObjs)) {
            return true;
        }

        return false;
    }

    checkForNewestDataFromQuandl(symbol) {
        console.log("this is done elsewhere, ", symbol);
        //Meteor.call('importData', [symbol], 'earnings_releases');
    }

    renderEpsMeanEstimates() {
        return this.data.individualEarningReleases.map((release, index) => {
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
    componentWillReceiveProps(nextProps) {
        if (this.props.symbol !== nextProps.symbol) {
            console.log("should not be here");
            this.getLatestGraph2(nextProps.symbol);
            //var _handle = Meteor.subscribe("ratingChangesForSymbol", nextProps.symbol);
            //var _that = this;
            //Tracker.autorun(function(handle){
            //    if (_handle.ready()) {
            //        _that.getLatestGraph2(nextProps.symbol);
            //        if (handle) {
            //            handle.stop();
            //        }
            //    }
            //})
        }
    }
    componentWillMount() {
        //call getLatestGraph2 to show ratings graph for initially selected symbol
        this.getLatestGraph2(this.props.symbol);
    }
    renderAllExistingUpDowngradesForStock() {
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
    }
    renderEstimatedVsActualEps() {
        return this.data.expectedVsActualEpsPairs.map((estimateVsActual, index) => {
            return(<div key={index}>
                <EpsEstimateVsActualItem
                    estimateVsActual={estimateVsActual}
                    symbol={this.props.symbol}/>
            </div>);
        });
    }
    changingStart() {}
    changingEnd() {}

    renderAvgAnalystRatingsGraph() {
        let _startDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.avgRatingStartDate);
        let _endDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.avgRatingEndDate);
        return (this.data.ratingChanges.length > 0 ? <div>
            <div className="input-group input-daterange" ref={this.setDateRangeOptions}>
                <input type="text" className="form-control" id="avgRatingStartDate" value={_startDate} onChange={this.changingStart}/>
                <span className="input-group-addon">to</span>
                <input type="text" className="form-control" id="avgRatingEndDate" value={_endDate} onChange={this.changingEnd}/>
            </div>

            <div className="col-md-12 individualStockGraph">
                <StocksGraph
                    stocksToGraphObjects={this.state.stocksToGraphObjs}/>
            </div>
        </div> : null);
    }

    setDateRangeOptions() {
        StocksReact.ui.setDateRangeOptions("input-daterange");

        var _that = this;
        $('.form-control').on('change', function(event) {
            var _set = StocksReact.ui.getStateForDateRangeChangeEvent(event);
            _that.setState(_set);
            _that.getLatestGraph2(_that.props.symbol);
        });
    }
    getLatestGraph2(symbol) {
        if (symbol && this.state.avgRatingStartDate && this.state.avgRatingEndDate) {
            var _startDate = this.state.avgRatingStartDate;
            var _endDate = this.state.avgRatingEndDate;
            var _averageAnalystRatingSeries = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeries(symbol, _startDate, _endDate);
            //TODO: start date and end date for regression are coming from a different date picker
            var _startDateForRegression = _startDate;
            var _endDateForRegression = _endDate;
            var _that = this;
            Meteor.call('checkHistoricalData', symbol, _startDate, _endDate, function(err, result) {
                if (result && result.historicalData) {
                    var _avgRatingsSeriesEveryDay = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeriesEveryDay(_averageAnalystRatingSeries, result.historicalData);
                    var _priceReactionDelayInDays = 5;
                    var _weightedRatingsSeriesEveryDay = StocksReactUtils.ratingChanges.generateWeightedAnalystRatingsTimeSeriesEveryDay(_avgRatingsSeriesEveryDay, _startDateForRegression, _endDateForRegression, result.historicalData, _priceReactionDelayInDays, "adjClose", 0.5, 1.0, Math.pow(10, -7), 30);
                    _that.setState({
                        stocksToGraphObjs: [_.extend(result, {
                            //avgAnalystRatings: _averageAnalystRatingSeries,
                            avgAnalystRatingsEveryDay: _avgRatingsSeriesEveryDay,
                            weightedAnalystRatingsEveryDay: _weightedRatingsSeriesEveryDay
                        })]
                    });
                }
            });
        }
    }

    render() {
        return (<div>
            {this.renderEstimatedVsActualEps()}
            <br/>
            {this.renderAllExistingUpDowngradesForStock()}
            {this.data.expectedVsActualEpsPairs.length === 0 ? this.renderAvgAnalystRatingsGraph() : null}
            <br/><br/><br/><br/><br/><br/><br/><br/>
            <br/><br/><br/><br/><br/><br/><br/><br/>
            <br/><br/><br/><br/><br/><br/><br/><br/>
            <br/><br/><br/><br/><br/><br/><br/><br/>
            <br/><br/><br/><br/><br/><br/><br/><br/>
            {this.renderEpsMeanEstimates()}
            <br/>

        </div>);
    }
}