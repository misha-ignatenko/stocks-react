if (Meteor.isServer) {
    var _totalMaxGradingValue = 120;

    Meteor.methods({
        importData: function(importData, importType) {
            //run all the checks here

            if (! Meteor.userId()) {
                throw new Meteor.Error("not-authorized");
            }

            var _result = {};

            if (importType === "upgrades_downgrades") {
                _result.couldNotFindGradingScalesForTheseUpDowngrades = [];
                importData.forEach(function(importItem) {

                    //first, check if that research company exists
                    var _researchCompany = ResearchCompanies.findOne({name: importItem.researchFirmString});
                    var _researchCompanyId;
                    if (_researchCompany) {
                        _researchCompanyId = _researchCompany._id;
                    } else {
                        _researchCompanyId = ResearchCompanies.insert({name: importItem.researchFirmString});
                    }

                    //second, get rating scales id so that can check if item already exists in RatingChanges
                    var _ratingScaleObjectForNew = RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: importItem.newRatingString});
                    var _ratingScaleObjectForOld = RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: importItem.oldRatingString});
                    if (_ratingScaleObjectForNew && _ratingScaleObjectForOld) {
                        //can try to check if this RatingChanges item already exists. if not then insert it.
                        var _existingRatingChange = RatingChanges.findOne({
                            researchFirmId: _researchCompanyId,
                            symbol: importItem.symbol,
                            newRatingId: _ratingScaleObjectForNew._id,
                            oldRatingId: _ratingScaleObjectForOld._id
                        });
                        if (!_existingRatingChange) {
                            // can insert
                            var _ratingChange = {
                                date: new Date(importItem.dateString).toUTCString(),
                                researchFirmId: _researchCompanyId,
                                symbol: importItem.symbol,
                                newRatingId: _ratingScaleObjectForNew._id,
                                oldRatingId: _ratingScaleObjectForOld._id,
                                private: true,
                                addedBy: Meteor.userId(),
                                addedOn: new Date().toUTCString()
                            };
                            console.log("adding this stock: ", importItem.symbol);
                            RatingChanges.insert(_ratingChange);
                        }
                    } else {
                        //add to error object to let user know these rating scales need to be added
                        //Note: both old and new have to exist.
                        _result.couldNotFindGradingScalesForTheseUpDowngrades.push({
                            researchFirmString: importItem.researchFirmString,
                            ratingString: importItem.newRatingString
                        });

                        _result.couldNotFindGradingScalesForTheseUpDowngrades.push({
                            researchFirmString: importItem.researchFirmString,
                            ratingString: importItem.oldRatingString
                        });
                    }
                });
            } else if (importType === "earnings_releases") {
                importData.forEach(function(importItem) {
                    //TODO check if this earnings release already exists -- check for plus minus 5 days around it
                    var _earningRelease = {
                        symbol: importItem
                    };


                    var _authToken = "";
                    var _symbol = _earningRelease.symbol;
                    var _url = "https://www.quandl.com/api/v3/datasets/ZEA/" + _symbol + ".json?auth_token=" + _authToken;
                    HTTP.get(_url, function(error, result) {
                        if (!error && result) {
                            //TODO check if earnings release data for that stock exists.
                            //TODO should only have 1 record per symbol and expand it WITH NEW STUFF ONLY over time.
                            var _resultColumnNames = result.data.dataset.column_names;
                            var _newEarningsData = result.data.dataset.data[0];
                            var _objectFromQuandlMyDbFormat = {};
                            var _i = 0;
                            _resultColumnNames.forEach(function(fieldName, index) {
                                var _convertedFieldName = _convertQuandlZEAfieldName(fieldName);
                                if (_convertedFieldName) {
                                    _objectFromQuandlMyDbFormat[_convertedFieldName] = _newEarningsData[index];
                                    _i++;
                                }
                            });
                            if (_i === 14) {
                                console.log("object from quandl: ", _objectFromQuandlMyDbFormat);
                                //now check if any of the existing earnings releases match this one we are trying to import

                                if (!_matchingEntryExistsInEarningsReleases(_symbol, _objectFromQuandlMyDbFormat) && result.statusCode === 200) {
                                    _.extend(_earningRelease, _objectFromQuandlMyDbFormat);
                                    _.extend(_earningRelease, {
                                        lastModified: new Date().toUTCString(),
                                        lastModifiedBy: Meteor.userId()
                                    });
                                    console.log("inserting into earningsReleases: ", _earningRelease);
                                    EarningsReleases.insert(_earningRelease);
                                }
                            } else {
                                console.log("ERROR. _i is less than 14.");
                            }
                        } else {
                            console.log("error while getting a response from Quandl. Symbol: ", _symbol);
                        }
                    });
                });
            } else if (importType === "grading_scales") {
                var _allRatings = importData.thresholdStringsArray;
                var _researchFirmString = importData.researchFirmString;
                //get an id of that research company
                var _researchCompany = ResearchCompanies.findOne({name: _researchFirmString});
                var _researchCompanyId;
                if (_researchCompany) {
                    _researchCompanyId = _researchCompany._id;
                } else {
                    _researchCompanyId = ResearchCompanies.insert({name: _researchFirmString});
                }

                var _noneOfGradingScalesForThisFirmAlreadyExist = true;
                _allRatings.forEach(function(ratingString) {
                    if (RatingScales.findOne({researchFirmId: _researchCompanyId, firmRatingFullString: ratingString})) {
                        _noneOfGradingScalesForThisFirmAlreadyExist = false;
                    }
                });

                if (_noneOfGradingScalesForThisFirmAlreadyExist) {
                    //now eval approx how many points each and insert into collection.
                    var _valuePerThreshold = Math.round(_totalMaxGradingValue / _allRatings.length)
                    _allRatings.forEach(function(value, index) {
                        RatingScales.insert({
                            researchFirmId: _researchCompanyId,
                            firmRatingFullString: value,
                            universalScaleValue: index * _valuePerThreshold + Math.round(_valuePerThreshold / 2)
                        });
                    })
                }
            }

            return _result;
        }
    });

    function _convertQuandlZEAfieldName(zeaFieldName) {
        /*PER_END_DATE_FR0 : The end date of the most recently reported fiscal year. (YYYYMMDD)
         endDateMostRecentFiscalYear

         PER_END_DATE_QR1 : The end date of the next fiscal quarter to be reported. (YYYYMMDD)
         endDateNextFiscalQuarter

         EPS_MEAN_EST_QR1 : The Zacks consensus estimated earnings per share (EPS) for the next fiscal quarter to be reported, calculated as the arithmetic mean of all individual sell-side EPS estimates, using the Zacks proprietary BNRI accounting methodology.
         epsMeanEstimateNextFiscalQuarter

         EXP_RPT_DATE_QR1 : The expected report date for the next fiscal quarter's earnings. (QR1) (YYYYMMDD)
         reportDateNextFiscalQuarter

         EXP_RPT_DATE_QR2 : The expected report date for the fiscal quarter after the next fiscal quarter. (QR2) (YYYYMMDD)
         reportDateNextNextFiscalQuarter

         EXP_RPT_DATE_FR1 : The expected report date for the next fiscal year's earnings. (FR1) (YYYYMMDD)
         reportDateNextFiscalYear

         LATE_LAST_FLAG : Indicates whether the report is late and by how long. Values in this field will be one of the following: 0 (not late), 1 (more that 3 days late), 2 (more than 20 days late) or 3 (Unknown).
         lateMostRecentReportFlag

         SOURCE_FLAG : Indicates whether the expected report date comes from a company issued confirmation or from a Zacks mathematical algorithm. Values in this field will be one of the following: 1 (Company confirmed), 2 (Estimated based on algorithm) or 3 (Unknown). This field only applies to the next expected quarterly report date. Expected report dates for fiscal periods further out are considered "Estimated" until company confirmations are received for those dates.
         reportSourceFlag

         TIME_OF_DAY_CODE : Indicates the time of day when the earnings announcement is expected. Values in this field will be one of the following: 1 (After market close), 2 (Before the open), 3 (During market trading) or 4 (Unknown).
         reportTimeOfDayCode

         EPS_ACT_QR0 : Actual earnings per share (EPS) for the prior (mostly recently reported) fiscal quarter (QR-0)
         epsActualPreviousFiscalQuarter

         PER_END_DATE_QR0 : The end date of the prior (most recently reported) fiscal quarter (QR0) (YYYYMMDD)
         endDatePreviousFiscalQuarter

         EPS_ACT_QRM3 : Actual earnings per share (EPS) for the one year prior fiscal quarter (QR-3)
         epsActualOneYearAgoFiscalQuarter

         PER_END_DATE_QRM3 : Period end date for the one year prior fiscal quarter (QR-3) (YYYYMMDD)
         endDateOneYearAgoFiscalQuarter

         */
        var _fieldNameToReturn;

        if (zeaFieldName === "PER_END_DATE_FR0") {
            _fieldNameToReturn = "endDateMostRecentFiscalYear";
        } else if (zeaFieldName === "PER_END_DATE_QR1") {
            _fieldNameToReturn = "endDateNextFiscalQuarter";
        } else if (zeaFieldName === "EPS_MEAN_EST_QR1") {
            _fieldNameToReturn = "epsMeanEstimateNextFiscalQuarter";
        } else if (zeaFieldName === "EXP_RPT_DATE_QR1") {
            _fieldNameToReturn = "reportDateNextFiscalQuarter";
        } else if (zeaFieldName === "EXP_RPT_DATE_QR2") {
            _fieldNameToReturn = "reportDateNextNextFiscalQuarter";
        } else if (zeaFieldName === "EXP_RPT_DATE_FR1") {
            _fieldNameToReturn = "reportDateNextFiscalYear";
        } else if (zeaFieldName === "LATE_LAST_FLAG") {
            _fieldNameToReturn = "lateMostRecentReportFlag";
        } else if (zeaFieldName === "SOURCE_FLAG") {
            _fieldNameToReturn = "reportSourceFlag";
        } else if (zeaFieldName === "TIME_OF_DAY_CODE") {
            _fieldNameToReturn = "reportTimeOfDayCode";
        } else if (zeaFieldName === "EPS_ACT_QR0") {
            _fieldNameToReturn = "epsActualPreviousFiscalQuarter";
        } else if (zeaFieldName === "PER_END_DATE_QR0") {
            _fieldNameToReturn = "endDatePreviousFiscalQuarter";
        } else if (zeaFieldName === "EPS_ACT_QRM3") {
            _fieldNameToReturn = "epsActualOneYearAgoFiscalQuarter";
        } else if (zeaFieldName === "PER_END_DATE_QRM3") {
            _fieldNameToReturn = "endDateOneYearAgoFiscalQuarter";
        } else if (zeaFieldName === "AS_OF") {
            _fieldNameToReturn = "asOf";
        }

        return _fieldNameToReturn;
    }

    function _matchingEntryExistsInEarningsReleases(_symbol, _objectFromQuandlMyDbFormat) {
        var _matchingEarningReleaseFound = false;
        var _allExistingEarningsReleasesForSymbol = EarningsReleases.find({symbol: _symbol});
        _allExistingEarningsReleasesForSymbol.forEach(function(existingRelease) {
            console.log("existing release: ", existingRelease);
            var _allFieldsMatch = true;
            for (var key in _objectFromQuandlMyDbFormat) {
                console.log("checking key: ", key);
                if (key !== "asOf" && _objectFromQuandlMyDbFormat.hasOwnProperty(key) && (!existingRelease.hasOwnProperty(key) || _objectFromQuandlMyDbFormat[key] !== existingRelease[key])) {
                    console.log("key does not match: ", key);
                    _allFieldsMatch = false;
                    break;
                }
            }
            if (_allFieldsMatch) {
                _matchingEarningReleaseFound = true;
            }
        })
        return _matchingEarningReleaseFound;
    }
}