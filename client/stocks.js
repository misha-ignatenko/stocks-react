if (Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: "USERNAME_ONLY"
    });

    Meteor.subscribe("earningsReleases");
    Meteor.subscribe("researchCompanies");
    Meteor.subscribe("pickLists");
    Meteor.subscribe("ratingScales");
    Meteor.subscribe("pickListItems");

    //Meteor.startup(function () {
    //    React.render(<App />, document.getElementById("render-target"));
    //});

    StocksReact = {};
    StocksReact.dates = {
        _convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY: function(yyyy_mm_dd) {
            var _years = yyyy_mm_dd.substring(0,4);
            var _months = yyyy_mm_dd.substring(5,7);
            var _days = yyyy_mm_dd.substring(8,10);
            return _months + "/" + _days + "/" + _years;
        }
    };
    StocksReact.functions = {
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
                var _divisor = res.ratingScalesIds.length;
                res.ratingScalesIds.forEach(function(ratingScaleId) {
                    if (RatingScales.findOne({_id: ratingScaleId}).universalScaleValue === "beforeCoverageInitiatedString" || RatingScales.findOne({_id: ratingScaleId}).universalScaleValue === "coverageDroppedString") {
                        _divisor -= 1;
                    } else {
                        _sum += RatingScales.findOne({_id: ratingScaleId}).universalScaleValue;
                    }
                });
                //TODO omit ratingScalesIds -- extra info
                _final.push(_.extend(res, {avg: Math.round(_sum / _divisor)}))
            })

            return _final;
        }
    };

    StocksReact.ui = {
        setDateRangeOptions: function(dateRangeClassName) {
            var _daterangeOptions = {
                autoclose: true,
                todayHighlight: true,
                orientation: "top auto"
            };
            $("." + dateRangeClassName).datepicker(_daterangeOptions);
        },
        getStateForDateRangeChangeEvent: function(event) {
            var _newVal = $(event.target).val();
            var _format = "YYYY-MM-DD";
            var _momentDate = moment(new Date(_newVal).toISOString()).format(_format);
            if (moment(_momentDate).isAfter(moment())) {
                _momentDate = moment(new Date().toISOString()).format(_format);
            }
            var _id = $(event.target).attr('id');
            var _set = {};
            _set[_id] = _momentDate;

            return _set;
        }
    };
}
