var _addThisManyDaysToReportDate = 90;
var _subtractThisManyDaysFromReportDate = 90;

function _getStartDate_MM_DD_YYYY(reportDateQuandlFormat) {
    return moment(new Date(_convertQuandlFormatNumberDateToDateStringWithSlashes(reportDateQuandlFormat)).toISOString()).subtract(_subtractThisManyDaysFromReportDate, 'days').format("MM-DD-YYYY");
};

function _getEndDate_MM_DD_YYYY(reportDateQuandlFormat) {
    var _tentativeEndDate = moment(new Date(_convertQuandlFormatNumberDateToDateStringWithSlashes(reportDateQuandlFormat)).toISOString()).add(_addThisManyDaysToReportDate, 'days').format("MM-DD-YYYY");
    var result;
    if (moment(new Date(_tentativeEndDate)).isAfter(moment(new Date()))) {
        result = moment(new Date().toISOString()).format("MM-DD-YYYY");
    } else {
        result = _tentativeEndDate;
    }
    return result;
};

function _convertQuandlFormatNumberDateToDateStringWithSlashes(_dateStringWithNoSlashesAsNumber) {
    _dateStringWithNoSlashesAsNumber = _dateStringWithNoSlashesAsNumber.toString();
    var _year = _dateStringWithNoSlashesAsNumber.substring(0,4);
    var _month = _dateStringWithNoSlashesAsNumber.substring(4,6);
    var _day = _dateStringWithNoSlashesAsNumber.substring(6,8);
    return _month + "/" + _day + "/" + _year;
};

function _getStartDate_YYYYMMDD(_dateQuandlFormat) {
    return moment(new Date(_convertQuandlFormatNumberDateToDateStringWithSlashes(_dateQuandlFormat)).toISOString()).subtract(_subtractThisManyDaysFromReportDate, 'days').format("YYYYMMDD");
};

function _getEndDate_YYYYMMDD(_dateQuandlFormat) {
    return moment(new Date(_convertQuandlFormatNumberDateToDateStringWithSlashes(_dateQuandlFormat)).toISOString()).add(_addThisManyDaysToReportDate, 'days').format("YYYYMMDD");
};

function _getStartDate_YYYY_MM_DD(_dateQuandlFormat) {
    return moment(new Date(_convertQuandlFormatNumberDateToDateStringWithSlashes(_dateQuandlFormat)).toISOString()).subtract(_subtractThisManyDaysFromReportDate, 'days').format("YYYY-MM-DD");
};

function _getEndDate_YYYY_MM_DD(_dateQuandlFormat) {
    var _format = "YYYY-MM-DD";
    var _tentativeEndDate = moment(new Date(_convertQuandlFormatNumberDateToDateStringWithSlashes(_dateQuandlFormat)).toISOString()).add(_subtractThisManyDaysFromReportDate, 'days').format(_format);
    var result;
    if (moment(new Date(_tentativeEndDate)).isAfter(moment(new Date()))) {
        result = moment(new Date().toISOString()).format(_format);
    } else {
        result = _tentativeEndDate;
    }
    return result;
};

EpsEstimateVsActualItem = React.createClass({

    mixins: [ReactMeteorData],

    propTypes: {
        estimateVsActual: React.PropTypes.object.isRequired,
        symbol: React.PropTypes.string.isRequired
    },

    getInitialState() {

        return {
            stocksToGraphObjects: [],
            epsHistStartDate: _getStartDate_YYYY_MM_DD(this.props.estimateVsActual.reportDate),
            epsHistEndDate: _getEndDate_YYYY_MM_DD(this.props.estimateVsActual.reportDate)
        }
    },

    getMeteorData() {
        let _symbol = this.props.symbol;

        var _startDate = parseInt(_getStartDate_YYYYMMDD(this.props.estimateVsActual.reportDate));
        var _endDate = parseInt(_getEndDate_YYYYMMDD(this.props.estimateVsActual.reportDate));
        var _allEarningsReleases = EarningsReleases.find(
            {
                symbol: _symbol,
                reportDateNextFiscalQuarter: {$exists: true},
                reportSourceFlag: 1,
                $and: [
                    {reportDateNextFiscalQuarter: {$gte: _startDate}},
                    {reportDateNextFiscalQuarter: {$lte: _endDate}}
                ]
            }
        ).fetch();

        return {
            ratingChanges: RatingChanges.find({symbol: _symbol}).fetch(),
            earningsReleases: _allEarningsReleases
            , ratingScales: StocksReact.functions.getRatingScalesHandleFromAvailableRatingChanges().ready() && RatingScales.find().fetch()
        }
    },

    getLatestGraph: function(symbol) {
        var _startDate = this.state.epsHistStartDate;
        var _endDate = this.state.epsHistEndDate;

        if (symbol && _startDate && _endDate) {
            var _that = this;
            var _averageAnalystRatingSeries = StocksReactUtils.ratingChanges.generateAverageAnalystRatingTimeSeries(symbol, _startDate, _endDate);
            Meteor.call('checkHistoricalData', symbol, _startDate, _endDate, function(err, result) {
                if (result && result.historicalData) {
                    _that.setState({
                        stocksToGraphObjects: [_.extend(result, {avgAnalystRatings: _averageAnalystRatingSeries, earningsReleases: _that.data.earningsReleases})]
                    });
                }
            });
        }
    },

    convertQuandlFormatNumberDateToDateStringWithSlashes: function(_dateStringWithNoSlashesAsNumber) {
        _dateStringWithNoSlashesAsNumber = _dateStringWithNoSlashesAsNumber.toString();
        var _year = _dateStringWithNoSlashesAsNumber.substring(0,4);
        var _month = _dateStringWithNoSlashesAsNumber.substring(4,6);
        var _day = _dateStringWithNoSlashesAsNumber.substring(6,8);
        return _month + "/" + _day + "/" + _year;
    },
    componentWillReceiveProps: function(nextProps) {
        this.getLatestGraph(nextProps.symbol);
    },
    componentDidMount: function() {
        if (this.props.symbol && this.props.estimateVsActual) {
            this.getLatestGraph(this.props.symbol);
        }
    },
    changingStart: function() {
        console.log("changing start.");
    },
    changingEnd: function() {
        console.log("changing end.");
    },
    setDateRangeOptions: function() {
        let _datepickerOptions = {
            autoclose: true,
            todayHighlight: true,
            orientation: "top auto"
        };
        $('.input-daterange').datepicker(_datepickerOptions);

        var _that = this;
        $('.form-control').on('change', function() {
            let _newVal = $(this).val();
            var _format = "YYYY-MM-DD";
            let _momentDate = moment(new Date(_newVal).toISOString()).format(_format);
            if (moment(_momentDate).isAfter(moment())) {
                _momentDate = moment(new Date().toISOString()).format(_format);
            }
            let _id = $(this).attr('id');
            let _set = {};
            _set[_id] = _momentDate;
            _that.setState(_set);
            _that.getLatestGraph(_that.props.symbol);
        });
    },

    render() {
        let _color = this.props.estimateVsActual.epsActual > this.props.estimateVsActual.epsEstimate ?
            "LimeGreen" :
            this.props.estimateVsActual.epsActual < this.props.estimateVsActual.epsEstimate ?
                "red" :
                "white";
        let _spanStyle = {
            backgroundColor: _color
        };
        let _startDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.epsHistStartDate);
        let _endDate = StocksReact.dates._convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.epsHistEndDate);

        return (<div className="container epsEstimateVsActualItem">
            Earnings release date: {this.convertQuandlFormatNumberDateToDateStringWithSlashes(this.props.estimateVsActual.reportDate)}<br/>
            Expected EPS: {this.props.estimateVsActual.epsEstimate}<br/>
            Actual EPS: <span style={_spanStyle}>{this.props.estimateVsActual.epsActual}</span><br/>
            Projections for next quarter EPS: <ul>{this.props.estimateVsActual.epsRevisions.map((epsRevision, index) => {
                return (<li key={index}>
                    <div>
                        revision date: {epsRevision.epsRevisionDate}
                        <br/>
                        new EPS expectation: {epsRevision.epsExpected}
                    </div>
                </li>)
            })}</ul>

            <div className="input-group input-daterange" ref={this.setDateRangeOptions}>
                <input type="text" className="form-control" id="epsHistStartDate" value={_startDate} onChange={this.changingStart}/>
                <span className="input-group-addon">to</span>
                <input type="text" className="form-control" id="epsHistEndDate" value={_endDate} onChange={this.changingEnd}/>
            </div>

            <div className="col-md-12 individualStockGraph">
                <StocksGraph
                    stocksToGraphObjects={this.state.stocksToGraphObjects}/>
            </div>
        </div>);
    }
});