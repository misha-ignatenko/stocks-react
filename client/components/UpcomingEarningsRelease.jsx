let _allowQuandlPullEveryNdaysFromPreviousForThatStock = 3;

UpcomingEarningsRelease = React.createClass({

    mixins: [ReactMeteorData],

    propTypes: {
        symbol: React.PropTypes.string.isRequired,
        currentUser: React.PropTypes.object.isRequired
    },

    getInitialState() {

        return {
            individualStockStartDate: null,
            individualStockEndDate: null,
            stocksToGraphObjects: [],
            allRatingChangesForStock: []
        }
    },

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
    },
    getExpectedVsActualEarningsReportsPairsArray: function(arrayOfEaringsReportsForSymbol) {
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
                reportDate: _estimate.reportDateNextFiscalQuarter
            });
        });
        var _uniq = _.uniq(_objectPairs, function(pair) {return pair.fiscalQuarterEndDate;});
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
    },
    shouldComponentUpdate: function(nextProps, nextState) {
        if (this.props.symbol !== nextProps.symbol) {
            //console.log("props updated. new symbol: ", nextProps.symbol);
        }
        if (this.props.currentUser.lastModified !== nextProps.currentUser.lastModified) {
            console.log("resubscribe to rating changes because last modified changed because premium status changed");
            var _that = this;
            Meteor.call("getRatingChangesFor", nextProps.symbol, function (error, result) {
                if (!error && result) {
                    _that.setState({
                        allRatingChangesForStock: result
                    })
                }
            });
        }

        if (this.props.symbol !== nextProps.symbol) {
            Meteor.subscribe("ratingChangesForSymbol", nextProps.symbol);
        }

        return true;
    },

    checkForNewestDataFromQuandl: function (symbol) {
        Meteor.call('importData', [symbol], 'earnings_releases');
    },

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
    },
    setDatepickerOptions: function() {
        let _datepickerOptions = {
            autoclose: true,
            todayHighlight: true,
            orientation: "top auto"
        };
        $('#individualStockStartDate').datepicker(_datepickerOptions);
        $('#individualStockEndDate').datepicker(_datepickerOptions);
        var _that = this;

        $('.datepickerInput').on('change', function() {
            let _newVal = $(this).val();
            let _momentDate = moment(new Date(_newVal).toISOString()).format("YYYY-MM-DD");
            let _id = $(this).attr('id');
            let _set = {};
            _set[_id] = _momentDate;
            _that.setState(_set);
            _that.getLatestGraph(_that.props.symbol);
        });
    },
    getLatestGraph: function(symbol) {
        //make sure that end date is after start date
        //or disable dates based on previously selected dates
        if (symbol && this.state.individualStockStartDate && this.state.individualStockEndDate) {
            console.log('getting the latest graph.');
            var _that = this;
            Meteor.call('checkHistoricalData', symbol, this.state.individualStockStartDate, this.state.individualStockEndDate, function(err, result) {
                if (result && result.historicalData) {
                    _that.setState({
                        stocksToGraphObjects: [result]
                    });
                }
            });
        }
    },
    componentWillReceiveProps: function(nextProps) {
        this.getLatestGraph(nextProps.symbol);
    },
    renderAllExistingUpDowngradesForStock: function() {
        var _that = this;
        return this.data.ratingChanges.map((ratingChange, index) => {
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
        });
    },
    renderEstimatedVsActualEps: function() {
        return this.data.expectedVsActualEpsPairs.map((estimateVsActual, index) => {
            return(<div key={index}>
                <EpsEstimateVsActualItem
                    estimateVsActual={estimateVsActual}
                    symbol={this.props.symbol}/>
            </div>);
        });
    },

    render() {
        return (<div>
            {this.renderEstimatedVsActualEps()}
            <br/>
            <br/>
            <h1>all existing up/downgrades:</h1>
            <ul>
                {this.renderAllExistingUpDowngradesForStock()}
            </ul>
            <br/>
            {this.renderEpsMeanEstimates()}
            <br/>

            <div className="datepickers" ref={this.setDatepickerOptions}>
                start date:
                <input className="datepickerInput" id="individualStockStartDate"/>
                end date:
                <input className="datepickerInput" id="individualStockEndDate" />
            </div>
            <div className="col-md-12 individualStockGraph">
                <StocksGraph
                    stocksToGraphObjects={this.state.stocksToGraphObjects}/>
            </div>
        </div>);
    }
});