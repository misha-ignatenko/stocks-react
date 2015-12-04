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
        //if the max of all future approx dates of earnings release is less or equal than today then pull new data
        let _maxDate = parseInt(moment(new Date().toISOString()).subtract(365, 'days').format("YYYYMMDD"));
        let _todaysDate = parseInt(moment(new Date().toISOString()).format("YYYYMMDD"));
        _allEarningsReleasesForSymbol.forEach(function(release) {
            var _fieldName = "EXP_RPT_DATE_QR1";
            if (_.indexOf(release.fieldNames, _fieldName) > -1 &&
                release.earningsData[_.indexOf(release.fieldNames, _fieldName)] > _maxDate
            ) {
                _maxDate = release.earningsData[_.indexOf(release.fieldNames, _fieldName)];
            }
        });
        //this logic locks in the next update date until whatever the latest version of Quandl says.
        //if there is a glitch and the next release date is too far ahead in the future, then won't be able to pull until that date.
        if (_maxDate <= _todaysDate && _symbol !== "undefinedd") {
            this.checkForNewestDataFromQuandl(_symbol);
        }

        return {
            individualEarningReleases: _allEarningsReleasesForSymbol
        }
    },
    shouldComponentUpdate: function(nextProps, nextState) {
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