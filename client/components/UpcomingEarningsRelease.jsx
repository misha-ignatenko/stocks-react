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
        let _allEarningsReleasesForSymbol = EarningsReleases.find({symbol: _symbol}).fetch();
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

        return {
            individualEarningReleases: _allEarningsReleasesForSymbol
        }
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
        return true;
    },

    checkForNewestDataFromQuandl: function (symbol) {
        Meteor.call('importData', [{symbol: symbol}], 'earnings_releases');
    },

    renderEpsMeanEstimates() {
        return this.data.individualEarningReleases.map((release, index) => {
            let _fieldNamesArray = release.fieldNames;
            let _earningsData = release.earningsData;
            let _indexForEpsEstimate;
            for (var i = 0; i < _fieldNamesArray.length; i++) {
                if (_fieldNamesArray[i] === "EPS_MEAN_EST_QR1" ||
                    _fieldNamesArray[i] === "EPS_MEAN_EST_QR2" ||
                    _fieldNamesArray[i] === "EPS_MEAN_EST_QR3" ||
                    _fieldNamesArray[i] === "EPS_MEAN_EST_QR4"
                ) {
                    _indexForEpsEstimate = i;
                    break;
                }
            }
            let _sourceFlag = _earningsData[_indexForEpsEstimate + 5];
            let _timeOfDayCodeForEarningsRelease = _earningsData[_indexForEpsEstimate + 6];
            let _key = release.symbol + "_" + index;
            return (
                <div key={_key}>
                    <h1>This quarter</h1>
                    <h1>Next earning release date: {_earningsData[_indexForEpsEstimate + 1]} ({_sourceFlag === 1 ? "Company confirmed" : _sourceFlag === 2 ? "Estimated based on algorithm" : _sourceFlag === 3 ? "Unknown" : null},&nbsp;
                        {_timeOfDayCodeForEarningsRelease === 1 ? "After market close" : _timeOfDayCodeForEarningsRelease === 2 ? "Before the open" : _timeOfDayCodeForEarningsRelease === 3 ? "During market trading" : _timeOfDayCodeForEarningsRelease === 4 ? "Unknown" : null})</h1>
                    <h1>Expected EPS: {_earningsData[_indexForEpsEstimate]}</h1>
                    <br/>
                    <h3>Previous quarter EPS: {_earningsData[_indexForEpsEstimate + 7]}</h3>
                    <h3>EPS a year ago: {_earningsData[_indexForEpsEstimate + 9]}</h3>
                    <br/>
                    <h5>Next quarter</h5>
                    <h5>Report date: {_earningsData[_indexForEpsEstimate + 2]}</h5>
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
        return this.state.allRatingChangesForStock.map((ratingChange, index) => {
            return(<li key={index}>
                <div>
                    Old rating: {ratingChange.oldRatingValue ? ratingChange.oldRatingValue : "unknown"}<br/>
                    New rating: {ratingChange.newRatingValue ? ratingChange.newRatingValue : "unknown"}<br/>
                    As of: {ratingChange.date}<br/>
                    Firm name: {ratingChange.researchFirmString ? ratingChange.researchFirmString : "no premium access"}
                </div>
            </li>);
        });
    },

    render() {
        return (<div>

            <div className="datepickers" ref={this.setDatepickerOptions}>
                start date:
                <input className="datepickerInput" id="individualStockStartDate"/>
                end date:
                <input className="datepickerInput" id="individualStockEndDate" />
            </div>

            <br/>
            {this.renderEpsMeanEstimates()}
            <div className="col-md-12 individualStockGraph">
                <StocksGraph
                    stocksToGraphObjects={this.state.stocksToGraphObjects}/>
            </div>
            <br/>
            rendering all existing up/downgrades:
            <ul>
                {this.renderAllExistingUpDowngradesForStock()}
            </ul>
        </div>);
    }
});