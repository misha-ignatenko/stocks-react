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

function _convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(yyyy_mm_dd){
    var _years = yyyy_mm_dd.substring(0,4);
    var _months = yyyy_mm_dd.substring(5,7);
    var _days = yyyy_mm_dd.substring(8,10);
    return _months + "/" + _days + "/" + _years;
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
        }
    },

    getLatestGraph: function(symbol) {
        var _startDate = this.state.epsHistStartDate;
        var _endDate = this.state.epsHistEndDate;

        if (symbol && _startDate && _endDate) {
            var _that = this;
            var _averageAnalystRatingSeries = this.generateAverageAnalystRatingTimeSeries(symbol, _startDate, _endDate);
            Meteor.call('checkHistoricalData', symbol, _startDate, _endDate, function(err, result) {
                if (result && result.historicalData) {
                    _that.setState({
                        stocksToGraphObjects: [_.extend(result, {avgAnalystRatings: _averageAnalystRatingSeries, earningsReleases: _that.data.earningsReleases})]
                    });
                }
            });
        }
    },

    generateAverageAnalystRatingTimeSeries: function(symbol, startDate, endDate) {
        var _allRatingChangesForStock = RatingChanges.find({symbol: symbol}, {sort: {date: 1}}).fetch();
        //filter those where date attribute is between startDate and endDate

        var _ratingChangesOfInterest = [];
        _allRatingChangesForStock.forEach(function(ratingChange) {
            var _extractedDateStringNoTimezone = moment(new Date(ratingChange.date)).format("YYYY-MM-DD");
            if ((moment(_extractedDateStringNoTimezone).isSame(startDate) || moment(_extractedDateStringNoTimezone).isAfter(startDate)) &&
                (moment(_extractedDateStringNoTimezone).isSame(endDate) || moment(_extractedDateStringNoTimezone).isBefore(endDate))
            ) {
                _ratingChangesOfInterest.push(ratingChange);
            }
        });

        //_ratingChangesOfInterest is already sorted with dates in increasing order

        //determine the number of unique research firms
        var _uniqueFirms = _.uniq(_.pluck(_ratingChangesOfInterest, "researchFirmId"));




        var _result = [];

        var _zeroSeries = [];
        _uniqueFirms.forEach(function(uniqueFirmId) {
            var i = 0;
            while (i < _ratingChangesOfInterest.length) {
                if (_ratingChangesOfInterest[i].researchFirmId === uniqueFirmId) {
                    _zeroSeries.push(_ratingChangesOfInterest[i].oldRatingId);
                    break;
                }
                i++;
            }
        });

        _result.push({
            date: new Date(startDate).toUTCString(),
            ratingScalesIds: _zeroSeries
        });

        //for each rating change get the firm and find the nearest before rating of other firms
        _ratingChangesOfInterest.forEach(function(ratingChange, index) {
            var _curFirmId = ratingChange.researchFirmId;
            var _arrayOfConnectedRatingChanges = [ratingChange.newRatingId];
            _uniqueFirms.forEach(function(researchFirmId) {
                //only interested at looking at research firms that are NOT equal to _curFirmId
                if (researchFirmId !== _curFirmId) {
                    var _i = index + 1;
                    var _found;
                    while (_i < _ratingChangesOfInterest.length) {
                        if (_ratingChangesOfInterest[_i].researchFirmId === researchFirmId) {
                            _found = _ratingChangesOfInterest[_i];
                            _arrayOfConnectedRatingChanges.push(_found.oldRatingId);
                            break;
                        }
                        _i++;
                    }
                    if (!_found) {
                        //try to go backward
                        _i = index - 1;
                        while (_i >= 0) {
                            if (_ratingChangesOfInterest[_i].researchFirmId === researchFirmId) {
                                _found =_ratingChangesOfInterest[_i];
                                _arrayOfConnectedRatingChanges.push(_found.newRatingId);
                                break;
                            }
                            _i--;
                        }
                    }

                    if (!_found) {
                        console.log("ERROR!!");
                    } else {

                    }
                }
            })
            _result.push({
                date: ratingChange.date,
                ratingScalesIds: _arrayOfConnectedRatingChanges
            });
        })

        //same as the very last one except date will be set below to either today or endDate
        var _finalSeries = _result[_result.length - 1].ratingScalesIds;

        //figure out date for finalSeries
        var _dateForFinalSeries;
        var _today = moment(new Date()).format("YYYY-MM-DD");
        if (moment(_today).isBefore(endDate)) {
            _dateForFinalSeries = new Date().toUTCString()
        } else {
            _dateForFinalSeries = new Date(endDate).toUTCString()
        }



        _result.push({
            date: _dateForFinalSeries,
            ratingScalesIds: _finalSeries
        });

        var _final = [];
        _result.forEach(function(res) {
            var _sum = 0;
            res.ratingScalesIds.forEach(function(ratingScaleId) {
                _sum += RatingScales.findOne({_id: ratingScaleId}).universalScaleValue;
            });
            //TODO omit ratingScalesIds -- extra info
            _final.push(_.extend(res, {avg: Math.round(_sum / res.ratingScalesIds.length)}))
        })

        return _final;
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
        let _startDate = _convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.epsHistStartDate);
        let _endDate = _convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY(this.state.epsHistEndDate);

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